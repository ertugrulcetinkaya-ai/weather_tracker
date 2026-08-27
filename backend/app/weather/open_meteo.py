from datetime import datetime
from zoneinfo import ZoneInfo

import httpx

from app.weather.models import CurrentWeather, HourlyWeather, LocationSearchResult

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


class WeatherFetchError(Exception):
    pass


def _select_hour_index(times: list, target: str) -> int:
    try:
        return times.index(target)
    except ValueError:
        local_hour = target[-5:]
        for index, value in enumerate(times):
            if value[-5:] == local_hour:
                return index
    raise WeatherFetchError("Open-Meteo response does not include the current hour")


def get_current_weather(
    latitude: float = ELAZIG_LATITUDE,
    longitude: float = ELAZIG_LONGITUDE,
    location: str = ELAZIG_LOCATION,
) -> CurrentWeather:
    now = datetime.now(ZoneInfo(ELAZIG_TIMEZONE))
    target_time = now.strftime("%Y-%m-%dT%H:00")
    response = httpx.get(
        OPEN_METEO_ECMWF_BASE_URL,
        params={
            "latitude": latitude,
            "longitude": longitude,
            "hourly": ",".join(CURRENT_FIELDS),
            "timezone": ELAZIG_TIMEZONE,
            "forecast_hours": 24,
        },
        timeout=10.0,
    )
    response.raise_for_status()
    payload = response.json()
    hourly = payload.get("hourly")
    if not isinstance(hourly, dict):
        raise WeatherFetchError("Open-Meteo response is missing 'hourly'")
    times = hourly.get("time")
    if not isinstance(times, list) or not times:
        raise WeatherFetchError("Open-Meteo response is missing 'hourly.time'")
    for field in CURRENT_FIELDS:
        values = hourly.get(field)
        if not isinstance(values, list) or len(values) != len(times):
            raise WeatherFetchError(f"Open-Meteo response is missing hourly field: {field}")

    index = _select_hour_index(times, target_time)
    selected = {field: hourly[field][index] for field in CURRENT_FIELDS}
    for field, value in selected.items():
        if value is None:
            raise WeatherFetchError(f"Open-Meteo response is missing current hour value for: {field}")

    return CurrentWeather(
        location=location,
        temperature=selected["temperature_2m"],
        apparent_temperature=selected["apparent_temperature"],
        humidity=selected["relative_humidity_2m"],
        wind_speed=selected["wind_speed_10m"],
        weather_code=selected["weather_code"],
        time=times[index],
    )


def fetch_hourly_weather(
    latitude: float = ELAZIG_LATITUDE,
    longitude: float = ELAZIG_LONGITUDE,
) -> list[HourlyWeather]:
    try:
        response = httpx.get(
            OPEN_METEO_ECMWF_BASE_URL,
            params={
                "latitude": latitude,
                "longitude": longitude,
                "hourly": ",".join(HOURLY_FIELDS),
                "timezone": ELAZIG_TIMEZONE,
                "forecast_hours": 24,
            },
            timeout=10.0,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise WeatherFetchError(f"Open-Meteo request failed: {exc}") from exc

    payload = response.json()
    hourly = payload.get("hourly")
    if not isinstance(hourly, dict):
        raise WeatherFetchError("Open-Meteo response is missing 'hourly'")
    times = hourly.get("time")
    if not isinstance(times, list) or not times:
        raise WeatherFetchError("Open-Meteo response is missing 'hourly.time'")
    for field in HOURLY_FIELDS:
        values = hourly.get(field)
        if not isinstance(values, list) or len(values) != len(times):
            raise WeatherFetchError(f"Open-Meteo response is missing hourly field: {field}")

    points: list[HourlyWeather] = []
    for i in range(len(times)):
        temperature = hourly["temperature_2m"][i]
        precipitation = hourly["precipitation"][i]
        weather_code = hourly["weather_code"][i]
        wind_speed = hourly["wind_speed_10m"][i]
        if any(v is None for v in (temperature, precipitation, weather_code, wind_speed)):
            raise WeatherFetchError(f"Open-Meteo response is missing hourly value at {times[i]}")
        points.append(HourlyWeather(
            time=times[i],
            temperature=temperature,
            precipitation=precipitation,
            weather_code=weather_code,
            wind_speed=wind_speed,
        ))
    return points


def search_locations(query: str) -> list[LocationSearchResult]:
    try:
        response = httpx.get(
            OPEN_METEO_GEOCODING_BASE_URL,
            params={
                "name": query,
                "count": 8,
                "language": "tr",
                "format": "json",
                "countryCode": "TR",
            },
            timeout=10.0,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise WeatherFetchError(f"Open-Meteo geocoding request failed: {exc}") from exc

    try:
        payload = response.json()
    except ValueError as exc:
        raise WeatherFetchError("Open-Meteo geocoding response is not valid JSON") from exc
    if not isinstance(payload, dict):
        raise WeatherFetchError("Open-Meteo geocoding response is not an object")

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
