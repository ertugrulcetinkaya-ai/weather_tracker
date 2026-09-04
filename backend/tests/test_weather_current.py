from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.weather.open_meteo import OPEN_METEO_ECMWF_BASE_URL, WeatherFetchError, get_current_weather

client = TestClient(app)

FIXED_NOW = datetime(2026, 8, 24, 15, 41, tzinfo=None)
TARGET_TIME = "2026-08-24T15:00"


class _FixedDatetime(datetime):
    @classmethod
    def now(cls, tz=None):
        return FIXED_NOW.replace(tzinfo=tz)


def _mock_response(payload, status_code=200):
    mock_response = MagicMock()
    mock_response.status_code = status_code
    mock_response.json.return_value = payload
    return mock_response


def _hourly_payload(times, **fields):
    return {"hourly": {"time": times, **fields}}


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
    assert args[0] == OPEN_METEO_ECMWF_BASE_URL
    assert kwargs["params"] == {
        "latitude": 38.6743,
        "longitude": 39.2232,
        "hourly": "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
        "timezone": "Europe/Istanbul",
        "forecast_hours": 24,
    }


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
