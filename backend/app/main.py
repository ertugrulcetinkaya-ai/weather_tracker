from fastapi import FastAPI, HTTPException

from app.weather.models import CurrentWeather
from app.weather.open_meteo import (
    WeatherFetchError,
    fetch_hourly_weather,
    get_current_weather,
)

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
