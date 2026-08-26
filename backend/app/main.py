from fastapi import FastAPI, HTTPException

from app.weather.models import CurrentWeather, RainEvent
from app.weather.open_meteo import (
    WeatherFetchError,
    fetch_hourly_weather,
    get_current_weather,
)
from app.weather.rain import find_rain_events

app = FastAPI()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/weather/current", response_model=CurrentWeather)
def weather_current():
    return get_current_weather()


@app.get("/weather/hourly")
def weather_hourly():
    try:
        return fetch_hourly_weather()
    except WeatherFetchError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.get("/weather/rain", response_model=list[RainEvent])
def weather_rain():
    try:
        hourly = fetch_hourly_weather()
    except WeatherFetchError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    return find_rain_events(hourly)
