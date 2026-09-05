"""Generic Forecast API daily contract for `/weather/overview`."""

from datetime import datetime, timezone
from unittest import mock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.weather.open_meteo import WeatherFetchError, get_weather_overview

client = TestClient(app)

FIXED_UTC = datetime(2026, 8, 24, 12, 30, tzinfo=timezone.utc)
CURRENT_TARGET_TIME = "2026-08-24T15:00"

HOURLY_TIMES = [f"2026-08-24T{hour:02d}:00" for hour in range(15, 24)] + [
    f"2026-08-25T{hour:02d}:00" for hour in range(15)
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
        if tz is None:
            return FIXED_UTC.replace(tzinfo=None)
        return FIXED_UTC.astimezone(tz)


def _mock_response(payload):
    response = mock.Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = payload
    return response


def _daily_block(**overrides):
    daily = {
        "time": list(DAILY_DATES),
        "weather_code": [1, 3, 61, 63, 2, 0, 1],
        "temperature_2m_max": [30.0, 31.2, 27.4, 25.1, 28.9, 33.0, 32.5],
        "temperature_2m_min": [18.0, 19.4, 17.2, 16.0, 15.5, 20.1, 21.0],
        "precipitation_sum": [0.0, 0.0, 2.4, 8.1, 0.2, 0.0, 0.0],
        "precipitation_probability_max": [5, 12, 78, 92, 30, 0, 8],
    }
    daily.update(overrides)
    return daily


def _overview_payload(daily=None, **hourly_overrides):
    hourly = {
        "time": list(HOURLY_TIMES),
        "temperature_2m": [28.4, 27.9, 27.1] + [27.0] * 21,
        "relative_humidity_2m": [42, 45, 48] + [50] * 21,
        "apparent_temperature": [29.1, 28.8, 28.0] + [27.5] * 21,
        "weather_code": [1, 61, 2] + [1] * 21,
        "wind_speed_10m": [13.2, 15.5, 12.1] + [10.0] * 21,
        "precipitation": [0.0, 1.25, 0.0] + [0.0] * 21,
        "precipitation_probability": [10, 35, 60] + [10] * 21,
    }
    hourly.update(hourly_overrides)
    payload = {"timezone": "Europe/Istanbul", "hourly": hourly}
    if daily is not None:
        payload["daily"] = daily
    return payload


def _get_overview(payload):
    with mock.patch("app.weather.open_meteo.datetime", _FixedDatetime), mock.patch(
        "app.weather.open_meteo.httpx.get", return_value=_mock_response(payload)
    ):
        return client.get("/weather/overview")


def test_overview_returns_seven_ordered_daily_records():
    response = _get_overview(_overview_payload(_daily_block()))

    assert response.status_code == 200
    daily = response.json()["daily"]
    assert [day["date"] for day in daily] == DAILY_DATES


def test_overview_daily_records_expose_every_public_field():
    response = _get_overview(_overview_payload(_daily_block()))

    assert response.status_code == 200
    assert response.json()["daily"] == [
        {
            "date": "2026-08-24",
            "temperature_max": 30.0,
            "temperature_min": 18.0,
            "precipitation": 0.0,
            "precipitation_probability": 5,
            "weather_code": 1,
        },
        {
            "date": "2026-08-25",
            "temperature_max": 31.2,
            "temperature_min": 19.4,
            "precipitation": 0.0,
            "precipitation_probability": 12,
            "weather_code": 3,
        },
        {
            "date": "2026-08-26",
            "temperature_max": 27.4,
            "temperature_min": 17.2,
            "precipitation": 2.4,
            "precipitation_probability": 78,
            "weather_code": 61,
        },
        {
            "date": "2026-08-27",
            "temperature_max": 25.1,
            "temperature_min": 16.0,
            "precipitation": 8.1,
            "precipitation_probability": 92,
            "weather_code": 63,
        },
        {
            "date": "2026-08-28",
            "temperature_max": 28.9,
            "temperature_min": 15.5,
            "precipitation": 0.2,
            "precipitation_probability": 30,
            "weather_code": 2,
        },
        {
            "date": "2026-08-29",
            "temperature_max": 33.0,
            "temperature_min": 20.1,
            "precipitation": 0.0,
            "precipitation_probability": 0,
            "weather_code": 0,
        },
        {
            "date": "2026-08-30",
            "temperature_max": 32.5,
            "temperature_min": 21.0,
            "precipitation": 0.0,
            "precipitation_probability": 8,
            "weather_code": 1,
        },
    ]


def test_overview_daily_serializes_integral_floats_as_integers():
    daily = _daily_block(
        precipitation_probability_max=[5.0, 12, 78, 92, 30, 0, 8],
        weather_code=[1.0, 3, 61, 63, 2, 0, 1],
    )
    response = _get_overview(_overview_payload(daily))

    assert response.status_code == 200
    records = response.json()["daily"]
    assert records[0]["precipitation_probability"] == 5
    assert type(records[0]["precipitation_probability"]) is int
    assert records[0]["weather_code"] == 1
    assert type(records[0]["weather_code"]) is int


def test_overview_daily_preserves_large_integer_weather_codes():
    """2**53 + 1 is exactly representable as an int but not as a float."""
    daily = _daily_block(weather_code=[9007199254740993, 3, 61, 63, 2, 0, 1])
    response = _get_overview(_overview_payload(daily))

    assert response.status_code == 200
    assert "9007199254740993" in response.text
    record = response.json()["daily"][0]
    assert record["weather_code"] == 9007199254740993
    assert type(record["weather_code"]) is int


def test_overview_daily_accepts_unmapped_wmo_codes():
    daily = _daily_block(weather_code=[42, 3, 61, 63, 2, 0, 1])
    response = _get_overview(_overview_payload(daily))

    assert response.status_code == 200
    assert response.json()["daily"][0]["weather_code"] == 42


@pytest.mark.parametrize(
    ("field", "values"),
    [
        ("time", ["2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28", "2026-08-29", "2026/08/30"]),
        ("time", ["2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28", "2026-08-29", "2026-08-2"]),
        ("time", ["24.08.2026", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28", "2026-08-29", "2026-08-30"]),
        ("time", ["2026-13-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28", "2026-08-29", "2026-08-30"]),
        ("time", ["2026-02-30", "2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06"]),
        ("time", ["2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28", "2026-08-29", 30]),
        ("time", ["2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28", "2026-08-29"]),
        ("time", DAILY_DATES[:6] + [DAILY_DATES[1]]),
        ("time", list(reversed(DAILY_DATES))),
        ("weather_code", [1, 61.5, 2, 3, 0, 1, 2]),
        ("weather_code", [1, "61", 2, 3, 0, 1, 2]),
        ("temperature_2m_max", [30.0, float("nan"), 27.4, 25.1, 28.9, 33.0, 32.5]),
        ("temperature_2m_min", [18.0, float("inf"), 17.2, 16.0, 15.5, 20.1, 21.0]),
        ("temperature_2m_max", [30.0, 10**400, 27.4, 25.1, 28.9, 33.0, 32.5]),
        ("temperature_2m_min", [18.0, -10**400, 17.2, 16.0, 15.5, 20.1, 21.0]),
        ("precipitation_sum", [0.0, -0.1, 2.4, 8.1, 0.2, 0.0, 0.0]),
        ("precipitation_sum", [0.0, float("nan"), 2.4, 8.1, 0.2, 0.0, 0.0]),
        ("precipitation_probability_max", [5, -1, 78, 92, 30, 0, 8]),
        ("precipitation_probability_max", [5, 101, 78, 92, 30, 0, 8]),
        ("precipitation_probability_max", [5, 78.5, 78, 92, 30, 0, 8]),
        ("precipitation_probability_max", [5, float("nan"), 78, 92, 30, 0, 8]),
        ("precipitation_probability_max", [5, None, 78, 92, 30, 0, 8]),
    ],
)
def test_overview_rejects_malformed_daily_values(field, values):
    response = _get_overview(_overview_payload(_daily_block(**{field: values})))

    assert response.status_code == 502


def test_overview_rejects_daily_field_length_mismatch():
    response = _get_overview(
        _overview_payload(_daily_block(temperature_2m_max=[30.0, 31.2, 27.4]))
    )

    assert response.status_code == 502


def test_overview_rejects_daily_min_above_max():
    daily = _daily_block(
        temperature_2m_max=[30.0, 31.2, 27.4, 25.1, 28.9, 33.0, 32.5],
        temperature_2m_min=[18.0, 31.3, 17.2, 16.0, 15.5, 20.1, 21.0],
    )
    response = _get_overview(_overview_payload(daily))

    assert response.status_code == 502


def test_overview_accepts_daily_min_equal_to_max():
    daily = _daily_block(
        temperature_2m_max=[30.0, 31.2, 27.4, 25.1, 28.9, 33.0, 32.5],
        temperature_2m_min=[30.0, 19.4, 17.2, 16.0, 15.5, 20.1, 21.0],
    )
    response = _get_overview(_overview_payload(daily))

    assert response.status_code == 200
    assert response.json()["daily"][0]["temperature_min"] == 30.0


@pytest.mark.parametrize(
    "daily",
    [
        None,
        {},
        [],
        {"time": DAILY_DATES},
        {"time": DAILY_DATES, "weather_code": [1] * 7,
         "temperature_2m_max": [30.0] * 7, "temperature_2m_min": [18.0] * 7,
         "precipitation_sum": [0.0] * 7},
    ],
)
def test_overview_rejects_missing_daily_block(daily):
    payload = _overview_payload(_daily_block() if daily is None else daily)
    if daily is None:
        payload.pop("daily")
    response = _get_overview(payload)

    assert response.status_code == 502


def test_overview_raises_provider_error_before_pydantic():
    payload = _overview_payload(_daily_block(precipitation_sum=[-1.0] * 7))
    with mock.patch("app.weather.open_meteo.datetime", _FixedDatetime), mock.patch(
        "app.weather.open_meteo.httpx.get", return_value=_mock_response(payload)
    ):
        with pytest.raises(WeatherFetchError):
            get_weather_overview()
