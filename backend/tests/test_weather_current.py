from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.weather.open_meteo import (
    OPEN_METEO_FORECAST_BASE_URL,
    WeatherFetchError,
    get_current_weather,
)

client = TestClient(app)

FIXED_UTC = datetime(2026, 8, 24, 12, 41, tzinfo=timezone.utc)
TARGET_TIME = "2026-08-24T15:00"


class _FixedDatetime(datetime):
    @classmethod
    def now(cls, tz=None):
        if tz is None:
            return FIXED_UTC.replace(tzinfo=None)
        return FIXED_UTC.astimezone(tz)


def _mock_response(payload, status_code=200):
    mock_response = MagicMock()
    mock_response.status_code = status_code
    mock_response.json.return_value = payload
    return mock_response


def _hourly_payload(times, *, timezone_name="Europe/Istanbul", **fields):
    return {"timezone": timezone_name, "hourly": {"time": times, **fields}}


def test_weather_current_success():
    times = ["2026-08-24T14:00", TARGET_TIME, "2026-08-24T16:00"]
    payload = _hourly_payload(
        times,
        temperature_2m=[30.0, 28.4, 27.9],
        relative_humidity_2m=[40, 42, 45],
        apparent_temperature=[31.0, 29.1, 28.8],
        weather_code=[0, 1, 2],
        wind_speed_10m=[10.0, 13.2, 15.5],
    )
    with patch("app.weather.open_meteo.datetime", _FixedDatetime), patch(
        "app.weather.open_meteo.httpx.get",
        return_value=_mock_response(payload),
    ) as mock_get:
        response = client.get("/weather/current")

    assert response.status_code == 200
    assert response.json() == {
        "location": "Elazığ",
        "temperature": 28.4,
        "apparent_temperature": 29.1,
        "humidity": 42,
        "wind_speed": 13.2,
        "weather_code": 1,
        "time": TARGET_TIME,
    }

    args, kwargs = mock_get.call_args
    assert args[0] == OPEN_METEO_FORECAST_BASE_URL
    assert kwargs["params"] == {
        "latitude": 38.6743,
        "longitude": 39.2232,
        "hourly": "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
        "timezone": "auto",
        "forecast_days": 7,
        "forecast_hours": 24,
    }


def test_weather_current_uses_new_york_provider_timezone():
    times = ["2026-08-24T07:00", "2026-08-24T08:00", "2026-08-24T09:00"]
    payload = _hourly_payload(
        times,
        timezone_name="America/New_York",
        temperature_2m=[17.0, 21.5, 23.0],
        relative_humidity_2m=[50, 55, 60],
        apparent_temperature=[17.5, 22.0, 23.5],
        weather_code=[1, 2, 3],
        wind_speed_10m=[8.0, 9.0, 10.0],
    )
    with patch("app.weather.open_meteo.datetime", _FixedDatetime), patch(
        "app.weather.open_meteo.httpx.get",
        return_value=_mock_response(payload),
    ):
        response = client.get(
            "/weather/current",
            params={"latitude": 40.7128, "longitude": -74.0060, "location": "New York"},
        )

    assert response.status_code == 200
    assert response.json()["time"] == "2026-08-24T08:00"
    assert response.json()["temperature"] == 21.5


def test_weather_current_uses_positive_offset_provider_timezone():
    times = ["2026-08-24T20:00", "2026-08-24T21:00", "2026-08-24T22:00"]
    payload = _hourly_payload(
        times,
        timezone_name="Asia/Tokyo",
        temperature_2m=[17.0, 21.5, 23.0],
        relative_humidity_2m=[50, 55, 60],
        apparent_temperature=[17.5, 22.0, 23.5],
        weather_code=[1, 2, 3],
        wind_speed_10m=[8.0, 9.0, 10.0],
    )
    with patch("app.weather.open_meteo.datetime", _FixedDatetime), patch(
        "app.weather.open_meteo.httpx.get",
        return_value=_mock_response(payload),
    ):
        response = client.get(
            "/weather/current",
            params={"latitude": 35.6762, "longitude": 139.6503, "location": "Tokyo"},
        )

    assert response.status_code == 200
    assert response.json()["time"] == "2026-08-24T21:00"
    assert response.json()["temperature"] == 21.5


def test_weather_current_missing_hourly_field_raises():
    times = ["2026-08-24T14:00", TARGET_TIME, "2026-08-24T16:00"]
    payload = _hourly_payload(
        times,
        temperature_2m=[30.0, 28.4, 27.9],
        relative_humidity_2m=[40, 42, 45],
        apparent_temperature=[31.0, 29.1, 28.8],
        weather_code=[0, 1, 2],
    )
    with patch("app.weather.open_meteo.datetime", _FixedDatetime), patch(
        "app.weather.open_meteo.httpx.get",
        return_value=_mock_response(payload),
    ):
        with pytest.raises(WeatherFetchError):
            get_current_weather()


def test_weather_current_hour_not_in_times_raises():
    times = ["2026-08-24T16:00", "2026-08-24T17:00"]
    payload = _hourly_payload(
        times,
        temperature_2m=[27.9, 27.5],
        relative_humidity_2m=[45, 48],
        apparent_temperature=[28.8, 28.4],
        weather_code=[2, 3],
        wind_speed_10m=[15.5, 16.0],
    )
    with patch("app.weather.open_meteo.datetime", _FixedDatetime), patch(
        "app.weather.open_meteo.httpx.get",
        return_value=_mock_response(payload),
    ):
        with pytest.raises(WeatherFetchError):
            get_current_weather()


def test_weather_current_does_not_match_same_hour_on_another_day():
    times = ["2026-08-25T15:00", "2026-08-25T16:00"]
    payload = _hourly_payload(
        times,
        temperature_2m=[27.9, 27.5],
        relative_humidity_2m=[45, 48],
        apparent_temperature=[28.8, 28.4],
        weather_code=[2, 3],
        wind_speed_10m=[15.5, 16.0],
    )
    with patch("app.weather.open_meteo.datetime", _FixedDatetime), patch(
        "app.weather.open_meteo.httpx.get",
        return_value=_mock_response(payload),
    ):
        with pytest.raises(WeatherFetchError, match="current hour"):
            get_current_weather()


def test_weather_current_non_integer_humidity_returns_502():
    times = ["2026-08-24T14:00", TARGET_TIME, "2026-08-24T16:00"]
    payload = _hourly_payload(
        times,
        temperature_2m=[30.0, 28.4, 27.9],
        relative_humidity_2m=[40, 42.5, 45],
        apparent_temperature=[31.0, 29.1, 28.8],
        weather_code=[0, 1, 2],
        wind_speed_10m=[10.0, 13.2, 15.5],
    )
    with patch("app.weather.open_meteo.datetime", _FixedDatetime), patch(
        "app.weather.open_meteo.httpx.get",
        return_value=_mock_response(payload),
    ):
        response = client.get("/weather/current")

    assert response.status_code == 502
    assert "non-integer" in response.json()["detail"]


def _current_payload_with(field: str, values: list) -> dict:
    fields = {
        "temperature_2m": [30.0, 28.4, 27.9],
        "relative_humidity_2m": [40, 42, 45],
        "apparent_temperature": [31.0, 29.1, 28.8],
        "weather_code": [0, 1, 2],
        "wind_speed_10m": [10.0, 13.2, 15.5],
    }
    fields[field] = values
    return _hourly_payload(
        ["2026-08-24T14:00", TARGET_TIME, "2026-08-24T16:00"], **fields
    )


@pytest.mark.parametrize(
    ("field", "values"),
    [
        ("relative_humidity_2m", [40, 101, 45]),
        ("relative_humidity_2m", [40, -1, 45]),
        ("relative_humidity_2m", [40, "42", 45]),
        ("relative_humidity_2m", [40, None, 45]),
        ("weather_code", [0, 1.5, 2]),
        ("weather_code", [0, float("nan"), 2]),
        ("temperature_2m", [30.0, float("nan"), 27.9]),
        ("apparent_temperature", [31.0, float("inf"), 28.8]),
        ("wind_speed_10m", [10.0, float("-inf"), 15.5]),
        ("wind_speed_10m", [10.0, -1.0, 15.5]),
        ("wind_speed_10m", [10.0, True, 15.5]),
    ],
)
def test_weather_current_malformed_provider_values_return_502(field, values):
    payload = _current_payload_with(field, values)
    with patch("app.weather.open_meteo.datetime", _FixedDatetime), patch(
        "app.weather.open_meteo.httpx.get",
        return_value=_mock_response(payload),
    ):
        response = client.get("/weather/current")

    assert response.status_code == 502


def test_weather_current_normalizes_integral_provider_floats():
    times = ["2026-08-24T14:00", TARGET_TIME, "2026-08-24T16:00"]
    payload = _hourly_payload(
        times,
        temperature_2m=[30.0, 28.4, 27.9],
        relative_humidity_2m=[40, 48.0, 45],
        apparent_temperature=[31.0, 29.1, 28.8],
        weather_code=[0, 61.0, 2],
        wind_speed_10m=[10.0, 13.2, 15.5],
    )
    with patch("app.weather.open_meteo.datetime", _FixedDatetime), patch(
        "app.weather.open_meteo.httpx.get",
        return_value=_mock_response(payload),
    ):
        response = client.get("/weather/current")

    assert response.status_code == 200
    data = response.json()
    assert data["humidity"] == 48
    assert data["weather_code"] == 61
    assert type(data["humidity"]) is int
    assert type(data["weather_code"]) is int


def test_weather_current_preserves_large_integer_weather_code():
    """2**53 + 1 is exactly representable as an int but not as a float."""
    payload = _current_payload_with("weather_code", [0, 9007199254740993, 2])
    with patch("app.weather.open_meteo.datetime", _FixedDatetime), patch(
        "app.weather.open_meteo.httpx.get",
        return_value=_mock_response(payload),
    ):
        response = client.get("/weather/current")

    assert response.status_code == 200
    assert "9007199254740993" in response.text
    data = response.json()
    assert data["weather_code"] == 9007199254740993
    assert type(data["weather_code"]) is int


@pytest.mark.parametrize(
    ("field", "values"),
    [
        ("temperature_2m", [30.0, 10**400, 27.9]),
        ("apparent_temperature", [31.0, 10**400, 28.8]),
        ("wind_speed_10m", [10.0, 10**400, 15.5]),
    ],
)
def test_weather_current_unrepresentable_float_field_returns_502(field, values):
    payload = _current_payload_with(field, values)
    with patch("app.weather.open_meteo.datetime", _FixedDatetime), patch(
        "app.weather.open_meteo.httpx.get",
        return_value=_mock_response(payload),
    ):
        response = client.get("/weather/current")

    assert response.status_code == 502
    assert "non-finite" in response.json()["detail"]
