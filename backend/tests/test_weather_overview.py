from datetime import datetime
from unittest import mock

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.weather.open_meteo import (
    DAILY_FIELDS,
    OPEN_METEO_FORECAST_BASE_URL,
    OVERVIEW_FIELDS,
)

client = TestClient(app)
FIXED_NOW = datetime(2026, 8, 24, 15, 30)

HOURLY_TIMES = [
    "2026-08-24T15:00",
    "2026-08-24T16:00",
    "2026-08-24T17:00",
    "2026-08-24T18:00",
    "2026-08-24T19:00",
    "2026-08-24T20:00",
    "2026-08-24T21:00",
    "2026-08-24T22:00",
    "2026-08-24T23:00",
    "2026-08-25T00:00",
    "2026-08-25T01:00",
    "2026-08-25T02:00",
    "2026-08-25T03:00",
    "2026-08-25T04:00",
    "2026-08-25T05:00",
    "2026-08-25T06:00",
    "2026-08-25T07:00",
    "2026-08-25T08:00",
    "2026-08-25T09:00",
    "2026-08-25T10:00",
    "2026-08-25T11:00",
    "2026-08-25T12:00",
    "2026-08-25T13:00",
    "2026-08-25T14:00",
]
DAILY_DATES = [
    "2026-08-24",
    "2026-08-25",
    "2026-08-26",
    "2026-08-27",
    "2026-08-28",
    "2026-08-29",
    "2026-08-30",
]


class _FixedDatetime(datetime):
    @classmethod
    def now(cls, tz=None):
        return FIXED_NOW.replace(tzinfo=tz)


def _overview_payload():
    return {
        "hourly": {
            "time": list(HOURLY_TIMES),
            "temperature_2m": [28.4] * 24,
            "relative_humidity_2m": [42] * 24,
            "apparent_temperature": [29.1] * 24,
            "weather_code": [1] * 24,
            "wind_speed_10m": [13.2] * 24,
            "precipitation": [0.0, 1.25] + [0.0] * 22,
            "precipitation_probability": [10, 35] + [0] * 22,
        },
        "daily": {
            "time": list(DAILY_DATES),
            "weather_code": [1] * 7,
            "temperature_2m_max": [30.0] * 7,
            "temperature_2m_min": [18.0] * 7,
            "precipitation_sum": [0.0] * 6 + [2.4],
            "precipitation_probability_max": [35] * 7,
        },
    }


def _mock_response(payload):
    response = mock.Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = payload
    return response


def test_overview_builds_screen_with_one_upstream_request():
    with mock.patch("app.weather.open_meteo.datetime", _FixedDatetime), mock.patch(
        "app.weather.open_meteo.httpx.get",
        return_value=_mock_response(_overview_payload()),
    ) as mocked_get:
        response = client.get(
            "/weather/overview",
            params={"latitude": 41.0082, "longitude": 28.9784, "location": "İstanbul"},
        )

    assert response.status_code == 200
    assert mocked_get.call_count == 1
    args, kwargs = mocked_get.call_args
    assert args[0] == OPEN_METEO_FORECAST_BASE_URL
    assert kwargs["params"] == {
        "latitude": 41.0082,
        "longitude": 28.9784,
        "hourly": ",".join(OVERVIEW_FIELDS),
        "daily": ",".join(DAILY_FIELDS),
        "timezone": "Europe/Istanbul",
        "forecast_days": 7,
        "forecast_hours": 24,
    }

    data = response.json()
    assert data["current"] == {
        "location": "İstanbul",
        "temperature": 28.4,
        "apparent_temperature": 29.1,
        "humidity": 42,
        "wind_speed": 13.2,
        "weather_code": 1,
        "time": "2026-08-24T15:00",
    }
    assert len(data["hourly"]) == 24
    assert data["hourly"][0] == {
        "time": "2026-08-24T15:00",
        "temperature": 28.4,
        "precipitation": 0.0,
        "weather_code": 1,
        "wind_speed": 13.2,
        "precipitation_probability": 10,
    }
    assert data["hourly"][1] == {
        "time": "2026-08-24T16:00",
        "temperature": 28.4,
        "precipitation": 1.25,
        "weather_code": 1,
        "wind_speed": 13.2,
        "precipitation_probability": 35,
    }
    assert data["hourly"][-1]["time"] == "2026-08-25T14:00"
    assert len(data["daily"]) == 7
    assert data["daily"][0] == {
        "date": "2026-08-24",
        "temperature_max": 30.0,
        "temperature_min": 18.0,
        "precipitation": 0.0,
        "precipitation_probability": 35,
        "weather_code": 1,
    }
    assert data["daily"][-1] == {
        "date": "2026-08-30",
        "temperature_max": 30.0,
        "temperature_min": 18.0,
        "precipitation": 2.4,
        "precipitation_probability": 35,
        "weather_code": 1,
    }
    assert data["next_rain"] == {
        "start_time": "2026-08-24T16:00",
        "end_time": "2026-08-24T17:00",
        "total_precipitation": 1.25,
        "peak_time": "2026-08-24T16:00",
    }


def test_overview_uses_rain_amount_not_probability_for_next_rain():
    payload = _overview_payload()
    payload["hourly"]["precipitation"] = [0.0] * 24
    payload["hourly"]["precipitation_probability"] = [100] * 24
    with mock.patch("app.weather.open_meteo.datetime", _FixedDatetime), mock.patch(
        "app.weather.open_meteo.httpx.get",
        return_value=_mock_response(payload),
    ):
        response = client.get("/weather/overview")

    assert response.status_code == 200
    data = response.json()
    assert data["next_rain"] is None
    assert {point["precipitation_probability"] for point in data["hourly"]} == {100}


def test_overview_limits_a_long_provider_series_to_the_next_24_hours():
    payload = _overview_payload()
    extra_times = [f"2026-08-25T{hour:02d}:00" for hour in range(15, 24)]
    extra_times += [f"2026-08-26T{hour:02d}:00" for hour in range(15)]
    payload["hourly"]["time"].extend(extra_times)
    for field, values in payload["hourly"].items():
        if field != "time":
            values.extend([values[-1]] * len(extra_times))

    with mock.patch("app.weather.open_meteo.datetime", _FixedDatetime), mock.patch(
        "app.weather.open_meteo.httpx.get",
        return_value=_mock_response(payload),
    ) as mocked_get:
        response = client.get("/weather/overview")

    assert response.status_code == 200
    assert mocked_get.call_count == 1
    assert [point["time"] for point in response.json()["hourly"]] == HOURLY_TIMES


def test_overview_rejects_a_provider_series_shorter_than_24_hours():
    payload = _overview_payload()
    for field, values in payload["hourly"].items():
        payload["hourly"][field] = values[:-1]

    with mock.patch("app.weather.open_meteo.datetime", _FixedDatetime), mock.patch(
        "app.weather.open_meteo.httpx.get",
        return_value=_mock_response(payload),
    ) as mocked_get:
        response = client.get("/weather/overview")

    assert response.status_code == 502
    assert mocked_get.call_count == 1
    assert "24 forecast hours" in response.json()["detail"]


def test_overview_maps_upstream_http_failure_to_bad_gateway():
    upstream = mock.Mock()
    upstream.raise_for_status.side_effect = httpx.HTTPStatusError(
        "Server error",
        request=mock.Mock(),
        response=mock.Mock(status_code=500),
    )
    with mock.patch("app.weather.open_meteo.httpx.get", return_value=upstream):
        response = client.get("/weather/overview")

    assert response.status_code == 502
    assert "Open-Meteo request failed" in response.json()["detail"]


def test_current_maps_invalid_provider_json_to_bad_gateway():
    upstream = mock.Mock()
    upstream.raise_for_status.return_value = None
    upstream.json.side_effect = ValueError("invalid JSON")
    with mock.patch("app.weather.open_meteo.httpx.get", return_value=upstream):
        response = client.get("/weather/current")

    assert response.status_code == 502
    assert "not valid JSON" in response.json()["detail"]


@pytest.mark.parametrize(
    ("field", "values"),
    [
        ("relative_humidity_2m", [101] + [42] * 23),
        ("weather_code", [1, 61.5] + [1] * 22),
        ("precipitation", [0.0, float("nan")] + [0.0] * 22),
        ("wind_speed_10m", [13.2, 15.5, -1.0] + [13.2] * 21),
        ("temperature_2m", [28.4, float("inf")] + [28.4] * 22),
        ("precipitation_probability", [-1] + [10] * 23),
        ("precipitation_probability", [101] + [10] * 23),
        ("precipitation_probability", [10, 35.5] + [10] * 22),
        ("precipitation_probability", [float("nan")] + [10] * 23),
    ],
)
def test_overview_rejects_malformed_provider_values_on_shared_path(field, values):
    payload = _overview_payload()
    payload["hourly"][field] = values
    with mock.patch("app.weather.open_meteo.datetime", _FixedDatetime), mock.patch(
        "app.weather.open_meteo.httpx.get",
        return_value=_mock_response(payload),
    ) as mocked_get:
        response = client.get("/weather/overview")

    assert response.status_code == 502
    assert mocked_get.call_count == 1


def test_overview_serializes_integral_provider_floats_as_integers():
    payload = _overview_payload()
    payload["hourly"]["relative_humidity_2m"] = [48.0] + [42] * 23
    payload["hourly"]["weather_code"] = [3.0] + [1] * 23
    payload["hourly"]["precipitation_probability"] = [12.0] + [10] * 23
    with mock.patch("app.weather.open_meteo.datetime", _FixedDatetime), mock.patch(
        "app.weather.open_meteo.httpx.get",
        return_value=_mock_response(payload),
    ):
        response = client.get("/weather/overview")

    assert response.status_code == 200
    data = response.json()
    assert data["current"]["humidity"] == 48
    assert type(data["current"]["humidity"]) is int
    assert data["current"]["weather_code"] == 3
    assert type(data["current"]["weather_code"]) is int
    assert [point["weather_code"] for point in data["hourly"]][:2] == [3, 1]
    assert data["hourly"][0]["precipitation_probability"] == 12
    assert type(data["hourly"][0]["precipitation_probability"]) is int
