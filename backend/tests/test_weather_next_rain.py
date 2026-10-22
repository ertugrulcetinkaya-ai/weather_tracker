from datetime import datetime, timedelta, timezone
from unittest import mock

from fastapi.testclient import TestClient

from app.main import app
from app.weather.open_meteo import (
    HOURLY_FIELDS,
    OPEN_METEO_FORECAST_BASE_URL,
)

client = TestClient(app)

FIXED_UTC = datetime(2026, 8, 26, 11, 30, tzinfo=timezone.utc)
CURRENT_HOUR = datetime(2026, 8, 26, 14)
FORECAST_TIMES = [
    (CURRENT_HOUR + timedelta(hours=offset)).strftime("%Y-%m-%dT%H:%M")
    for offset in range(25)
]
DAILY_DATES = [
    (CURRENT_HOUR.date() + timedelta(days=offset)).isoformat()
    for offset in range(7)
]


class _FixedDatetime(datetime):
    fixed_utc = FIXED_UTC

    @classmethod
    def now(cls, tz=None):
        if tz is None:
            return cls.fixed_utc.replace(tzinfo=None)
        return cls.fixed_utc.astimezone(tz)


def _payload(
    *,
    times=FORECAST_TIMES,
    precipitation=None,
    timezone_name="Europe/Istanbul",
):
    count = len(times)
    precipitation = list(precipitation or [0.0] * count)
    hourly = {
        "time": list(times),
        "temperature_2m": [20.0 + index for index in range(count)],
        "precipitation": precipitation,
        "precipitation_probability": [0] * count,
        "weather_code": [1] * count,
        "wind_speed_10m": [5.0] * count,
        "relative_humidity_2m": [50] * count,
        "apparent_temperature": [20.0] * count,
    }
    payload = {"timezone": timezone_name, "hourly": hourly}
    payload["daily"] = {
        "time": DAILY_DATES,
        "weather_code": [1] * 7,
        "temperature_2m_max": [25.0] * 7,
        "temperature_2m_min": [15.0] * 7,
        "precipitation_sum": [0.0] * 7,
        "precipitation_probability_max": [0] * 7,
    }
    return payload


def _mock_response(payload):
    response = mock.Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = payload
    return response


def _request_next_rain(payload, *, fixed_utc=FIXED_UTC):
    with mock.patch.object(_FixedDatetime, "fixed_utc", fixed_utc), mock.patch(
        "app.weather.open_meteo.datetime", _FixedDatetime
    ), mock.patch(
        "app.weather.open_meteo.httpx.get",
        return_value=_mock_response(payload),
    ) as mocked_get:
        response = client.get("/weather/rain/next")
    return response, mocked_get


def test_next_rain_excludes_completed_current_hour_amount_at_half_past():
    precipitation = [0.7, 1.2] + [0.0] * 23

    response, _ = _request_next_rain(_payload(precipitation=precipitation))

    assert response.status_code == 200
    assert response.json() == {
        "start_time": "2026-08-26T14:00",
        "end_time": "2026-08-26T15:00",
        "total_precipitation": 1.2,
        "peak_time": "2026-08-26T14:00",
    }


def test_next_rain_does_not_report_only_the_completed_current_hour():
    precipitation = [0.7] + [0.0] * 24

    response, _ = _request_next_rain(_payload(precipitation=precipitation))

    assert response.status_code == 200
    assert response.json() is None


def test_next_rain_includes_rain_in_the_last_future_interval():
    precipitation = [0.0] * 24 + [0.004]

    response, _ = _request_next_rain(_payload(precipitation=precipitation))

    assert response.status_code == 200
    assert response.json() == {
        "start_time": "2026-08-27T13:00",
        "end_time": "2026-08-27T14:00",
        "total_precipitation": 0.004,
        "peak_time": "2026-08-27T13:00",
    }


def test_next_rain_crosses_midnight_in_provider_local_time():
    local_start = datetime(2026, 8, 26, 23)
    times = [
        (local_start + timedelta(hours=offset)).strftime("%Y-%m-%dT%H:%M")
        for offset in range(25)
    ]
    precipitation = [0.0, 1.0] + [0.0] * 23
    fixed_utc = datetime(2026, 8, 26, 20, 30, tzinfo=timezone.utc)

    response, _ = _request_next_rain(
        _payload(times=times, precipitation=precipitation), fixed_utc=fixed_utc
    )

    assert response.status_code == 200
    assert response.json() == {
        "start_time": "2026-08-26T23:00",
        "end_time": "2026-08-27T00:00",
        "total_precipitation": 1.0,
        "peak_time": "2026-08-26T23:00",
    }


def test_next_rain_preserves_trace_amount_when_probability_is_zero():
    precipitation = [0.0, 0.004] + [0.0] * 23

    response, _ = _request_next_rain(_payload(precipitation=precipitation))

    assert response.status_code == 200
    assert response.json()["total_precipitation"] == 0.004


def test_next_rain_rejects_missing_25th_hour_with_bad_gateway():
    payload = _payload(
        times=FORECAST_TIMES[:-1],
        precipitation=[0.0] * 24,
    )

    response, mocked_get = _request_next_rain(payload)

    assert response.status_code == 502
    assert response.json() == {"detail": "Weather data is temporarily unavailable."}
    assert mocked_get.call_count == 1


def test_next_rain_uses_provider_timezone_to_find_the_current_hour():
    local_start = datetime(2026, 8, 26, 7)
    times = [
        (local_start + timedelta(hours=offset)).strftime("%Y-%m-%dT%H:%M")
        for offset in range(25)
    ]
    precipitation = [0.0, 0.8] + [0.0] * 23

    response, _ = _request_next_rain(
        _payload(
            times=times,
            precipitation=precipitation,
            timezone_name="America/New_York",
        )
    )

    assert response.status_code == 200
    assert response.json()["start_time"] == "2026-08-26T07:00"
    assert response.json()["end_time"] == "2026-08-26T08:00"


def test_next_rain_uses_one_upstream_request_for_25_hour_window():
    _, mocked_get = _request_next_rain(_payload())

    assert mocked_get.call_count == 1
    args, kwargs = mocked_get.call_args
    assert args[0] == OPEN_METEO_FORECAST_BASE_URL
    assert kwargs["params"]["forecast_hours"] == 25
    assert kwargs["params"]["hourly"] == ",".join(HOURLY_FIELDS)


def test_overview_and_next_rain_return_the_same_event_for_same_forecast():
    precipitation = [0.5, 1.25] + [0.0] * 23
    overview_payload = _payload(precipitation=precipitation)
    next_payload = _payload(precipitation=precipitation)
    responses = [_mock_response(overview_payload), _mock_response(next_payload)]

    with mock.patch(
        "app.weather.open_meteo.datetime", _FixedDatetime
    ), mock.patch(
        "app.weather.open_meteo.httpx.get", side_effect=responses
    ) as mocked_get:
        overview = client.get(
            "/weather/overview",
            params={"latitude": 41.0082, "longitude": 28.9784, "location": "İstanbul"},
        )
        next_rain = client.get(
            "/weather/rain/next",
            params={"latitude": 41.0082, "longitude": 28.9784},
        )

    assert overview.status_code == 200
    assert next_rain.status_code == 200
    assert overview.json()["next_rain"] == next_rain.json()
    assert mocked_get.call_count == 2
    assert mocked_get.call_args_list[0].kwargs["params"]["forecast_hours"] == 25
    assert mocked_get.call_args_list[1].kwargs["params"]["forecast_hours"] == 25
