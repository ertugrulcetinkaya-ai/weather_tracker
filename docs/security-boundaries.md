# Production proxy and Android release boundaries

## Render ingress and client identity

Render describes this web-service path as public traffic through Cloudflare
and its load balancer before it reaches the application process. TLS ends at
the edge, and the process receives plain HTTP. Render's guidance is to let the
edge handle HTTP-to-HTTPS redirects rather than redirecting again in the app.
The [`/health` probe](https://render.com/docs/health-checks) is an ordinary
HTTP request to the configured health-check path. See Render's [web service
networking guidance](https://render.com/tutorials/web-service-vs-static-site/web-services)
and [client IP guidance](https://render.com/articles/host-pocketbase-on-render).

Render's first-party guidance says Cloudflare overwrites
`CF-Connecting-IP` with the visitor address on public web-service requests.
It also warns that Cloudflare appends to `X-Forwarded-For`, allowing a caller
to control the leftmost address. Uvicorn's `--forwarded-allow-ips='*'` trusts
forwarded headers from every TCP peer, and its proxy middleware uses
`X-Forwarded-For` for the client address when that peer is trusted. The
service therefore disables Uvicorn proxy-header processing and uses only a
single, valid IP address in `CF-Connecting-IP` for Render's public ingress.
For local or direct requests without that header, it falls back to the TCP
peer. See Uvicorn's [proxy settings](https://www.uvicorn.org/settings/) and
[proxy-header implementation](https://github.com/Kludex/uvicorn/blob/master/uvicorn/middleware/proxy_headers.py).

The in-process sliding-window limiter continues to allow at most 60 matching
API requests per minute per client IP seen by the process. On Render public
ingress, it uses the Cloudflare-overwritten `CF-Connecting-IP`; locally or
when that header is absent or malformed, it uses `request.client.host`. The
limit remains per process, not a cross-instance global limit. If Render scales
the service to multiple processes or instances, use shared rate-limit state or
an edge rate limiter for a service-wide quota.

The application does not redirect based on its HTTP request scheme or an
untrusted forwarded-proto header. Render's edge owns HTTPS redirection, which
avoids a redirect loop between the HTTPS client URL and the edge-to-process
HTTP hop. `/health` remains reachable over that internal HTTP hop.

## Android release URL and signing

EAS production configuration still requires a public HTTPS
`EXPO_PUBLIC_API_BASE_URL`. The dynamic Expo config validates production
profiles and production JavaScript exports. `APP_ENV=production` and
`EAS_BUILD_PROFILE=production` force release checks; `NODE_ENV=production`
also does so unless the explicit EAS profile is `development`. Release URLs
must use HTTPS and a DNS hostname; IP literals are rejected so special-use
addresses cannot pass as public hosts. The build checks hostname shape, not
DNS resolution or TLS reachability; the configured DNS name must resolve
publicly and pass the live TLS check after deployment. The Android Gradle
config plugin adds the same validation to generated release tasks, including
release bundle creation. EAS prebuild applies this plugin. Since
`mobile/android` is generated and ignored, use
`npm run android:release` for a local APK: it validates the URL, runs Expo
prebuild to refresh the Gradle guard, then invokes `:app:assembleRelease`. A
raw Gradle command against a stale generated directory does not run Expo
config plugins. Development config and Android debug builds keep the localhost
and LAN HTTP options.

The production EAS profile continues to request remote-managed credentials.
The Gradle build selects the `release` signing config; it does not provide,
replace, or generate signing material. Expo documents that EAS injects remote
signing configuration before invoking Gradle. This repository has no EAS
credentials, so the actual signing integration remains unverified. A
successful local build without the real EAS keystore is not evidence that
production signing works.
