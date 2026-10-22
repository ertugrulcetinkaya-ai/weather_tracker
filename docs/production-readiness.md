# R1 production infrastructure readiness

This change prepares configuration and checks. It does not create a hosting account, service, EAS project, or signing key and does not deploy or install an APK.

## Initial blockers

| Priority | Finding | R1 status |
| --- | --- | --- |
| P0 | The mobile API URL silently fell back to `http://127.0.0.1:8000`, including release bundles. | Release config now requires a public HTTPS URL and rejects missing, HTTP, malformed, or localhost URLs. Development retains localhost and LAN HTTP support. |
| P0 | Android had no pinned `applicationId` or `versionCode`; no release signing credentials were present in the repository. | A fixed ID and initial version code are configured. A permanent release keystore still has to be created or selected by the owner; R1 does not generate one. |
| P0 | There was no deployment definition or app-side HTTPS requirement. | `render.yaml` describes a continuously running Frankfurt service, `/health`, platform TLS, HTTPS enforcement, and startup command. It is not applied to a live account. |
| P1 | Public weather and geocoding endpoints had no request limit; upstream failures could be returned and logged with provider details. | A per-client 60-request/minute in-process limit returns 429. Provider failures now return a generic 502 and logs omit exception/query details. |
| P1 | Weather endpoints are intentionally unauthenticated because the mobile client is public and a bundled key is not an access control. | The backend applies a bounded request rate and validates coordinates/search lengths. Before multi-instance scaling, move limits to a shared store or edge layer. |
| P2 | There is no external error tracker or uptime notification configured. | Render dashboard logs, metrics, restart handling, and deployment health checks are available; external alerting remains an account-level follow-up. |

Open-Meteo requests already have a 10-second timeout. Latitude, longitude, location name, and search query lengths are validated. `/health` is a process readiness check and does not call Open-Meteo; it intentionally stays available to platform probes. Weather calculation code was not changed.

## Hosting comparison

| Area | Render | Railway |
| --- | --- | --- |
| Suggested location for Turkey | Frankfurt. Inference: geographically closer than Amsterdam; measure actual RTT from Türkiye after a service exists. | Amsterdam (EU West). No Istanbul region is listed. |
| Continuous service | Paid Starter, 0.5 CPU / 512 MB; stays running. Avoid the free plan for production because it spins down. | Hobby with an always-on service; disable serverless/sleep behavior if enabled. Usage-based billing. |
| TLS | Managed TLS and HTTP-to-HTTPS redirection at the load balancer. | Automatic certificates for Railway and custom domains; HTTPS is supported through public networking. |
| Approximate monthly cost | About $7 for one 0.5 CPU / 512 MB instance (current compute rate works out to about $6.91 for a 30-day month; bandwidth/workspace charges can change the bill). | $5 minimum, including $5 resource credits. A continuously resident 512 MB app is roughly $5 in memory alone; allow about $5–10 for a small service before unusual CPU/egress use. |
| Health checks | `/health` can be checked during deploy and continuously; unhealthy instances can be restarted. | `/health` gates a new deployment, but the check does not continue after deploy. |
| Logs and errors | Dashboard logs, live tail, and service metrics. Log retention depends on workspace plan; no application error tracker is configured. | Build/runtime logs and Log Explorer; Hobby includes 7-day history. No application error tracker is configured. |
| Restart and rollback | Automatic restart on repeated health-check failure; failed deploy keeps the previous service active; instant rollback is available. | Restart and rollback are available; Hobby retains removed deployment images for 72 hours. |
| Secrets/config | Environment variables and secrets in the service dashboard/Blueprint secrets; no secret is needed by this app. | Service variables in the dashboard/config; no secret is needed by this app. |
| Resource fit | One small instance is ample for this stateless FastAPI service; scale only after observing actual use. | 0.5 GB / 1 vCPU is available on Free, but always-on production use is budgeted on Hobby and billed by actual resource consumption. |

**Default recommendation: Render Starter in Frankfurt.** It gives this app a simple fixed baseline, HTTPS redirect, and ongoing health checks. Railway is a viable alternate if usage-based costs and Amsterdam placement are preferred. Neither provider currently offers a Türkiye region in the cited region lists.

## Render service setup

The root `render.yaml` is an infrastructure blueprint only. When R2 is approved, connect the GitHub repository and create the web service from that blueprint. It uses:

```sh
uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --proxy-headers --forwarded-allow-ips='*' --no-access-log
```

Render terminates public TLS at its load balancer and forwards the trusted scheme to Uvicorn. The application redirects non-HTTPS weather/API routes as a second check. The health endpoint stays transport-neutral for platform probes. The in-process limiter depends on the forwarded client address and assumes only the hosting provider's ingress can reach the service port; keep the service behind provider ingress and on one worker/instance unless rate-limit state is moved to shared storage or an edge limiter.

No API key is placed in the mobile bundle. Weather data and location search are public upstream reads. The 60/minute limit is a low-cost abuse guard, not user authentication or a DDoS service.

## HTTPS/TLS verification after R2 creates the service

Use the actual generated `onrender.com` hostname or verified custom hostname:

1. Confirm `http://HOST/health` redirects to the HTTPS URL and `https://HOST/health` returns `200` with `{"status":"ok"}`.
2. Run `curl -fsS https://HOST/health` and `openssl s_client -connect HOST:443 -servername HOST -verify_return_error`; confirm the chain, hostname, and expiry.
3. Request a weather route over HTTPS and confirm valid JSON; send HTTP to a weather route and confirm it redirects without invoking Open-Meteo.
4. Set `EXPO_PUBLIC_API_BASE_URL=https://HOST` in the EAS production environment, run the production config check, then build the APK only after separately approving that build.
5. Repeat certificate and endpoint checks after any custom-domain DNS change and after deployment/rollback.

R1 can validate the URL shape and release Android manifest locally, but no real hostname exists yet, so no live TLS validation or production APK is claimed.

## Android identity, signing, and updates

- Android application ID: `com.ertugrulcetinkaya.weathertracker` (pinned in app config). No native Android project, previous release package ID, APK, or `versionCode` was committed, so R1 establishes the first explicit identity; it cannot verify an unpublished/external build.
- User-facing version: `1.0.0`. Initial Android `versionCode`: `1`; EAS production auto-increments from its remote version source. Initialize that source to the last published version if a release exists outside this repository.
- Debug and release network policies are variant-specific: Android debug permits HTTP for localhost/LAN development; Android release sets `usesCleartextTraffic=false`.
- Debug and release signing are separate: Gradle debug uses the Android debug key; the release variant selects `signingConfigs.release`, which EAS fills from the remote production keystore. A local release build without that key must not be used for distribution. Keep the release key permanently and back up/retain access; later APKs must use the same key and application ID to update in place and retain app data.
- No release keystore, alias, password, or EAS credentials were found or created. Options for R2: let EAS generate and manage a single permanent Android keystore, or create one locally, keep an encrypted offline backup, and upload/store it through EAS credentials. Never commit a keystore, password, or `credentials.json`.
- A first production APK is an install/update boundary from any locally debug-signed build. Debug and release signatures are intentionally separate; users who installed only debug builds may need a clean transition. Once the first release is signed, preserve the release key and increase `versionCode` for every subsequent release.

The production EAS profile outputs an APK for internal distribution. Its public API URL is a build-time value and is readable in the package; it must contain no credentials.
