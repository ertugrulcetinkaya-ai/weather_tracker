# Weather Tracker

A Turkish weather experience built with Expo/React Native and a FastAPI backend. The backend
normalizes Open-Meteo data into a stable application contract; the mobile client never depends
on the provider's response shape directly.

## Architecture

```text
Expo screen
  ├── location/search hooks
  ├── AsyncStorage preferences
  └── typed API client ── GET /weather/overview ── FastAPI
                                                  ├── contract validation
                                                  ├── rain-event domain logic
                                                  └── one Open-Meteo request
```

The screen-level overview endpoint is intentional: a refresh returns current conditions, the
24-hour forecast, and the next rain event from one coherent provider snapshot. This avoids the
previous duplicate hourly fetch and prevents partially updated UI states.

More detail is available in [docs/architecture.md](docs/architecture.md).

## Local development

Requirements: Python 3.9+ and Node.js 22.

```bash
# terminal 1
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
uvicorn app.main:app --reload

# terminal 2
cd mobile
npm ci
cp .env.example .env.local
npm start
```

For a physical device, replace `127.0.0.1` in `mobile/.env.local` with the development machine's
LAN address. Expo reads the backend URL from `EXPO_PUBLIC_API_BASE_URL`.

The API enables Expo web origins on ports served from `localhost:8081` and `127.0.0.1:8081` by
default. Override the comma-separated allowlist with `WEATHER_CORS_ORIGINS`.

## Quality checks

```bash
cd backend && ruff check app tests && python -m pytest
cd mobile && npm run check
```

GitHub Actions runs the same lint, test, and type-check gates for pull requests and pushes to
`main`.

## API

- `GET /health` — process readiness
- `GET /locations/search?q=...` — Turkish location lookup
- `GET /weather/overview` — preferred mobile screen contract
- `GET /weather/current`, `/weather/hourly`, `/weather/rain`, `/weather/rain/next` — focused,
  backwards-compatible contracts

All weather endpoints accept `latitude` and `longitude` together. Endpoints that render a place
name also accept `location`. Invalid input returns `422`; provider/network/shape failures return
a consistent `502` response.
