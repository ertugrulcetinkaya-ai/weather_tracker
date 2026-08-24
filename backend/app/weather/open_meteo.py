import httpx

from app.weather.models import CurrentWeather

OPEN_METEO_ECMWF_BASE_URL = "https://api.open-meteo.com/v1/ecmwf"

ELAZIG_LOCATION = "Elazığ"
ELAZIG_LATITUDE = 38.6743
ELAZIG_LONGITUDE = 39.2232
ELAZIG_TIMEZONE = "Europe/Istanbul"

CURRENT_FIELDS = [
    "temperature_2m",
    "relative_humidity_2m",
    "apparent_temperature",
    "weather_code",
    "wind_speed_10m",
]


class WeatherFetchError(Exception):
    pass


def get_current_weather() -> CurrentWeather:
    params = {
        "latitude": ELAZIG_LATITUDE,
        "longitude": ELAZIG_LONGITUDE,
        "current": ",".join(CURRENT_FIELDS),
        "timezone": ELAZIG_TIMEZONE,
    }
    response = httpx.get(OPEN_METEO_ECMWF_BASE_URL, params=params, timeout=10.0)
    if response.status_code != 200:
        raise WeatherFetchError(f"Open-Meteo returned HTTP {response.status_code}")
    payload = response.json()
    current = payload.get("current")
    if not isinstance(current, dict):
        raise WeatherFetchError("Open-Meteo response is missing 'current'")
    try:
        return CurrentWeather(
            location=ELAZIG_LOCATION,
            temperature=current["temperature_2m"],
            apparent_temperature=current["apparent_temperature"],
            humidity=current["relative_humidity_2m"],
            wind_speed=current["wind_speed_10m"],
            weather_code=current["weather_code"],
            time=current["time"],
        )
    except KeyError as exc:
        raise WeatherFetchError(f"Open-Meteo response is missing field: {exc}") from exc
