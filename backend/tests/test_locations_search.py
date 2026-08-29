from unittest import mock

import httpx
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _mock_response(payload):
    response = mock.Mock()
    response.raise_for_status = mock.Mock()
    response.json = mock.Mock(return_value=payload)
    return response


def _tr_result(name="İstanbul", latitude=41.01, longitude=28.95, **extra):
    result = {
        "name": name,
        "latitude": latitude,
        "longitude": longitude,
        "admin1": "İstanbul",
        "country": "Türkiye",
        "country_code": "TR",
    }
    result.update(extra)
    return result


def test_search_locations_normal_query():
    payload = {"results": [
        _tr_result(name="İstanbul", latitude=41.015, longitude=28.979),
        _tr_result(name="İstanbul", latitude=41.02, longitude=29.1, admin1="Kocaeli"),
    ]}
    with mock.patch(
        "app.weather.open_meteo.httpx.get", return_value=_mock_response(payload)
    ) as mocked_get:
        response = client.get("/locations/search", params={"q": "istanbul"})

    assert response.status_code == 200
    assert response.json() == [
        {
            "name": "İstanbul",
            "latitude": 41.015,
            "longitude": 28.979,
            "admin1": "İstanbul",
            "country": "Türkiye",
        },
        {
            "name": "İstanbul",
            "latitude": 41.02,
            "longitude": 29.1,
            "admin1": "Kocaeli",
            "country": "Türkiye",
        },
    ]
    mocked_get.assert_called_once()
    args, kwargs = mocked_get.call_args
    assert args[0] == "https://geocoding-api.open-meteo.com/v1/search"
    assert kwargs["params"] == {
        "name": "istanbul",
        "count": 8,
        "language": "tr",
        "format": "json",
        "countryCode": "TR",
    }
    assert kwargs["timeout"] == 10.0


def test_search_locations_empty_results():
    with mock.patch(
        "app.weather.open_meteo.httpx.get", return_value=_mock_response({"results": []})
    ):
        response = client.get("/locations/search", params={"q": "xyzabc"})

    assert response.status_code == 200
    assert response.json() == []


def test_search_locations_null_results():
    with mock.patch(
        "app.weather.open_meteo.httpx.get", return_value=_mock_response({"results": None})
    ):
        response = client.get("/locations/search", params={"q": "xyzabc"})

    assert response.status_code == 200
    assert response.json() == []


def test_search_locations_missing_results_key():
    with mock.patch(
        "app.weather.open_meteo.httpx.get", return_value=_mock_response({})
    ):
        response = client.get("/locations/search", params={"q": "xyzabc"})

    assert response.status_code == 200
    assert response.json() == []


def test_search_locations_malformed_result_skipped():
    payload = {"results": [
        {"name": "Ankara", "latitude": "not-a-number", "longitude": 32.85},
        {"name": "Ankara", "latitude": 39.93, "longitude": 32.85, "admin1": "Ankara", "country": "Türkiye"},
        {"latitude": 39.93, "longitude": 32.85},
        _tr_result(name="Bursa", latitude=40.19, longitude=29.06),
    ]}
    with mock.patch(
        "app.weather.open_meteo.httpx.get", return_value=_mock_response(payload)
    ):
        response = client.get("/locations/search", params={"q": "ankara"})

    assert response.status_code == 200
    assert response.json() == [
        {
            "name": "Ankara",
            "latitude": 39.93,
            "longitude": 32.85,
            "admin1": "Ankara",
            "country": "Türkiye",
        },
        {
            "name": "Bursa",
            "latitude": 40.19,
            "longitude": 29.06,
            "admin1": "İstanbul",
            "country": "Türkiye",
        },
    ]


def test_search_locations_duplicate_keeps_first():
    payload = {"results": [
        _tr_result(name="İzmir", latitude=38.42, longitude=27.13, admin1="İzmir"),
        _tr_result(name="İzmir", latitude=38.42, longitude=27.13, admin1="Bölge"),
    ]}
    with mock.patch(
        "app.weather.open_meteo.httpx.get", return_value=_mock_response(payload)
    ):
        response = client.get("/locations/search", params={"q": "izmir"})

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["admin1"] == "İzmir"


def test_search_locations_missing_q():
    response = client.get("/locations/search")

    assert response.status_code == 422


def test_search_locations_q_too_short():
    response = client.get("/locations/search", params={"q": "a"})

    assert response.status_code == 422


def test_search_locations_rejects_whitespace_only_query():
    response = client.get("/locations/search", params={"q": "  "})

    assert response.status_code == 422


def test_search_locations_upstream_http_failure():
    response = mock.Mock()
    response.raise_for_status.side_effect = httpx.HTTPStatusError(
        "Server error", request=mock.Mock(), response=mock.Mock(status_code=500)
    )
    with mock.patch(
        "app.weather.open_meteo.httpx.get", return_value=response
    ):
        result = client.get("/locations/search", params={"q": "istanbul"})

    assert result.status_code == 502
    assert "Open-Meteo geocoding request failed" in result.json()["detail"]


def test_search_locations_non_tr_result_skipped():
    payload = {"results": [
        _tr_result(name="Istanbul", latitude=41.01, longitude=28.95, country_code="US", country="United States"),
        _tr_result(name="İstanbul", latitude=41.02, longitude=28.98),
    ]}
    with mock.patch(
        "app.weather.open_meteo.httpx.get", return_value=_mock_response(payload)
    ):
        response = client.get("/locations/search", params={"q": "istanbul"})

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "İstanbul"
