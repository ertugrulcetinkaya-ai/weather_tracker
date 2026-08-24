from datetime import datetime
from zoneinfo import ZoneInfo

import httpx

from app.weather.models import CurrentWeather

OPEN_METEO_ECMWF_BASE_URL = "https://api.open-meteo.com/v1/ecmwf"

ELAZIG_LOCATION = "Elazığ"
ELAZIG_LATITUDE = 38.6743
ELAZIG_LONGITUDE = 39.2232
ELAZIG_TIMEZONE = "Europe/Istanbul"

HOURLY_FIELDS = [
    "temperature_2m",
    "relative_humidity_2m",
    "apparent_temperature",
    "weather_code",
    "wind_speed_10m",
]


class WeatherFetchError(Exception):
    pass


def _select_hour_index(times, target_time):
    if target_time in times:
        return times.index(target_time)
    raise WeatherFetchError(f"Hourly data does not include {target_time}")


def get_current_weather() -> CurrentWeather:
    params = {
        "latitude": ELAZIG_LATITUDE,
        "longitude": ELAZIG_LONGITUDE,
        "hourly": ",".join(HOURLY_FIELDS),
        "timezone": ELAZIG_TIMEZONE,
        "forecast_hours": 24,
    }
    response = httpx.get(OPEN_METEO_ECMWF_BASE_URL, params=params, timeout=10.0)
    if response.status_code != 200:
        raise WeatherFetchError(f"Open-Meteo returned HTTP {response.status_code}")
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

    now = datetime.now(ZoneInfo(ELAZIG_TIMEZONE)).replace(minute=0, second=0, microsecond=0)
    target_time = now.strftime("%Y-%m-%dT%H:00")
    index = _select_hour_index(times, target_time)

    selected = {
        "temperature": hourly["temperature_2m"][index],
        "apparent_temperature": hourly["apparent_temperature"][index],
        "humidity": hourly["relative_humidity_2m"][index],
        "wind_speed": hourly["wind_speed_10m"][index],
        "weather_code": hourly["weather_code"][index],
    }
    if any(value is None for value in selected.values()):
        raise WeatherFetchError("Open-Meteo hourly value is missing for the current hour")

    return CurrentWeather(
        location=ELAZIG_LOCATION,
        temperature=selected["temperature"],
        apparent_temperature=selected["apparent_temperature"],
        humidity=selected["humidity"],
        wind_speed=selected["wind_speed"],
        weather_code=selected["weather_code"],
        time=target_time,
    )
