from unittest import mock

from fastapi.testclient import TestClient

from app.main import app
from app.weather.models import HourlyWeather, RainEvent
from app.weather.rain import find_next_rain_event, find_rain_events

client = TestClient(app)


def _hour(time: str, precipitation: float) -> HourlyWeather:
    return HourlyWeather(
        time=time,
        temperature=25.0,
        precipitation=precipitation,
        precipitation_probability=0,
        weather_code=1,
        wind_speed=5.0,
    )


def test_single_rain_event():
    hourly = [
        _hour("2026-08-26T14:00", 0.0),
        _hour("2026-08-26T15:00", 0.4),
        _hour("2026-08-26T16:00", 2.1),
        _hour("2026-08-26T17:00", 1.2),
        _hour("2026-08-26T18:00", 0.0),
    ]
    events = find_rain_events(hourly)
    assert len(events) == 1
    assert events[0].start_time == "2026-08-26T15:00"
    assert events[0].end_time == "2026-08-26T18:00"
    assert events[0].total_precipitation == 3.7
    assert events[0].peak_time == "2026-08-26T16:00"


def test_two_separate_events():
    hourly = [
        _hour("2026-08-26T14:00", 0.0),
        _hour("2026-08-26T15:00", 0.5),
        _hour("2026-08-26T16:00", 0.0),
        _hour("2026-08-26T17:00", 1.0),
        _hour("2026-08-26T18:00", 0.0),
    ]
    events = find_rain_events(hourly)
    assert len(events) == 2
    assert events[0].start_time == "2026-08-26T15:00"
    assert events[0].end_time == "2026-08-26T16:00"
    assert events[0].total_precipitation == 0.5
    assert events[0].peak_time == "2026-08-26T15:00"
    assert events[1].start_time == "2026-08-26T17:00"
    assert events[1].end_time == "2026-08-26T18:00"
    assert events[1].total_precipitation == 1.0
    assert events[1].peak_time == "2026-08-26T17:00"


def test_no_rain():
    hourly = [
        _hour("2026-08-26T14:00", 0.0),
        _hour("2026-08-26T15:00", 0.0),
        _hour("2026-08-26T16:00", 0.0),
    ]
    assert find_rain_events(hourly) == []


def test_single_rainy_hour():
    hourly = [
        _hour("2026-08-26T17:00", 2.0),
        _hour("2026-08-26T18:00", 0.0),
    ]
    events = find_rain_events(hourly)
    assert len(events) == 1
    assert events[0].start_time == "2026-08-26T17:00"
    assert events[0].end_time == "2026-08-26T18:00"
    assert events[0].total_precipitation == 2.0
    assert events[0].peak_time == "2026-08-26T17:00"


def test_last_record_is_rainy():
    hourly = [
        _hour("2026-08-26T22:00", 0.0),
        _hour("2026-08-26T23:00", 1.2),
    ]
    events = find_rain_events(hourly)
    assert len(events) == 1
    assert events[0].start_time == "2026-08-26T23:00"
    assert events[0].end_time == "2026-08-27T00:00"
    assert events[0].total_precipitation == 1.2
    assert events[0].peak_time == "2026-08-26T23:00"


def test_equal_peak_uses_first():
    hourly = [
        _hour("2026-08-26T15:00", 2.0),
        _hour("2026-08-26T16:00", 2.0),
        _hour("2026-08-26T17:00", 0.0),
    ]
    events = find_rain_events(hourly)
    assert len(events) == 1
    assert events[0].peak_time == "2026-08-26T15:00"


def test_empty_list():
    assert find_rain_events([]) == []


def test_all_rainy():
    hourly = [
        _hour("2026-08-26T14:00", 1.0),
        _hour("2026-08-26T15:00", 2.0),
        _hour("2026-08-26T16:00", 0.5),
    ]
    events = find_rain_events(hourly)
    assert len(events) == 1
    assert events[0].start_time == "2026-08-26T14:00"
    assert events[0].end_time == "2026-08-26T17:00"
    assert events[0].total_precipitation == 3.5
    assert events[0].peak_time == "2026-08-26T15:00"


def _hourly_payload(times, precipitations):
    return {
        "hourly": {
            "time": times,
            "temperature_2m": [25.0] * len(times),
            "precipitation": precipitations,
            "precipitation_probability": [0] * len(times),
            "weather_code": [1] * len(times),
            "wind_speed_10m": [5.0] * len(times),
        }
    }


def _mock_response(payload):
    response = mock.Mock()
    response.raise_for_status = mock.Mock()
    response.json = mock.Mock(return_value=payload)
    return response


def test_rain_endpoint_returns_events():
    times = [
        "2026-08-26T14:00",
        "2026-08-26T15:00",
        "2026-08-26T16:00",
        "2026-08-26T17:00",
        "2026-08-26T18:00",
    ]
    precipitations = [0.0, 0.4, 2.1, 1.2, 0.0]
    payload = _hourly_payload(times, precipitations)
    with mock.patch(
        "app.weather.open_meteo.httpx.get", return_value=_mock_response(payload)
    ):
        response = client.get("/weather/rain")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0] == {
        "start_time": "2026-08-26T15:00",
        "end_time": "2026-08-26T18:00",
        "total_precipitation": 3.7,
        "peak_time": "2026-08-26T16:00",
    }


def test_rain_endpoint_no_rain():
    times = ["2026-08-26T14:00", "2026-08-26T15:00", "2026-08-26T16:00"]
    precipitations = [0.0, 0.0, 0.0]
    payload = _hourly_payload(times, precipitations)
    with mock.patch(
        "app.weather.open_meteo.httpx.get", return_value=_mock_response(payload)
    ):
        response = client.get("/weather/rain")

    assert response.status_code == 200
    assert response.json() == []


def _event(start: str, end: str, total: float = 1.0, peak: str = "") -> RainEvent:
    return RainEvent(
        start_time=start,
        end_time=end,
        total_precipitation=total,
        peak_time=peak or start,
    )


def test_next_rain_future_event():
    events = [_event("2026-08-26T17:00", "2026-08-26T20:00")]
    result = find_next_rain_event(events, "2026-08-26T14:00")
    assert result is not None
    assert result.start_time == "2026-08-26T17:00"


def test_next_rain_event_in_progress():
    events = [_event("2026-08-26T17:00", "2026-08-26T20:00")]
    result = find_next_rain_event(events, "2026-08-26T18:00")
    assert result is not None
    assert result.start_time == "2026-08-26T17:00"


def test_next_rain_event_ended():
    events = [_event("2026-08-26T17:00", "2026-08-26T20:00")]
    result = find_next_rain_event(events, "2026-08-26T20:00")
    assert result is None


def test_next_rain_skips_past_event():
    events = [
        _event("2026-08-26T10:00", "2026-08-26T12:00"),
        _event("2026-08-26T17:00", "2026-08-26T20:00"),
    ]
    result = find_next_rain_event(events, "2026-08-26T14:00")
    assert result is not None
    assert result.start_time == "2026-08-26T17:00"


def test_next_rain_empty_list():
    assert find_next_rain_event([], "2026-08-26T14:00") is None


def test_next_rain_all_past():
    events = [
        _event("2026-08-26T10:00", "2026-08-26T12:00"),
        _event("2026-08-26T13:00", "2026-08-26T14:00"),
    ]
    assert find_next_rain_event(events, "2026-08-26T15:00") is None


def test_next_rain_unordered_input():
    events = [
        _event("2026-08-26T21:00", "2026-08-26T23:00"),
        _event("2026-08-26T17:00", "2026-08-26T19:00"),
    ]
    result = find_next_rain_event(events, "2026-08-26T14:00")
    assert result is not None
    assert result.start_time == "2026-08-26T17:00"


def test_rain_next_endpoint_with_rain():
    times = [
        "2026-08-26T14:00",
        "2026-08-26T15:00",
        "2026-08-26T16:00",
        "2026-08-26T17:00",
        "2026-08-26T18:00",
    ]
    precipitations = [0.0, 0.4, 2.1, 1.2, 0.0]
    payload = _hourly_payload(times, precipitations)
    with mock.patch(
        "app.weather.open_meteo.httpx.get", return_value=_mock_response(payload)
    ), mock.patch(
        "app.main.datetime"
    ) as mock_dt:
        from datetime import datetime as real_dt
        from zoneinfo import ZoneInfo
        mock_dt.now.return_value = real_dt(2026, 8, 26, 14, 30, tzinfo=ZoneInfo("Europe/Istanbul"))
        response = client.get("/weather/rain/next")

    assert response.status_code == 200
    data = response.json()
    assert data is not None
    assert data["start_time"] == "2026-08-26T15:00"
    assert data["end_time"] == "2026-08-26T18:00"


def test_rain_next_endpoint_no_rain():
    times = ["2026-08-26T14:00", "2026-08-26T15:00", "2026-08-26T16:00"]
    precipitations = [0.0, 0.0, 0.0]
    payload = _hourly_payload(times, precipitations)
    with mock.patch(
        "app.weather.open_meteo.httpx.get", return_value=_mock_response(payload)
    ):
        response = client.get("/weather/rain/next")

    assert response.status_code == 200
    assert response.json() is None
