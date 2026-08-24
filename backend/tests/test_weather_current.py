from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.weather.open_meteo import OPEN_METEO_ECMWF_BASE_URL, WeatherFetchError, get_current_weather

client = TestClient(app)

MOCK_CURRENT = {
    "time": "2026-08-24T15:00",
    "temperature_2m": 28.4,
    "relative_humidity_2m": 42,
    "apparent_temperature": 29.1,
    "weather_code": 1,
    "wind_speed_10m": 13.2,
}


def _mock_response(payload, status_code=200):
    mock_response = MagicMock()
    mock_response.status_code = status_code
    mock_response.json.return_value = payload
    return mock_response


def test_weather_current_success():
    with patch(
        "app.weather.open_meteo.httpx.get",
        return_value=_mock_response({"current": MOCK_CURRENT}),
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
        "time": "2026-08-24T15:00",
    }

    args, kwargs = mock_get.call_args
    assert args[0] == OPEN_METEO_ECMWF_BASE_URL
    assert kwargs["params"] == {
        "latitude": 38.6743,
        "longitude": 39.2232,
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
        "timezone": "Europe/Istanbul",
    }


def test_weather_current_missing_field_raises():
    incomplete = {k: v for k, v in MOCK_CURRENT.items() if k != "wind_speed_10m"}
    with patch(
        "app.weather.open_meteo.httpx.get",
        return_value=_mock_response({"current": incomplete}),
    ):
        with pytest.raises(WeatherFetchError):
            get_current_weather()
