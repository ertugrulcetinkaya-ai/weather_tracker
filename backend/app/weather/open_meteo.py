from datetime import datetime
from zoneinfo import ZoneInfo

import httpx

from app.weather.models import CurrentWeather, HourlyWeather

OPEN_METEO_ECMWF_BASE_URL = "https://api.open-meteo.com/v1/ecmwf"
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


def get_current_weather() -> CurrentWeather:
    now = datetime.now(ZoneInfo(ELAZIG_TIMEZONE))
    target_time = now.strftime("%Y-%m-%dT%H:00")
    response = httpx.get(
        OPEN_METEO_ECMWF_BASE_URL,
        params={
            "latitude": ELAZIG_LATITUDE,
            "longitude": ELAZIG_LONGITUDE,
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
        location=ELAZIG_LOCATION,
        temperature=selected["temperature_2m"],
        apparent_temperature=selected["apparent_temperature"],
        humidity=selected["relative_humidity_2m"],
        wind_speed=selected["wind_speed_10m"],
        weather_code=selected["weather_code"],
        time=times[index],
    )


def fetch_hourly_weather() -> list[HourlyWeather]:
    try:
        response = httpx.get(
            OPEN_METEO_ECMWF_BASE_URL,
            params={
                "latitude": ELAZIG_LATITUDE,
                "longitude": ELAZIG_LONGITUDE,
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
