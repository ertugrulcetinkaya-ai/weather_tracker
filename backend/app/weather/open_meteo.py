from __future__ import annotations

import math
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx

from app.weather.models import (
    CurrentWeather,
    DailyWeather,
    HourlyWeather,
    LocationSearchResult,
    RainEvent,
    WeatherOverview,
)
from app.weather.rain import find_next_rain_event, find_rain_events

OPEN_METEO_FORECAST_BASE_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_GEOCODING_BASE_URL = "https://geocoding-api.open-meteo.com/v1/search"
ELAZIG_LATITUDE = 38.6743
ELAZIG_LONGITUDE = 39.2232
ELAZIG_LOCATION = "Elazığ"

# Open-Meteo returns local wall-clock timestamps at minute precision.
HOURLY_TIME_FORMAT = "%Y-%m-%dT%H:%M"
HOURLY_TIME_PATTERN = re.compile(r"\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}\Z")

# The Generic Forecast API returns local calendar dates at day precision, and the
# mobile screen always consumes exactly one week of them.
DAILY_DATE_FORMAT = "%Y-%m-%d"
DAILY_DATE_PATTERN = re.compile(r"\A\d{4}-\d{2}-\d{2}\Z")
FORECAST_DAYS = 7
FORECAST_HOURS = 24

# Consumed fields that the provider can never send as a negative number.
NON_NEGATIVE_FIELDS = frozenset(
    {"precipitation", "precipitation_sum", "wind_speed_10m"}
)

# Consumed fields whose public contract is an integral percentage of 0..100.
PERCENTAGE_FIELDS = frozenset(
    {"relative_humidity_2m", "precipitation_probability", "precipitation_probability_max"}
)

CURRENT_FIELDS = (
    "temperature_2m",
    "relative_humidity_2m",
    "apparent_temperature",
    "weather_code",
    "wind_speed_10m",
)

HOURLY_FIELDS = (
    "temperature_2m",
    "precipitation",
    "precipitation_probability",
    "weather_code",
    "wind_speed_10m",
)

OVERVIEW_FIELDS = CURRENT_FIELDS + ("precipitation", "precipitation_probability")

DAILY_FIELDS = (
    "weather_code",
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_sum",
    "precipitation_probability_max",
)


class WeatherFetchError(Exception):
    pass


def _missing_value(
    field: str,
    time: str,
    *,
    series: str = "hourly",
) -> WeatherFetchError:
    return WeatherFetchError(
        f"Open-Meteo response is missing {series} value for {field} at {time}"
    )


def _invalid_value(
    field: str,
    time: str,
    problem: str,
    *,
    series: str = "hourly",
) -> WeatherFetchError:
    return WeatherFetchError(
        f"Open-Meteo response has {problem} {series} value for {field} at {time}"
    )


def _require_finite_number(
    value: Any,
    *,
    field: str,
    time: str,
    series: str = "hourly",
) -> int | float:
    """Return the provider number itself, rejecting anything not numeric and finite.

    Integral provider values are kept as Python ints instead of being routed
    through float, because float silently rounds integers above IEEE-754 exact
    precision. Fields whose public contract is a float collapse the number in
    _require_public_float instead.
    """
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise _missing_value(field, time, series=series)
    if isinstance(value, int):
        return value
    if not math.isfinite(value):
        raise _invalid_value(field, time, "non-finite", series=series)
    return value


def _require_public_float(
    value: int | float,
    *,
    field: str,
    time: str,
    series: str = "hourly",
) -> float:
    """Collapse a validated provider number into a representable public float."""
    try:
        number = float(value)
    except OverflowError as exc:
        raise _invalid_value(field, time, "non-finite", series=series) from exc
    if not math.isfinite(number):
        raise _invalid_value(field, time, "non-finite", series=series)
    return number


def _require_integral_number(
    value: int | float,
    *,
    field: str,
    time: str,
    series: str = "hourly",
) -> int:
    if isinstance(value, int):
        return value
    if not value.is_integer():
        raise _invalid_value(field, time, "non-integer", series=series)
    return int(value)


def _require_non_negative(
    value: float,
    *,
    field: str,
    time: str,
    series: str = "hourly",
) -> float:
    if value < 0:
        raise _invalid_value(field, time, "negative", series=series)
    return value


def _require_percent(
    value: int | float,
    *,
    field: str,
    time: str,
    series: str = "hourly",
) -> int:
    percent = _require_integral_number(value, field=field, time=time, series=series)
    if not 0 <= percent <= 100:
        raise _invalid_value(field, time, "out-of-range", series=series)
    return percent


def _require_provider_value(
    field: str,
    value: Any,
    *,
    time: str,
    series: str,
) -> Any:
    """Validate one consumed provider value against that field's contract."""
    number = _require_finite_number(value, field=field, time=time, series=series)
    if field in PERCENTAGE_FIELDS:
        return _require_percent(number, field=field, time=time, series=series)
    if field == "weather_code":
        return _require_integral_number(number, field=field, time=time, series=series)
    measured = _require_public_float(number, field=field, time=time, series=series)
    if field in NON_NEGATIVE_FIELDS:
        return _require_non_negative(measured, field=field, time=time, series=series)
    return measured


def _parse_hourly_time(value: str) -> datetime:
    if HOURLY_TIME_PATTERN.match(value) is None:
        raise WeatherFetchError(
            f"Open-Meteo response has malformed hourly time: {value}"
        )
    try:
        return datetime.strptime(value, HOURLY_TIME_FORMAT)
    except ValueError as exc:
        raise WeatherFetchError(
            f"Open-Meteo response has invalid hourly time: {value}"
        ) from exc


def _validate_hourly_times(times: Any) -> list[str]:
    if (
        not isinstance(times, list)
        or not times
        or any(not isinstance(value, str) for value in times)
    ):
        raise WeatherFetchError("Open-Meteo response is missing 'hourly.time'")

    parsed = [_parse_hourly_time(value) for value in times]
    for previous, current in zip(parsed, parsed[1:]):
        if current <= previous:
            raise WeatherFetchError(
                "Open-Meteo response hourly times must be strictly increasing"
            )
    return times


def _parse_daily_date(value: str) -> datetime:
    if DAILY_DATE_PATTERN.match(value) is None:
        raise WeatherFetchError(
            f"Open-Meteo response has malformed daily date: {value}"
        )
    try:
        return datetime.strptime(value, DAILY_DATE_FORMAT)
    except ValueError as exc:
        raise WeatherFetchError(
            f"Open-Meteo response has invalid daily date: {value}"
        ) from exc


def _validate_daily_dates(dates: Any) -> list[str]:
    if (
        not isinstance(dates, list)
        or len(dates) != FORECAST_DAYS
        or any(not isinstance(value, str) for value in dates)
    ):
        raise WeatherFetchError(
            f"Open-Meteo response must contain exactly {FORECAST_DAYS} daily dates"
        )

    parsed = [_parse_daily_date(value) for value in dates]
    for previous, current in zip(parsed, parsed[1:]):
        if current <= previous:
            raise WeatherFetchError(
                "Open-Meteo response daily dates must be strictly increasing"
            )
    return dates


def _validate_daily_series(
    payload: dict[str, Any],
    fields: tuple[str, ...],
) -> tuple[list[str], dict[str, list[Any]]]:
    """Validate the daily block of one Generic Forecast response."""

    daily = payload.get("daily")
    if not isinstance(daily, dict):
        raise WeatherFetchError("Open-Meteo response is missing 'daily'")

    dates = _validate_daily_dates(daily.get("time"))
    validated: dict[str, list[Any]] = {}
    for field in fields:
        values = daily.get(field)
        if not isinstance(values, list) or len(values) != len(dates):
            raise WeatherFetchError(
                f"Open-Meteo response is missing daily field: {field}"
            )
        validated[field] = [
            _require_provider_value(field, value, time=date, series="daily")
            for value, date in zip(values, dates)
        ]

    for date, temperature_min, temperature_max in zip(
        dates,
        validated["temperature_2m_min"],
        validated["temperature_2m_max"],
    ):
        if temperature_min > temperature_max:
            raise WeatherFetchError(
                f"Open-Meteo response has a daily minimum above its maximum on {date}"
            )
    return dates, validated


@dataclass(frozen=True)
class ForecastPayload:
    """Validated provider series of one Generic Forecast request."""

    timezone: ZoneInfo
    times: list[str]
    hourly: dict[str, list[Any]]
    dates: list[str]
    daily: dict[str, list[Any]] | None

    def require_daily(self) -> dict[str, list[Any]]:
        """Return the validated daily series of a request that asked for one."""
        if self.daily is None or not self.dates:
            raise WeatherFetchError("Open-Meteo response is missing 'daily'")
        return self.daily


def _validate_provider_timezone(value: Any) -> ZoneInfo:
    if not isinstance(value, str) or not value.strip():
        raise WeatherFetchError("Open-Meteo response has an invalid 'timezone'")
    try:
        return ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise WeatherFetchError(
            f"Open-Meteo response has an invalid 'timezone': {value}"
        ) from exc


def _request_json(
    url: str,
    *,
    params: dict[str, Any],
    error_context: str,
) -> dict[str, Any]:
    try:
        response = httpx.get(url, params=params, timeout=10.0)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise WeatherFetchError(f"{error_context}: {exc}") from exc

    try:
        payload = response.json()
    except ValueError as exc:
        raise WeatherFetchError(f"{error_context}: response is not valid JSON") from exc
    if not isinstance(payload, dict):
        raise WeatherFetchError(f"{error_context}: response is not an object")
    return payload


def _fetch_forecast_payload(
    hourly_fields: tuple[str, ...],
    *,
    latitude: float,
    longitude: float,
    daily_fields: tuple[str, ...] | None = None,
) -> ForecastPayload:
    """Fetch one forecast request and validate every consumed value at the boundary."""

    params: dict[str, Any] = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": ",".join(hourly_fields),
        "timezone": "auto",
        "forecast_days": FORECAST_DAYS,
        "forecast_hours": FORECAST_HOURS,
    }
    if daily_fields is not None:
        params["daily"] = ",".join(daily_fields)

    payload = _request_json(
        OPEN_METEO_FORECAST_BASE_URL,
        params=params,
        error_context="Open-Meteo request failed",
    )
    hourly = payload.get("hourly")
    if not isinstance(hourly, dict):
        raise WeatherFetchError("Open-Meteo response is missing 'hourly'")

    location_timezone = _validate_provider_timezone(payload.get("timezone"))
    times = _validate_hourly_times(hourly.get("time"))

    validated: dict[str, list[Any]] = {}
    for field in hourly_fields:
        values = hourly.get(field)
        if not isinstance(values, list) or len(values) != len(times):
            raise WeatherFetchError(
                f"Open-Meteo response is missing hourly field: {field}"
            )
        validated[field] = [
            _require_provider_value(field, value, time=time, series="hourly")
            for value, time in zip(values, times)
        ]

    if daily_fields is None:
        return ForecastPayload(
            timezone=location_timezone,
            times=times,
            hourly=validated,
            dates=[],
            daily=None,
        )

    dates, daily = _validate_daily_series(payload, daily_fields)
    return ForecastPayload(
        timezone=location_timezone,
        times=times,
        hourly=validated,
        dates=dates,
        daily=daily,
    )


def _build_current_weather(
    times: list[str],
    hourly: dict[str, list[Any]],
    *,
    location: str,
    timezone: ZoneInfo,
) -> CurrentWeather:
    now = datetime.now(timezone)
    target_time = now.strftime("%Y-%m-%dT%H:00")
    index = _select_hour_index(times, target_time)
    time = times[index]

    selected = {field: hourly[field][index] for field in CURRENT_FIELDS}

    return CurrentWeather(
        location=location,
        temperature=selected["temperature_2m"],
        apparent_temperature=selected["apparent_temperature"],
        humidity=selected["relative_humidity_2m"],
        wind_speed=selected["wind_speed_10m"],
        weather_code=selected["weather_code"],
        time=time,
    )


def _build_hourly_weather(
    times: list[str],
    hourly: dict[str, list[Any]],
) -> list[HourlyWeather]:
    points: list[HourlyWeather] = []
    for index, time in enumerate(times):
        values = {field: hourly[field][index] for field in HOURLY_FIELDS}
        points.append(
            HourlyWeather(
                time=time,
                temperature=values["temperature_2m"],
                precipitation=values["precipitation"],
                precipitation_probability=values["precipitation_probability"],
                weather_code=values["weather_code"],
                wind_speed=values["wind_speed_10m"],
            )
        )
    return points


def _select_hourly_window(
    payload: ForecastPayload,
    *,
    start_time: str,
) -> tuple[list[str], dict[str, list[Any]]]:
    start = _select_hour_index(payload.times, start_time)
    end = start + FORECAST_HOURS
    if len(payload.times) < end:
        raise WeatherFetchError(
            f"Open-Meteo response must contain {FORECAST_HOURS} forecast hours"
        )
    return (
        payload.times[start:end],
        {field: values[start:end] for field, values in payload.hourly.items()},
    )


def _build_daily_forecast(
    dates: list[str],
    daily: dict[str, list[Any]],
) -> list[DailyWeather]:
    days: list[DailyWeather] = []
    for index, date in enumerate(dates):
        values = {field: daily[field][index] for field in DAILY_FIELDS}
        days.append(
            DailyWeather(
                date=date,
                temperature_max=values["temperature_2m_max"],
                temperature_min=values["temperature_2m_min"],
                precipitation=values["precipitation_sum"],
                precipitation_probability=values["precipitation_probability_max"],
                weather_code=values["weather_code"],
            )
        )
    return days


def _select_hour_index(times: list, target: str) -> int:
    try:
        return times.index(target)
    except ValueError as exc:
        raise WeatherFetchError(
            "Open-Meteo response does not include the current hour"
        ) from exc


def get_current_weather(
    latitude: float = ELAZIG_LATITUDE,
    longitude: float = ELAZIG_LONGITUDE,
    location: str = ELAZIG_LOCATION,
) -> CurrentWeather:
    payload = _fetch_forecast_payload(
        CURRENT_FIELDS,
        latitude=latitude,
        longitude=longitude,
    )
    return _build_current_weather(
        payload.times,
        payload.hourly,
        location=location,
        timezone=payload.timezone,
    )


def fetch_hourly_weather(
    latitude: float = ELAZIG_LATITUDE,
    longitude: float = ELAZIG_LONGITUDE,
) -> list[HourlyWeather]:
    payload = _fetch_forecast_payload(
        HOURLY_FIELDS,
        latitude=latitude,
        longitude=longitude,
    )
    return _build_hourly_weather(payload.times, payload.hourly)


def get_weather_overview(
    latitude: float = ELAZIG_LATITUDE,
    longitude: float = ELAZIG_LONGITUDE,
    location: str = ELAZIG_LOCATION,
) -> WeatherOverview:
    """Build the complete mobile screen from one upstream forecast request."""

    payload = _fetch_forecast_payload(
        OVERVIEW_FIELDS,
        latitude=latitude,
        longitude=longitude,
        daily_fields=DAILY_FIELDS,
    )
    start_time = datetime.now(payload.timezone).strftime("%Y-%m-%dT%H:00")
    times, hourly_payload = _select_hourly_window(payload, start_time=start_time)
    current = _build_current_weather(
        times,
        hourly_payload,
        location=location,
        timezone=payload.timezone,
    )
    hourly = _build_hourly_weather(times, hourly_payload)
    daily = _build_daily_forecast(payload.dates, payload.require_daily())
    events = find_rain_events(hourly)
    now = datetime.now(payload.timezone).strftime("%Y-%m-%dT%H:%M")
    return WeatherOverview(
        current=current,
        hourly=hourly,
        daily=daily,
        next_rain=find_next_rain_event(events, now),
    )


def get_next_rain(
    latitude: float = ELAZIG_LATITUDE,
    longitude: float = ELAZIG_LONGITUDE,
) -> RainEvent | None:
    payload = _fetch_forecast_payload(
        HOURLY_FIELDS,
        latitude=latitude,
        longitude=longitude,
    )
    hourly = _build_hourly_weather(payload.times, payload.hourly)
    events = find_rain_events(hourly)
    now = datetime.now(payload.timezone).strftime("%Y-%m-%dT%H:%M")
    return find_next_rain_event(events, now)


def search_locations(query: str) -> list[LocationSearchResult]:
    payload = _request_json(
        OPEN_METEO_GEOCODING_BASE_URL,
        params={
            "name": query,
            "count": 8,
            "language": "tr",
            "format": "json",
            "countryCode": "TR",
        },
        error_context="Open-Meteo geocoding request failed",
    )

    results = payload.get("results")
    if not isinstance(results, list):
        return []

    locations: list[LocationSearchResult] = []
    seen: set[tuple[str, float, float]] = set()
    for item in results:
        if not isinstance(item, dict):
            continue
        name = item.get("name")
        latitude = item.get("latitude")
        longitude = item.get("longitude")
        if not isinstance(name, str) or not name:
            continue
        if isinstance(latitude, bool) or not isinstance(latitude, (int, float)):
            continue
        if isinstance(longitude, bool) or not isinstance(longitude, (int, float)):
            continue
        country_code = item.get("country_code")
        if country_code is not None and country_code != "TR":
            continue
        admin1 = item.get("admin1")
        country = item.get("country")
        identity = (name, float(latitude), float(longitude))
        if identity in seen:
            continue
        seen.add(identity)
        locations.append(LocationSearchResult(
            name=name,
            latitude=float(latitude),
            longitude=float(longitude),
            admin1=admin1 if isinstance(admin1, str) else None,
            country=country if isinstance(country, str) else "Türkiye",
        ))
    return locations
