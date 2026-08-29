from __future__ import annotations

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

    times = hourly.get("time")
    if (
        not isinstance(times, list)
        or not times
        or any(not isinstance(value, str) for value in times)
    ):
        raise WeatherFetchError("Open-Meteo response is missing 'hourly.time'")

    validated: dict[str, list[Any]] = {}
    for field in fields:
        values = hourly.get(field)
        if not isinstance(values, list) or len(values) != len(times):
            raise WeatherFetchError(
                f"Open-Meteo response is missing hourly field: {field}"
            )
        validated[field] = values
    return times, validated


def _require_number(value: Any, *, field: str, time: str) -> int | float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise WeatherFetchError(
            f"Open-Meteo response is missing hourly value for {field} at {time}"
        )
    return value


def _build_current_weather(
    times: list[str],
    hourly: dict[str, list[Any]],
    *,
    location: str,
) -> CurrentWeather:
    now = datetime.now(ZoneInfo(ELAZIG_TIMEZONE))
    target_time = now.strftime("%Y-%m-%dT%H:00")
    index = _select_hour_index(times, target_time)

    selected = {
        field: _require_number(hourly[field][index], field=field, time=times[index])
        for field in CURRENT_FIELDS
    }
    return CurrentWeather(
        location=location,
        temperature=selected["temperature_2m"],
        apparent_temperature=selected["apparent_temperature"],
        humidity=selected["relative_humidity_2m"],
        wind_speed=selected["wind_speed_10m"],
        weather_code=selected["weather_code"],
        time=times[index],
    )


def _build_hourly_weather(
    times: list[str],
    hourly: dict[str, list[Any]],
) -> list[HourlyWeather]:
    points: list[HourlyWeather] = []
    for index, time in enumerate(times):
        values = {
            field: _require_number(hourly[field][index], field=field, time=time)
            for field in HOURLY_FIELDS
        }
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
