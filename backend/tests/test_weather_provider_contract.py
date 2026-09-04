"""Open-Meteo provider-contract coverage for the shared hourly time boundary."""

from datetime import datetime
from unittest import mock

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

FIXED_NOW = datetime(2026, 8, 24, 15, 30)
CURRENT_TARGET_TIME = "2026-08-24T15:00"

MALFORMED_TIMES = [
    [],
    ["2026-08-25T12:00", 42],
    ["2026-08-25T12:00", "2026-08-25 13:00"],
    ["2026-08-25T12:00", "2026-08-25T13:00:00"],
    ["2026-08-25T12:00", " 2026-08-25T13:00"],
    ["2026-08-25T12:00", "20260825T1300"],
    ["2026-08-25T12:00", "not-a-time"],
    ["2026-13-25T12:00", "2026-13-26T13:00"],
    ["2026-08-25T24:00", "2026-08-25T25:00"],
    ["2026-08-25T12:00", "2026-08-25T12:00"],
    ["2026-08-25T13:00", "2026-08-25T12:00"],
    ["2026-08-25T12:00", "2026-08-25T13:00", "2026-08-25T13:00"],
]
# Time series that do contain the hour the current endpoint selects, so a
# failure can only come from the time contract itself.
MALFORMED_TIMES_WITH_TARGET = [
    [CURRENT_TARGET_TIME, 42],
    [CURRENT_TARGET_TIME, "2026-08-24 16:00"],
    [CURRENT_TARGET_TIME, "2026-08-24T16:00:00"],
    [CURRENT_TARGET_TIME, "not-a-time"],
    [CURRENT_TARGET_TIME, "2026-13-24T16:00"],
    [CURRENT_TARGET_TIME, "2026-08-24T24:00"],
    [CURRENT_TARGET_TIME, CURRENT_TARGET_TIME],
    ["2026-08-24T16:00", CURRENT_TARGET_TIME],
    ["2026-08-24T14:00", CURRENT_TARGET_TIME, CURRENT_TARGET_TIME],
    ["2026-08-24T14:00", "2026-08-24T16:00", CURRENT_TARGET_TIME],
]


class _FixedDatetime(datetime):
    @classmethod
    def now(cls, tz=None):
        return FIXED_NOW.replace(tzinfo=tz)


def _mock_response(payload):
    response = mock.Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = payload
    return response


def _payload(times, fields):
    hourly = {"time": times}
    hourly.update({name: [value] * len(times) for name, value in fields.items()})
    return {"hourly": hourly}


def _hourly_fields():
    return {
        "temperature_2m": 30.0,
        "precipitation": 0.0,
        "weather_code": 1,
        "wind_speed_10m": 5.0,
    }


def _current_fields():
    return {
        "temperature_2m": 28.4,
        "relative_humidity_2m": 42,
        "apparent_temperature": 29.1,
        "weather_code": 1,
        "wind_speed_10m": 13.2,
    }


@pytest.mark.parametrize("times", MALFORMED_TIMES)
def test_hourly_rejects_malformed_provider_times(times):
    payload = _payload(times, _hourly_fields())
    with mock.patch(
        "app.weather.open_meteo.httpx.get", return_value=_mock_response(payload)
    ):
        response = client.get("/weather/hourly")

    assert response.status_code == 502


@pytest.mark.parametrize("times", MALFORMED_TIMES_WITH_TARGET)
def test_current_rejects_malformed_provider_times(times):
    payload = _payload(times, _current_fields())
    with mock.patch("app.weather.open_meteo.datetime", _FixedDatetime), mock.patch(
        "app.weather.open_meteo.httpx.get", return_value=_mock_response(payload)
    ):
        response = client.get("/weather/current")

    assert response.status_code == 502


def test_hourly_accepts_strictly_increasing_minute_times():
    times = [
        "2026-08-25T12:00",
        "2026-08-25T12:30",
        "2026-08-25T13:00",
        "2026-08-26T00:05",
    ]
    payload = _payload(times, _hourly_fields())
    with mock.patch(
        "app.weather.open_meteo.httpx.get", return_value=_mock_response(payload)
    ):
        response = client.get("/weather/hourly")

    assert response.status_code == 200
    assert [point["time"] for point in response.json()] == times


def test_current_accepts_target_hour_in_minute_granularity_series():
    times = ["2026-08-24T14:30", CURRENT_TARGET_TIME, "2026-08-24T15:30"]
    payload = _payload(times, _current_fields())
    with mock.patch("app.weather.open_meteo.datetime", _FixedDatetime), mock.patch(
        "app.weather.open_meteo.httpx.get", return_value=_mock_response(payload)
    ):
        response = client.get("/weather/current")

    assert response.status_code == 200
    assert response.json()["time"] == CURRENT_TARGET_TIME
