from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import FastAPI, HTTPException, Query

from app.weather.models import CurrentWeather, RainEvent
from app.weather.open_meteo import (
    ELAZIG_LATITUDE,
    ELAZIG_LOCATION,
    ELAZIG_LONGITUDE,
    ELAZIG_TIMEZONE,
    WeatherFetchError,
    fetch_hourly_weather,
    get_current_weather,
)
from app.weather.rain import find_next_rain_event, find_rain_events

app = FastAPI()


def _validate_coords(
    latitude: Optional[float],
    longitude: Optional[float],
) -> tuple[float, float]:
    if (latitude is None) != (longitude is None):
        raise HTTPException(
            status_code=422,
            detail="latitude and longitude must be provided together",
        )
    if latitude is not None:
        return latitude, longitude
    return ELAZIG_LATITUDE, ELAZIG_LONGITUDE


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/weather/current", response_model=CurrentWeather)
def weather_current(
    latitude: Optional[float] = Query(None, ge=-90, le=90),
    longitude: Optional[float] = Query(None, ge=-180, le=180),
    location: Optional[str] = Query(None),
):
    lat, lon = _validate_coords(latitude, longitude)
    loc = location if location is not None else ELAZIG_LOCATION
    return get_current_weather(latitude=lat, longitude=lon, location=loc)


@app.get("/weather/hourly")
def weather_hourly(
    latitude: Optional[float] = Query(None, ge=-90, le=90),
    longitude: Optional[float] = Query(None, ge=-180, le=180),
):
    lat, lon = _validate_coords(latitude, longitude)
    try:
        return fetch_hourly_weather(latitude=lat, longitude=lon)
    except WeatherFetchError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.get("/weather/rain", response_model=list[RainEvent])
def weather_rain(
    latitude: Optional[float] = Query(None, ge=-90, le=90),
    longitude: Optional[float] = Query(None, ge=-180, le=180),
):
    lat, lon = _validate_coords(latitude, longitude)
    try:
        hourly = fetch_hourly_weather(latitude=lat, longitude=lon)
    except WeatherFetchError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    return find_rain_events(hourly)


@app.get("/weather/rain/next", response_model=RainEvent | None)
def weather_rain_next(
    latitude: Optional[float] = Query(None, ge=-90, le=90),
    longitude: Optional[float] = Query(None, ge=-180, le=180),
):
    lat, lon = _validate_coords(latitude, longitude)
    try:
        hourly = fetch_hourly_weather(latitude=lat, longitude=lon)
    except WeatherFetchError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    events = find_rain_events(hourly)
    now = datetime.now(ZoneInfo(ELAZIG_TIMEZONE)).strftime("%Y-%m-%dT%H:%M")
    return find_next_rain_event(events, now)
