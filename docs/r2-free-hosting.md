# R2 free hosting: Vercel Hobby

This plan prepares the existing FastAPI backend for Vercel Hobby, for personal use, without connecting a hosting account or deploying a service. The target project root is `backend/`. No Android API URL is set until a real HTTPS deployment has been checked.

## Vercel fit and setup

Vercel's Python runtime supports FastAPI and loads an ASGI app named `app`. With the Vercel project root set to `backend/`, `app/main.py` exposes the existing application. Vercel routes requests to that FastAPI app, preserving `/health`, `/weather/overview`, `/locations/search`, and the other existing routes. `backend/pyproject.toml` pins the entrypoint, and `backend/vercel.json` enables Fluid compute with an 8-second function deadline.

The existing app uses synchronous Open-Meteo requests. Their timeout is now six seconds to leave time for validation and response encoding within the function deadline. The Android client still has its existing 10-second end-to-end timeout. The 8-second function cap leaves nominal margin, but it does not prove that a cold request will finish within ten seconds: network setup, Vercel startup, and client-to-edge latency also count from the Android client's perspective. Vercel does not publish a cold-start latency guarantee. Fluid compute reduces cold starts, but only measurements against a real deployment can confirm the Android deadline. Do not set a production Android URL or build an APK until HTTPS and repeated warm/cold requests are verified.

The Python runtime is documented as Beta. GitHub currently reports this repository as public. Vercel's Hobby Git integration restriction is documented for private repositories owned by GitHub organizations, so it does not automatically block this repository; the actual import flow still needs account-level verification. If the account cannot import it, the no-cost fallback is a CLI deployment by the Hobby account owner after explicit account authorization. Do not change repository visibility or transfer ownership as part of this task.

## Request limits and security

The app's optional sliding-window limiter stores counters in process memory. Vercel can reuse an instance, but requests can reach different instances and cold starts reset their memory. It is therefore a per-instance best-effort guard, not a service-wide quota. Leave `WEATHER_API_RATE_LIMIT_PER_MINUTE` unset on Vercel and do not claim that the Render setting of 60 requests/minute protects the Vercel deployment.

Vercel's platform DDoS mitigation is included on all plans. Its WAF can also apply an IP-based fixed-window rule; Hobby currently allows one rate-limit rule and lists 1,000,000 allowed requests as included. The same pricing page lists rate-limited requests at $0.50 per 1,000,000 in some usage contexts. To preserve a strict $0 hosting target, do not publish a rate-limit rule unless the Hobby dashboard explicitly confirms that it remains inside included free usage and cannot trigger paid usage. No rule, billing option, or external rate-limit store is configured by this repository.

The mobile app is a public client, so a bundled static API key would be extractable and is not meaningful authentication. Keep input validation and generic upstream error responses. Treat the platform DDoS protection and Hobby quotas as abuse/cost limits, not user authentication or a strong per-user rate limiter. If stronger global limiting becomes necessary, evaluate it separately and reject any service that requires paid usage, a trial, a card, or a recurring resource.

## Hobby cost controls and quotas

Vercel Hobby is free for personal, non-commercial projects. The current plan page lists monthly included amounts including 100 GB Fast Data Transfer, 10 GB Fast Origin Transfer, 1,000,000 CDN requests, 1,000,000 Function invocations, 4 Active CPU hours, and 360 GB-hours of provisioned memory. Hobby does not offer Pro-style Spend Management. Vercel documents that Hobby usage pauses when included limits are exceeded rather than billing for on-demand overages; service may be unavailable until the usage window resets.

To keep the hosting bill at $0:

1. Keep the project on the personal Hobby plan. Do not start the Pro trial or upgrade the account/team.
2. Do not add a payment method, paid marketplace integration, add-on, storage product, or paid compute resource.
3. Check the Vercel Usage page and plan selector periodically. Stop using the service if the dashboard shows a paid resource or unexpected metered usage; do not accept an upgrade prompt.
4. Expect quota exhaustion to pause requests rather than silently preserving availability. Do not treat a Hobby deployment as an availability guarantee.
5. Use only the generated `*.vercel.app` hostname initially; do not buy a domain for this $0 target.

The plan and metering details can change. Recheck the linked official plan and pricing pages before creating or changing an account configuration.

## Alternatives considered

| Provider | Free option | Effect on the 10-second Android deadline | Decision |
| --- | --- | --- | --- |
| Vercel Hobby | Free personal plan, automatic HTTPS, Python Functions, included monthly usage; excess usage is paused on Hobby | Functions can cold-start, but FastAPI runs as a managed function and Vercel Fluid compute reduces cold-start frequency. Real cold/warm HTTPS timings remain required. | Preferred, subject to the organization-repository Git integration restriction and live timing. |
| Koyeb Free | One 512 MB / 0.1 vCPU / 2 GB service per organization in Frankfurt or Washington; scales to zero after one idle hour | A sleeping instance must wake. Koyeb's free service is presented for preview/hobby use and has no 10-second wake guarantee. | Possible fallback if measured; less confidence in the Android timeout after idle. |
| Render Free | Free web service with managed TLS; sleeps after 15 idle minutes and wakes in about one minute; shared 750 free instance-hours per workspace/month | Its documented wake time exceeds the Android timeout. Usage/bandwidth/build limits can also suspend service, and a payment method can permit supplementary charges. | Not suitable for this client timeout. The existing `render.yaml` remains a paid Starter definition and is not used. |

Koyeb and Render are not configured by this change. No alternative plan or paid fallback is authorized.

## Live verification required before production

After the user authorizes account connection and a free-tier deployment, record the generated HTTPS URL and verify:

1. TLS certificate and hostname validate, and `GET /health` returns `200` with `{"status":"ok"}`.
2. Real `GET /weather/overview` and `GET /locations/search?q=istanbul` requests return their existing JSON contracts.
3. Measure several warm requests and requests after idle/cold start from the Android network. All must complete below 10 seconds; keep the slowest observed value and the measurement conditions in the release notes.
4. Confirm usage is assigned to Hobby and no billable resource or paid trial is enabled.
5. Only after those checks, configure `EXPO_PUBLIC_API_BASE_URL` to the verified HTTPS origin. Release URL validation remains in place, and no production APK is prepared by this change.

## Official references checked 2026-10-22

- [FastAPI on Vercel](https://vercel.com/kb/guide/ship-a-fastapi-app-on-vercel)
- [Python runtime and entrypoints](https://vercel.com/docs/functions/runtimes/python)
- [Vercel Function limits](https://vercel.com/docs/functions/limitations)
- [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)
- [Fluid compute pricing](https://vercel.com/docs/functions/usage-and-pricing)
- [Vercel WAF rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)
- [Hobby Git integration limits](https://vercel.com/docs/git)
- [Render Free services](https://render.com/docs/free)
- [Koyeb instance types](https://www.koyeb.com/docs/reference/instances)
- [Koyeb scale-to-zero](https://www.koyeb.com/docs/run-and-scale/scale-to-zero)
