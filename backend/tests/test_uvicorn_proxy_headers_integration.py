from __future__ import annotations

import http.client
import os
import socket
import subprocess
import sys
import time
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Optional

import pytest

BACKEND_DIR = Path(__file__).parents[1]


@contextmanager
def _uvicorn_server() -> Iterator[int]:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as reservation:
        reservation.bind(("0.0.0.0", 0))
        port = reservation.getsockname()[1]

    environment = os.environ.copy()
    environment["WEATHER_API_RATE_LIMIT_PER_MINUTE"] = "1"
    environment["WEATHER_CORS_ORIGINS"] = ""
    environment.pop("WEATHER_ENFORCE_HTTPS", None)
    process = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            str(port),
            "--no-proxy-headers",
            "--no-access-log",
            "--log-level",
            "warning",
        ],
        cwd=BACKEND_DIR,
        env=environment,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    try:
        for _ in range(100):
            if process.poll() is not None:
                output, _ = process.communicate()
                pytest.fail(f"Uvicorn exited before startup:\n{output}")
            try:
                response = _request(port, "127.0.0.1", "127.0.0.1", "/health")
            except OSError:
                time.sleep(0.05)
                continue
            assert response.status == 200
            break
        else:
            pytest.fail("Uvicorn did not become ready within five seconds")

        yield port
    finally:
        process.terminate()
        try:
            process.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.communicate(timeout=5)


def _request(
    port: int,
    server_address: str,
    source_address: str,
    path: str,
    headers: Optional[dict[str, str]] = None,
) -> http.client.HTTPResponse:
    connection = http.client.HTTPConnection(
        server_address,
        port,
        timeout=2,
        source_address=(source_address, 0),
    )
    connection.request("GET", path, headers=headers or {})
    response = connection.getresponse()
    response.read()
    connection.close()
    return response


def _alternate_local_ipv4_address() -> str | None:
    candidates = {
        result[4][0]
        for result in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)
        if not result[4][0].startswith("127.")
    }
    candidates.update(("127.0.0.2", "127.0.0.3"))
    for address in sorted(candidates):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as candidate:
            try:
                candidate.bind((address, 0))
            except OSError:
                continue
            return address
    return None


def test_uvicorn_ignores_untrusted_forwarded_headers_and_keeps_health_available():
    with _uvicorn_server() as port:
        first = _request(
            port,
            "127.0.0.1",
            "127.0.0.1",
            "/locations/search?q=x",
            {
                "X-Forwarded-For": "198.51.100.8",
                "X-Forwarded-Proto": "https",
            },
        )
        repeated_with_changed_spoofed_headers = _request(
            port,
            "127.0.0.1",
            "127.0.0.1",
            "/locations/search?q=x",
            {
                "X-Forwarded-For": "203.0.113.19, 192.0.2.77",
                "X-Forwarded-Proto": "http",
            },
        )
        health = _request(
            port,
            "127.0.0.1",
            "127.0.0.1",
            "/health",
            {"X-Forwarded-Proto": "http"},
        )

    assert first.status == 422
    assert "location" not in {name.lower() for name, _ in first.getheaders()}
    assert repeated_with_changed_spoofed_headers.status == 429
    assert health.status == 200


def test_uvicorn_rate_limit_separates_distinct_tcp_peer_addresses():
    alternate_address = _alternate_local_ipv4_address()
    if alternate_address is None:
        pytest.skip("This host does not expose a second bindable IPv4 address")

    with _uvicorn_server() as port:
        first_peer = _request(
            port,
            "127.0.0.1",
            "127.0.0.1",
            "/locations/search?q=x",
        )
        same_peer = _request(
            port,
            "127.0.0.1",
            "127.0.0.1",
            "/locations/search?q=x",
            {"X-Forwarded-For": "198.51.100.21"},
        )
        other_peer = _request(
            port,
            alternate_address,
            alternate_address,
            "/locations/search?q=x",
            {"X-Forwarded-For": "198.51.100.21"},
        )

    assert first_peer.status == 422
    assert same_peer.status == 429
    assert other_peer.status == 422
