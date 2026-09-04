from __future__ import annotations

import math
import re
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import httpx

from app.weather.models import (
    CurrentWeather,
    HourlyWeather,
    LocationSearchResult,
    WeatherOverview,
)
from app.weather.rain import find_next_rain_event, find_rain_events

OPEN_METEO_ECMWF_BASE_URL = "https://api.open-meteo.com/v1/ecmwf"
OPEN_METEO_GEOCODING_BASE_URL = "https://geocoding-api.open-meteo.com/v1/search"
ELAZIG_LATITUDE = 38.6743
ELAZIG_LONGITUDE = 39.2232
ELAZIG_LOCATION = "Elazığ"
ELAZIG_TIMEZONE = "Europe/Istanbul"

# Open-Meteo returns local wall-clock timestamps at minute precision.
HOURLY_TIME_FORMAT = "%Y-%m-%dT%H:%M"
HOURLY_TIME_PATTERN = re.compile(r"\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}\Z")

# Consumed fields that the provider can never send as a negative number.
NON_NEGATIVE_FIELDS = frozenset({"precipitation", "wind_speed_10m"})

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
    "weather_code",
    "wind_speed_10m",
)

OVERVIEW_FIELDS = CURRENT_FIELDS + ("precipitation",)


class WeatherFetchError(Exception):
    pass


def _missing_hourly_value(field: str, time: str) -> WeatherFetchError:
    return WeatherFetchError(
        f"Open-Meteo response is missing hourly value for {field} at {time}"
    )


def _invalid_hourly_value(field: str, time: str, problem: str) -> WeatherFetchError:
    return WeatherFetchError(
        f"Open-Meteo response has {problem} hourly value for {field} at {time}"
    )


def _require_finite_number(value: Any, *, field: str, time: str) -> int | float:
    """Return the provider number itself, rejecting anything not numeric and finite.

    Integral provider values are kept as Python ints instead of being routed
    through float, because float silently rounds integers above IEEE-754 exact
    precision. Fields whose public contract is a float collapse the number in
    _require_public_float instead.
    """
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise _missing_hourly_value(field, time)
    if isinstance(value, int):
        return value
    if not math.isfinite(value):
        raise _invalid_hourly_value(field, time, "non-finite")
    return value


def _require_public_float(value: int | float, *, field: str, time: str) -> float:
    """Collapse a validated provider number into a representable public float."""
    try:
        number = float(value)
    except OverflowError as exc:
        raise _invalid_hourly_value(field, time, "non-finite") from exc
    if not math.isfinite(number):
        raise _invalid_hourly_value(field, time, "non-finite")
    return number


def _require_integral_number(value: int | float, *, field: str, time: str) -> int:
    if isinstance(value, int):
        return value
    if not value.is_integer():
        raise _invalid_hourly_value(field, time, "non-integer")
    return int(value)


def _require_non_negative(value: float, *, field: str, time: str) -> float:
    if value < 0:
        raise _invalid_hourly_value(field, time, "negative")
    return value


def _require_humidity_percent(value: int | float, *, field: str, time: str) -> int:
    humidity = _require_integral_number(value, field=field, time=time)
    if not 0 <= humidity <= 100:
        raise _invalid_hourly_value(field, time, "out-of-range")
    return humidity


def _require_hourly_value(field: str, value: Any, *, time: str) -> Any:
    """Validate one consumed provider value against that field's contract."""
    number = _require_finite_number(value, field=field, time=time)
    if field == "relative_humidity_2m":
        return _require_humidity_percent(number, field=field, time=time)
    if field == "weather_code":
        return _require_integral_number(number, field=field, time=time)
    measured = _require_public_float(number, field=field, time=time)
    if field in NON_NEGATIVE_FIELDS:
        return _require_non_negative(measured, field=field, time=time)
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


def _fetch_hourly_payload(
    fields: tuple[str, ...],
    *,
    latitude: float,
    longitude: float,
) -> tuple[list[str], dict[str, list[Any]]]:
    """Fetch an hourly series and validate every consumed value at the boundary."""

    payload = _request_json(
        OPEN_METEO_ECMWF_BASE_URL,
        params={
            "latitude": latitude,
            "longitude": longitude,
            "hourly": ",".join(fields),
            "timezone": ELAZIG_TIMEZONE,
            "forecast_hours": 24,
        },
        error_context="Open-Meteo request failed",
    )
    hourly = payload.get("hourly")
    if not isinstance(hourly, dict):
        raise WeatherFetchError("Open-Meteo response is missing 'hourly'")

    times = _validate_hourly_times(hourly.get("time"))

    validated: dict[str, list[Any]] = {}
    for field in fields:
        values = hourly.get(field)
        if not isinstance(values, list) or len(values) != len(times):
            raise WeatherFetchError(
                f"Open-Meteo response is missing hourly field: {field}"
            )
        validated[field] = [
            _require_hourly_value(field, value, time=time)
            for value, time in zip(values, times)
        ]
    return times, validated


def _build_current_weather(
    times: list[str],
    hourly: dict[str, list[Any]],
    *,
    location: str,
) -> CurrentWeather:
    now = datetime.now(ZoneInfo(ELAZIG_TIMEZONE))
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
                weather_code=values["weather_code"],
                wind_speed=values["wind_speed_10m"],
            )
        )
    return points


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
    times, hourly = _fetch_hourly_payload(
        CURRENT_FIELDS,
        latitude=latitude,
        longitude=longitude,
    )
    return _build_current_weather(times, hourly, location=location)


def fetch_hourly_weather(
    latitude: float = ELAZIG_LATITUDE,
    longitude: float = ELAZIG_LONGITUDE,
) -> list[HourlyWeather]:
    times, hourly = _fetch_hourly_payload(
        HOURLY_FIELDS,
        latitude=latitude,
        longitude=longitude,
    )
    return _build_hourly_weather(times, hourly)


def get_weather_overview(
    latitude: float = ELAZIG_LATITUDE,
    longitude: float = ELAZIG_LONGITUDE,
    location: str = ELAZIG_LOCATION,
) -> WeatherOverview:
    """Build the complete mobile screen from one upstream forecast request."""

    times, hourly_payload = _fetch_hourly_payload(
        OVERVIEW_FIELDS,
        latitude=latitude,
        longitude=longitude,
    )
    current = _build_current_weather(times, hourly_payload, location=location)
    hourly = _build_hourly_weather(times, hourly_payload)
    events = find_rain_events(hourly)
    now = datetime.now(ZoneInfo(ELAZIG_TIMEZONE)).strftime("%Y-%m-%dT%H:%M")
    return WeatherOverview(
        current=current,
        hourly=hourly,
        next_rain=find_next_rain_event(events, now),
    )


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
