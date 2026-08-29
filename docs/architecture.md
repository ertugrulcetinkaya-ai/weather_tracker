# Architecture

## Boundaries

The application has four explicit boundaries:

1. `backend/app/weather/open_meteo.py` is the provider adapter. It owns transport timeouts,
   provider payload validation, and translation to application models.
2. `backend/app/weather/rain.py` is provider-independent domain logic for deriving rain events.
3. `backend/app/main.py` is the HTTP boundary. It validates query parameters, exposes response
   models, configures CORS, and maps provider failures to one `502` contract.
4. `mobile/src/api`, `mobile/src/hooks`, and `mobile/src/storage` separate transport, orchestration,
   and persistence from rendering.

The mobile application uses `GET /weather/overview` for its main screen. The backend requests the
union of required hourly fields once and derives all three UI sections from that snapshot.

## Reliability properties

- Every provider request has a 10-second timeout and normalizes HTTP, JSON, and schema failures as
  `WeatherFetchError`.
- The API has explicit Pydantic response contracts and rejects unexpected model fields.
- The mobile API client validates data at runtime instead of trusting TypeScript casts.
- Screen refreshes and debounced searches abort superseded requests.
- Invalid or duplicate persisted favorites are discarded during hydration.
- CI enforces backend lint/tests plus mobile strict TypeScript, unit tests, and coverage thresholds.

## Configuration

| Setting | Owner | Default | Purpose |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | Mobile | `http://127.0.0.1:8000` | Backend origin |
| `WEATHER_CORS_ORIGINS` | Backend | Expo web localhost origins | Comma-separated browser allowlist |

## Evolution

Focused endpoints remain available for external consumers, while the overview endpoint is the
mobile-facing backend-for-frontend contract. If another client needs a different aggregate, add a
new application-level contract rather than exposing Open-Meteo payloads or coupling all consumers
to one oversized response.
