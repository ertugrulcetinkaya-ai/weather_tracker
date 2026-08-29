from unittest import mock

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.weather.open_meteo import WeatherFetchError, fetch_hourly_weather

client = TestClient(app)


def _make_times():
    return [f"2026-08-25T{(hour + 12) % 24:02d}:00" for hour in range(24)]


def _hourly_payload(times, **fields):
    hourly = {"time": times}
    for key, value in fields.items():
        hourly[key] = value
    return {"hourly": hourly}


def _mock_response(payload):
    response = mock.Mock()
    response.raise_for_status = mock.Mock()
    response.json = mock.Mock(return_value=payload)
    return response


def test_hourly_weather_returns_24_points():
    times = _make_times()
    payload = _hourly_payload(
        times,
        temperature_2m=[30.0] * 24,
        precipitation=[0.0] * 24,
        weather_code=[1] * 24,
        wind_speed_10m=[5.0] * 24,
    )
    with mock.patch(
        "app.weather.open_meteo.httpx.get", return_value=_mock_response(payload)
    ):
        response = client.get("/weather/hourly")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 24
    assert data[0] == {
        "time": "2026-08-25T12:00",
        "temperature": 30.0,
        "precipitation": 0.0,
        "weather_code": 1,
        "wind_speed": 5.0,
    }
    assert data[23] == {
        "time": "2026-08-25T11:00",
        "temperature": 30.0,
        "precipitation": 0.0,
        "weather_code": 1,
        "wind_speed": 5.0,
    }


def test_hourly_weather_missing_value():
    times = _make_times()
    payload = _hourly_payload(
        times,
        temperature_2m=[30.0] * 23 + [None],
        precipitation=[0.0] * 24,
        weather_code=[1] * 24,
        wind_speed_10m=[5.0] * 24,
    )
    with mock.patch(
        "app.weather.open_meteo.httpx.get", return_value=_mock_response(payload)
    ):
        response = client.get("/weather/hourly")

    assert response.status_code == 502
    assert "missing hourly value" in response.json()["detail"]


def test_fetch_hourly_weather_missing_hourly_time():
    payload = {
        "hourly": {
            "temperature_2m": [30.0] * 24,
            "precipitation": [0.0] * 24,
            "weather_code": [1] * 24,
            "wind_speed_10m": [5.0] * 24,
        }
    }
    with mock.patch(
        "app.weather.open_meteo.httpx.get", return_value=_mock_response(payload)
    ):
        with pytest.raises(WeatherFetchError, match="hourly.time"):
            fetch_hourly_weather()


def test_hourly_weather_http_error():
    response = mock.Mock()
    response.raise_for_status.side_effect = httpx.HTTPStatusError(
        "Server error", request=mock.Mock(), response=mock.Mock(status_code=500)
    )
    with mock.patch(
        "app.weather.open_meteo.httpx.get", return_value=response
    ):
        result = client.get("/weather/hourly")

    assert result.status_code == 502
    assert "Open-Meteo request failed" in result.json()["detail"]
