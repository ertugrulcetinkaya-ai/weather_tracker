from datetime import datetime, timezone
from unittest import mock

from fastapi.testclient import TestClient

from app.main import app
from app.weather.open_meteo import (
    ELAZIG_LATITUDE,
    ELAZIG_LOCATION,
    ELAZIG_LONGITUDE,
)

client = TestClient(app)

FIXED_UTC = datetime(2026, 8, 24, 12, 41, tzinfo=timezone.utc)


class _FixedDatetime(datetime):
    @classmethod
    def now(cls, tz=None):
        if tz is None:
            return FIXED_UTC.replace(tzinfo=None)
        return FIXED_UTC.astimezone(tz)

ISTANBUL_LAT = 41.0082
ISTANBUL_LON = 28.9784
ISTANBUL_NAME = "İstanbul"


def _current_payload():
    times = ["2026-08-24T14:00", "2026-08-24T15:00", "2026-08-24T16:00"]
    return {
        "timezone": "Europe/Istanbul",
        "hourly": {
            "time": times,
            "temperature_2m": [25.0, 27.9, 28.1],
            "relative_humidity_2m": [40, 42, 45],
            "apparent_temperature": [26.0, 28.5, 29.0],
            "weather_code": [1, 2, 3],
            "wind_speed_10m": [5.0, 6.0, 7.0],
        }
    }


def _hourly_payload():
    times = [f"2026-08-25T{h:02d}:00" for h in range(24)]
    return {
        "timezone": "Europe/Istanbul",
        "hourly": {
            "time": times,
            "temperature_2m": [20.0] * 24,
            "precipitation": [0.0] * 24,
            "precipitation_probability": [10] * 24,
            "weather_code": [1] * 24,
            "wind_speed_10m": [5.0] * 24,
        }
    }


def _mock_response(payload):
    resp = mock.MagicMock()
    resp.json.return_value = payload
    resp.raise_for_status.return_value = None
    return resp


def test_current_defaults_uses_elazig():
    with mock.patch("app.weather.open_meteo.datetime", _FixedDatetime), mock.patch(
        "app.weather.open_meteo.httpx.get"
    ) as mock_get:
        mock_get.return_value = _mock_response(_current_payload())
        response = client.get("/weather/current")
    assert response.status_code == 200
    assert response.json()["location"] == ELAZIG_LOCATION
    call_kwargs = mock_get.call_args[1]
    assert call_kwargs["params"]["latitude"] == ELAZIG_LATITUDE
    assert call_kwargs["params"]["longitude"] == ELAZIG_LONGITUDE


def test_current_custom_location():
    with mock.patch("app.weather.open_meteo.datetime", _FixedDatetime), mock.patch(
        "app.weather.open_meteo.httpx.get"
    ) as mock_get:
        mock_get.return_value = _mock_response(_current_payload())
        response = client.get(
            "/weather/current",
            params={"latitude": ISTANBUL_LAT, "longitude": ISTANBUL_LON, "location": ISTANBUL_NAME},
        )
    assert response.status_code == 200
    data = response.json()
    assert data["location"] == ISTANBUL_NAME
    call_kwargs = mock_get.call_args[1]
    assert call_kwargs["params"]["latitude"] == ISTANBUL_LAT
    assert call_kwargs["params"]["longitude"] == ISTANBUL_LON


def test_hourly_custom_coordinates():
    with mock.patch("app.weather.open_meteo.httpx.get") as mock_get:
        mock_get.return_value = _mock_response(_hourly_payload())
        response = client.get(
            "/weather/hourly",
            params={"latitude": ISTANBUL_LAT, "longitude": ISTANBUL_LON},
        )
    assert response.status_code == 200
    assert len(response.json()) == 24
    call_kwargs = mock_get.call_args[1]
    assert call_kwargs["params"]["latitude"] == ISTANBUL_LAT
    assert call_kwargs["params"]["longitude"] == ISTANBUL_LON


def test_rain_custom_coordinates():
    with mock.patch("app.weather.open_meteo.httpx.get") as mock_get:
        mock_get.return_value = _mock_response(_hourly_payload())
        response = client.get(
            "/weather/rain",
            params={"latitude": ISTANBUL_LAT, "longitude": ISTANBUL_LON},
        )
    assert response.status_code == 200
    call_kwargs = mock_get.call_args[1]
    assert call_kwargs["params"]["latitude"] == ISTANBUL_LAT
    assert call_kwargs["params"]["longitude"] == ISTANBUL_LON


def test_rain_next_custom_coordinates():
    with mock.patch("app.weather.open_meteo.httpx.get") as mock_get:
        mock_get.return_value = _mock_response(_hourly_payload())
        response = client.get(
            "/weather/rain/next",
            params={"latitude": ISTANBUL_LAT, "longitude": ISTANBUL_LON},
        )
    assert response.status_code == 200
    call_kwargs = mock_get.call_args[1]
    assert call_kwargs["params"]["latitude"] == ISTANBUL_LAT
    assert call_kwargs["params"]["longitude"] == ISTANBUL_LON


def test_only_latitude_returns_422():
    response = client.get("/weather/current", params={"latitude": ISTANBUL_LAT})
    assert response.status_code == 422


def test_only_longitude_returns_422():
    response = client.get("/weather/current", params={"longitude": ISTANBUL_LON})
    assert response.status_code == 422


def test_invalid_latitude_returns_422():
    response = client.get(
        "/weather/current",
        params={"latitude": 100, "longitude": ISTANBUL_LON},
    )
    assert response.status_code == 422


def test_invalid_longitude_returns_422():
    response = client.get(
        "/weather/current",
        params={"latitude": ISTANBUL_LAT, "longitude": 200},
    )
    assert response.status_code == 422


def test_blank_location_name_returns_422():
    response = client.get(
        "/weather/current",
        params={
            "latitude": ISTANBUL_LAT,
            "longitude": ISTANBUL_LON,
            "location": " ",
        },
    )

    assert response.status_code == 422
