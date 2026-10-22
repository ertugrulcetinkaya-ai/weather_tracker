import logging
from pathlib import Path
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


def test_rate_limit_keeps_sixty_requests_per_minute_per_client():
    client = TestClient(
        create_app(Settings(cors_origins=(), api_requests_per_minute=60))
    )
    with mock.patch("app.main.search_locations", return_value=[]):
        responses = [
            client.get("/locations/search", params={"q": "istanbul"})
            for _ in range(60)
        ]
        limited = client.get("/locations/search", params={"q": "istanbul"})

    assert all(response.status_code == 200 for response in responses)
    assert limited.status_code == 429
    assert limited.headers["Retry-After"] == "60"


def test_rate_limit_uses_the_connection_peer_not_forwarded_for():
    application = create_app(Settings(cors_origins=(), api_requests_per_minute=1))
    with (
        TestClient(application, client=("198.51.100.10", 1234)) as first_client,
        TestClient(application, client=("203.0.113.20", 5678)) as second_client,
        mock.patch("app.main.search_locations", return_value=[]),
    ):
        first = first_client.get(
            "/locations/search?q=istanbul",
            headers={"X-Forwarded-For": "203.0.113.99"},
        )
        same_client_with_spoofed_ip = first_client.get(
            "/locations/search?q=ankara",
            headers={"X-Forwarded-For": "198.51.100.201"},
        )
        different_client = second_client.get(
            "/locations/search?q=izmir",
            headers={"X-Forwarded-For": "198.51.100.201"},
        )

    assert first.status_code == 200
    assert same_client_with_spoofed_ip.status_code == 429
    assert different_client.status_code == 200


def test_rate_limit_uses_render_client_ip_header_instead_of_x_forwarded_for():
    application = create_app(Settings(cors_origins=(), api_requests_per_minute=1))
    with TestClient(application, client=("10.0.0.10", 1234)) as first_client, TestClient(
        application, client=("10.0.0.20", 5678)
    ) as second_client, mock.patch("app.main.search_locations", return_value=[]):
        first = first_client.get(
            "/locations/search?q=istanbul",
            headers={
                "CF-Connecting-IP": "198.51.100.42",
                "X-Forwarded-For": "203.0.113.90",
            },
        )
        same_render_client_with_changed_forwarded_for = second_client.get(
            "/locations/search?q=ankara",
            headers={
                "CF-Connecting-IP": "198.51.100.42",
                "X-Forwarded-For": "192.0.2.30",
            },
        )

    assert first.status_code == 200
    assert same_render_client_with_changed_forwarded_for.status_code == 429


def test_invalid_render_client_ip_header_falls_back_to_connection_peer():
    application = create_app(Settings(cors_origins=(), api_requests_per_minute=1))
    with TestClient(application, client=("198.51.100.11", 1234)) as first_client, TestClient(
        application, client=("198.51.100.22", 5678)
    ) as second_client, mock.patch("app.main.search_locations", return_value=[]):
        malformed = first_client.get(
            "/locations/search?q=istanbul",
            headers={"CF-Connecting-IP": "198.51.100.1, 203.0.113.1"},
        )
        same_peer_without_header = first_client.get("/locations/search?q=ankara")
        different_peer_with_same_malformed_header = second_client.get(
            "/locations/search?q=izmir",
            headers={"CF-Connecting-IP": "198.51.100.1, 203.0.113.1"},
        )

    assert malformed.status_code == 200
    assert same_peer_without_header.status_code == 429
    assert different_peer_with_same_malformed_header.status_code == 200


def test_render_proxy_and_health_check_policy_is_explicit():
    render_config = Path(__file__).parents[2] / "render.yaml"
    contents = render_config.read_text(encoding="utf-8")

    assert "--no-proxy-headers" in contents
    assert "--forwarded-allow-ips" not in contents
    assert "WEATHER_ENFORCE_HTTPS" not in contents
    assert "healthCheckPath: /health" in contents


def test_forwarded_proto_does_not_cause_app_level_https_redirects():
    client = TestClient(create_app(Settings(cors_origins=())), follow_redirects=False)

    api_response = client.get(
        "/locations/search?q=x",
        headers={"X-Forwarded-Proto": "https"},
    )
    health_response = client.get(
        "/health",
        headers={"X-Forwarded-Proto": "http"},
    )

    assert api_response.status_code == 422
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
    monkeypatch.setenv("WEATHER_API_RATE_LIMIT_PER_MINUTE", "90")

    settings = Settings.from_environment()

    assert settings.cors_origins == ()
    assert settings.api_requests_per_minute == 90


def test_settings_reject_invalid_rate_limit(monkeypatch):
    monkeypatch.setenv("WEATHER_API_RATE_LIMIT_PER_MINUTE", "unlimited")

    try:
        Settings.from_environment()
    except ValueError as exc:
        assert str(exc) == "WEATHER_API_RATE_LIMIT_PER_MINUTE must be a positive integer"
    else:
        raise AssertionError("Expected invalid rate limits to fail configuration")
