from datetime import datetime
from unittest import mock

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.weather.open_meteo import OVERVIEW_FIELDS

client = TestClient(app)
FIXED_NOW = datetime(2026, 8, 24, 15, 30)


class _FixedDatetime(datetime):
    @classmethod
    def now(cls, tz=None):
        return FIXED_NOW.replace(tzinfo=tz)


def _overview_payload():
    return {
        "hourly": {
            "time": [
                "2026-08-24T15:00",
                "2026-08-24T16:00",
                "2026-08-24T17:00",
            ],
            "temperature_2m": [28.4, 27.9, 27.1],
            "relative_humidity_2m": [42, 45, 48],
            "apparent_temperature": [29.1, 28.8, 28.0],
            "weather_code": [1, 61, 2],
            "wind_speed_10m": [13.2, 15.5, 12.1],
            "precipitation": [0.0, 1.25, 0.0],
        }
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
    assert mocked_get.call_args.kwargs["params"]["hourly"] == ",".join(OVERVIEW_FIELDS)
    assert response.json() == {
        "current": {
            "location": "İstanbul",
            "temperature": 28.4,
            "apparent_temperature": 29.1,
            "humidity": 42,
            "wind_speed": 13.2,
            "weather_code": 1,
            "time": "2026-08-24T15:00",
        },
        "hourly": [
            {
                "time": "2026-08-24T15:00",
                "temperature": 28.4,
                "precipitation": 0.0,
                "weather_code": 1,
                "wind_speed": 13.2,
            },
            {
                "time": "2026-08-24T16:00",
                "temperature": 27.9,
                "precipitation": 1.25,
                "weather_code": 61,
                "wind_speed": 15.5,
            },
            {
                "time": "2026-08-24T17:00",
                "temperature": 27.1,
                "precipitation": 0.0,
                "weather_code": 2,
                "wind_speed": 12.1,
            },
        ],
        "next_rain": {
            "start_time": "2026-08-24T16:00",
            "end_time": "2026-08-24T17:00",
            "total_precipitation": 1.25,
            "peak_time": "2026-08-24T16:00",
        },
    }


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
        ("relative_humidity_2m", [42, 45, 101]),
        ("weather_code", [1, 61.5, 2]),
        ("precipitation", [0.0, float("nan"), 0.0]),
        ("wind_speed_10m", [13.2, 15.5, -1.0]),
        ("temperature_2m", [28.4, 27.9, float("inf")]),
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
    payload["hourly"]["relative_humidity_2m"] = [48.0, 45, 48]
    payload["hourly"]["weather_code"] = [3.0, 61, 2]
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
    assert [point["weather_code"] for point in data["hourly"]] == [3, 61, 2]
