import pytest

from app.weather.open_meteo import (
    OPEN_METEO_TIMEOUT_ENV_VAR,
    _configured_open_meteo_timeout_seconds,
)


def test_open_meteo_timeout_defaults_to_ten_seconds_outside_vercel(monkeypatch):
    monkeypatch.delenv("VERCEL", raising=False)
    monkeypatch.delenv(OPEN_METEO_TIMEOUT_ENV_VAR, raising=False)

    assert _configured_open_meteo_timeout_seconds() == 10.0


def test_open_meteo_timeout_defaults_to_six_seconds_on_vercel(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.delenv(OPEN_METEO_TIMEOUT_ENV_VAR, raising=False)

    assert _configured_open_meteo_timeout_seconds() == 6.0


@pytest.mark.parametrize(
    "configured_timeout",
    ["", "invalid", "0", "-1", "nan", "inf", "-inf", "10.1"],
)
def test_open_meteo_timeout_rejects_invalid_values_outside_vercel(
    monkeypatch, configured_timeout
):
    monkeypatch.delenv("VERCEL", raising=False)
    monkeypatch.setenv(OPEN_METEO_TIMEOUT_ENV_VAR, configured_timeout)

    with pytest.raises(ValueError, match=OPEN_METEO_TIMEOUT_ENV_VAR):
        _configured_open_meteo_timeout_seconds()


@pytest.mark.parametrize("configured_timeout", ["6.1", "10"])
def test_open_meteo_timeout_rejects_values_over_vercel_limit(
    monkeypatch, configured_timeout
):
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv(OPEN_METEO_TIMEOUT_ENV_VAR, configured_timeout)

    with pytest.raises(ValueError, match=OPEN_METEO_TIMEOUT_ENV_VAR):
        _configured_open_meteo_timeout_seconds()


def test_open_meteo_timeout_accepts_valid_environment_override(monkeypatch):
    monkeypatch.delenv("VERCEL", raising=False)
    monkeypatch.setenv(OPEN_METEO_TIMEOUT_ENV_VAR, "7.5")

    assert _configured_open_meteo_timeout_seconds() == 7.5
