from datetime import datetime, timedelta

from app.weather.models import HourlyWeather, RainEvent


def find_rain_events(hourly: list[HourlyWeather]) -> list[RainEvent]:
    if not hourly:
        return []

    events: list[RainEvent] = []
    i = 0
    n = len(hourly)

    while i < n:
        if hourly[i].precipitation > 0:
            start_idx = i
            total = 0.0
            peak_precip = -1.0
            peak_idx = i

            while i < n and hourly[i].precipitation > 0:
                total += hourly[i].precipitation
                if hourly[i].precipitation > peak_precip:
                    peak_precip = hourly[i].precipitation
                    peak_idx = i
                i += 1

            if i < n:
                end_time = _parse_time(hourly[i].time)
            else:
                end_time = _parse_time(hourly[i - 1].time) + timedelta(hours=1)

            events.append(RainEvent(
                start_time=hourly[start_idx].time,
                end_time=_format_time(end_time),
                total_precipitation=round(total, 2),
                peak_time=hourly[peak_idx].time,
            ))
        else:
            i += 1

    return events


def find_next_rain_event(
    events: list[RainEvent],
    now: str,
) -> RainEvent | None:
    now_dt = _parse_time(now)
    candidates = [e for e in events if _parse_time(e.end_time) > now_dt]
    if not candidates:
        return None
    return min(candidates, key=lambda e: _parse_time(e.start_time))


def _parse_time(value: str) -> datetime:
    try:
        return datetime.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f"Invalid ISO timestamp: {value}") from exc


def _format_time(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:00")
