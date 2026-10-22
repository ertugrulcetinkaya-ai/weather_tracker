import logging
from unittest import mock

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.weather.open_meteo import WeatherFetchError


def test_weather_routes_are_rate_limited_per_client_but_health_is_not():
    client = TestClient(
        create_app(Settings(cors_origins=(), api_requests_per_minute=1))
    )
    with mock.patch("app.main.search_locations", return_value=[]):
        first = client.get("/locations/search", params={"q": "istanbul"})
        limited = client.get("/locations/search", params={"q": "ankara"})

    assert first.status_code == 200
    assert limited.status_code == 429
    assert limited.headers["Retry-After"] == "60"
    assert limited.json() == {
        "detail": "Too many requests. Please try again shortly."
    }
    assert client.get("/health").status_code == 200


def test_https_is_required_for_api_routes_but_health_remains_probeable():
    client = TestClient(
        create_app(Settings(cors_origins=(), enforce_https=True)),
        follow_redirects=False,
    )

    api_response = client.get("/weather/overview")
    health_response = client.get("/health")

    assert api_response.status_code == 307
    assert api_response.headers["location"] == "https://testserver/weather/overview"
    assert health_response.status_code == 200
    assert health_response.json() == {"status": "ok"}


def test_weather_provider_errors_do_not_expose_or_log_provider_details(caplog):
    client = TestClient(create_app(Settings(cors_origins=())))
    provider_detail = "https://api.open-meteo.com/?latitude=41.0&longitude=29.0 private"
    with mock.patch(
        "app.main.get_current_weather",
        side_effect=WeatherFetchError(provider_detail),
    ), caplog.at_level(logging.WARNING, logger="app.main"):
        response = client.get(
            "/weather/current?latitude=41.0&longitude=29.0&location=Istanbul"
        )

    assert response.status_code == 502
    assert response.json() == {"detail": "Weather data is temporarily unavailable."}
    assert provider_detail not in response.text
    assert provider_detail not in caplog.text
    assert "latitude=41.0" not in caplog.text


def test_settings_read_https_and_rate_limit_from_environment(monkeypatch):
    monkeypatch.setenv("WEATHER_CORS_ORIGINS", "")
    monkeypatch.setenv("WEATHER_ENFORCE_HTTPS", "true")
    monkeypatch.setenv("WEATHER_API_RATE_LIMIT_PER_MINUTE", "90")

    settings = Settings.from_environment()

    assert settings.cors_origins == ()
    assert settings.enforce_https is True
    assert settings.api_requests_per_minute == 90


def test_settings_reject_invalid_rate_limit(monkeypatch):
    monkeypatch.setenv("WEATHER_API_RATE_LIMIT_PER_MINUTE", "unlimited")

    try:
        Settings.from_environment()
    except ValueError as exc:
        assert str(exc) == "WEATHER_API_RATE_LIMIT_PER_MINUTE must be a positive integer"
    else:
        raise AssertionError("Expected invalid rate limits to fail configuration")
