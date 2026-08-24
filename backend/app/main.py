from fastapi import FastAPI

from app.weather.models import CurrentWeather
from app.weather.open_meteo import get_current_weather

app = FastAPI()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/weather/current", response_model=CurrentWeather)
def weather_current():
    return get_current_weather()
