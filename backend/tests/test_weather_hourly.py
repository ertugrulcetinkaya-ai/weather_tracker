from unittest import mock

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.weather.open_meteo import WeatherFetchError, fetch_hourly_weather

client = TestClient(app)


def _make_times():
    first_day = [f"2026-08-25T{hour:02d}:00" for hour in range(12, 24)]
    second_day = [f"2026-08-26T{hour:02d}:00" for hour in range(0, 12)]
    return first_day + second_day


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
        "time": "2026-08-26T11:00",
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


def _hourly_payload_with(field: str, values: list):
    fields = {
        "temperature_2m": [30.0] * 24,
        "precipitation": [0.0] * 24,
        "weather_code": [1] * 24,
        "wind_speed_10m": [5.0] * 24,
    }
    fields[field] = values
    return _hourly_payload(_make_times(), **fields)


@pytest.mark.parametrize(
    ("field", "values"),
    [
        ("weather_code", [1] * 23 + [1.5]),
        ("weather_code", [1] * 23 + ["1"]),
        ("precipitation", [0.0] * 23 + [-0.1]),
        ("precipitation", [0.0] * 23 + [float("nan")]),
        ("wind_speed_10m", [5.0] * 23 + [-5.0]),
        ("wind_speed_10m", [5.0] * 23 + [True]),
        ("temperature_2m", [30.0] * 23 + [float("inf")]),
        ("temperature_2m", [30.0] * 23 + [float("-inf")]),
    ],
)
def test_hourly_weather_malformed_provider_values_return_502(field, values):
    payload = _hourly_payload_with(field, values)
    with mock.patch(
        "app.weather.open_meteo.httpx.get", return_value=_mock_response(payload)
    ):
        response = client.get("/weather/hourly")

    assert response.status_code == 502


def test_hourly_weather_accepts_zero_wind_speed():
    payload = _hourly_payload_with("wind_speed_10m", [0.0] * 24)
    with mock.patch(
        "app.weather.open_meteo.httpx.get", return_value=_mock_response(payload)
    ):
        response = client.get("/weather/hourly")

    assert response.status_code == 200
    data = response.json()
    assert {point["wind_speed"] for point in data} == {0.0}
    assert {point["precipitation"] for point in data} == {0.0}


def test_hourly_weather_preserves_large_integer_weather_codes():
    """2**53 + 1 is exactly representable as an int but not as a float."""
    payload = _hourly_payload_with("weather_code", [9007199254740993] * 24)
    with mock.patch(
        "app.weather.open_meteo.httpx.get", return_value=_mock_response(payload)
    ):
        response = client.get("/weather/hourly")

    assert response.status_code == 200
    assert "9007199254740993" in response.text
    data = response.json()
    assert {point["weather_code"] for point in data} == {9007199254740993}
    assert all(type(point["weather_code"]) is int for point in data)


@pytest.mark.parametrize(
    ("field", "values"),
    [
        ("temperature_2m", [30.0] * 23 + [10**400]),
        ("precipitation", [0.0] * 23 + [10**400]),
        ("wind_speed_10m", [5.0] * 23 + [10**400]),
    ],
)
def test_hourly_weather_unrepresentable_float_field_returns_502(field, values):
    payload = _hourly_payload_with(field, values)
    with mock.patch(
        "app.weather.open_meteo.httpx.get", return_value=_mock_response(payload)
    ):
        response = client.get("/weather/hourly")

    assert response.status_code == 502
    assert "non-finite" in response.json()["detail"]
