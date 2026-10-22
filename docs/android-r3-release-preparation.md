# Android R3 release preparation

Checked 2026-10-23 (Europe/Istanbul) against the live Vercel service. All endpoint
requests below were real HTTPS requests with `curl --max-time 10`; no fixture or
mock data is presented as live output.

## Live HTTPS results

- DNS resolved `weather-tracker-nine-delta.vercel.app` to `216.198.79.195` and
  `64.29.17.195`.
- TLS hostname and chain verification passed. The server negotiated TLS 1.3;
  the certificate covers `*.vercel.app`, is issued by Google Trust Services
  (WR1), and expires 2026-11-27.
- The Vercel production deployment metadata identifies commit
  `ab8739441be86ea05d98305c74c0c0408bba312b` and Function region `iad1`.

Each timing sample was a separate request, including a new client connection.
The response-time limit was 10 seconds per request.

| Live endpoint | HTTP | Responses | Total time (ms) | Real response sample |
| --- | ---: | ---: | --- | --- |
| `/health` | 200 | 3/3 | 423.5, 327.5, 421.7 | `{"status":"ok"}` |
| `/locations/search?q=istanbul` | 200 | 3/3 | 814.5, 817.1, 849.9 | First result: İstanbul, 41.01384, 28.94966, Türkiye Cumhuriyeti; five results returned. |
| `/weather/overview` | 200 | 3/3 | 689.2, 714.3, 766.7 | Live current record: Elazığ, 12.6 °C, feels like 11.0 °C, 65% humidity, 4.2 wind speed, weather code 0, timestamp `2026-10-23T00:00`; timezone `Europe/Istanbul`. |

All nine requests completed within 0.85 seconds, below the mobile client's
10-second timeout. No live request failed, so live retry behavior was not
triggered. The mobile client applies a 10-second abort timeout and does not
automatically retry HTTP or network errors. The overview hook exposes a manual
refresh/retry action and retains the location-specific cached forecast when
the network is unavailable; location search can be submitted again by the
user. These behaviors are covered by the mobile tests.

## Android production configuration

- The production EAS profile now embeds
  `EXPO_PUBLIC_API_BASE_URL=https://weather-tracker-nine-delta.vercel.app`.
  App API calls share one client base URL, so city search and weather overview
  both use this production origin.
- Release config rejects missing, non-HTTPS, localhost, LAN, and IP-literal API
  hosts. The Android release manifest policy sets `usesCleartextTraffic=false`;
  the debug variant keeps cleartext enabled for local development.
- The API 36 release manifest merge completed successfully. The merged
  manifest sets `usesCleartextTraffic=false` and contains Internet, foreground
  coarse/fine location, and the app-scoped dynamic-receiver permission.
  Storage, overlay, and vibration permissions from Expo's default native
  template are removed because the app has no such feature.
- A production Android JavaScript export includes the configured Vercel hostname
  and contains no `http://localhost`, `http://127.0.0.1`, or development LAN API
  URL. It does not contain the loopback IP at all. This is a bundle check, not
  a signed APK inspection.
- Android application ID remains
  `com.ertugrulcetinkaya.weathertracker`. The checked-in initial `versionCode`
  is `1`; EAS uses a remote version source and production auto-increment. Expo's
  documented behavior is to initialize the remote value from `1` and increment
  the first remote build to `2`. This repository has no release tags or GitHub
  releases; Google Play Console history was not available to check for an
  earlier external version.
- The EAS production profile requests an internally distributed signed APK.
  This APK format is installable for emulator/device acceptance; it is not a
  Google Play upload artifact (Play submission requires an AAB).
- `adb devices -l` found no connected device. Installed-package and user-data
  state therefore could not be queried. No APK was installed.

## EAS signing state

`eas.json` selects `credentialsSource: "remote"`, but the app config has no
EAS `projectId`/owner link and the EAS CLI is not installed. Remote Android
credentials therefore could not be queried. The isolated Gradle manifest
check generated an ignored `mobile/android/app/debug.keystore` for the debug
variant. No production release keystore or EAS signing credential was found,
and none was created.

Once the owner approves EAS project linking and production signing, the
operation that creates a persistent key is the EAS Android credentials flow
when **Generate new keystore** is selected (or a production EAS build is
started with remote credentials missing and generation accepted). That key
must be securely backed up and its certificate fingerprint verified before
the signed APK is accepted. The signed production APK has not been built.

## Vercel plan and regions

The connected Vercel integration could read the production project and
deployment, but its team billing/usage request returned 403 for the account
scope. The account's actual plan and live quota consumption could not be
independently confirmed. Vercel's current Hobby documentation describes a
free personal-use plan with 1,000,000 Function invocations and 100 GB of Fast
Data Transfer included; over-limit Hobby usage is restricted until its usage
window resets rather than automatically becoming a paid plan. No paid plan,
resource, or deployment was created for this preparation.

The live function currently runs in `iad1` and returned these measured times
from the current client. Frankfurt (`fra1`) is geographically closer to
Istanbul, but no controlled `fra1` deployment was created, so a numerical
`fra1` comparison is not available. The measured `iad1` calls already finish
in under one second, with margin against the 10-second mobile timeout; the
evidence does not justify changing the live region. This is a decision from
the actual `iad1` measurements and region distance, not an A/B benchmark.

## API 36 emulator acceptance plan

Run this after a signed APK is approved and available. Do not install it on a
physical Samsung device as part of this plan.

1. Install on an Android API 36 emulator and confirm package ID, version code,
   launch, and that the release manifest denies cleartext traffic while
   retaining the required Internet permission and foreground location only.
2. With network available, load the overview and search for Istanbul; confirm
   both requests target the HTTPS Vercel origin and render returned weather and
   city data.
3. Disable emulator networking. Confirm a previously cached forecast remains
   visible with its stale/offline state, then restore networking and use the
   explicit retry/refresh action.
4. Change the selected city while a forecast request is pending. Confirm the
   old response is discarded, the selected city's cache is used, and the next
   response is shown only for the new city.
5. Force an API error and a delayed request. Confirm the error is surfaced,
   the 10-second client timeout is respected, and an explicit retry recovers.
6. Inspect the generated release APK's manifest and bundled API origin before
   installing it. Confirm the configured base is HTTPS and no request can fall
   back to localhost.

This plan was not executed: no emulator AVD/emulator binary or connected ADB
device was available, and the production APK remains approval-gated.

Expo prebuild also warns that `expo-system-ui` is missing, so the existing
`userInterfaceStyle: "light"` setting is not applied on Android. It was left
unchanged rather than adding a dependency or changing the current design.

## Verification results

- Backend: Ruff passed; pytest passed (222 tests).
- Mobile: TypeScript passed; Jest passed (20 suites, 328 tests).
- Production Expo config resolved to the live HTTPS URL, stable package ID,
  version code seed, internal distribution, APK build type, and remote signing.
- Production Android export contains the live host and no loopback URL or LAN
  API address. The Gradle release manifest task passed with the public HTTPS
  environment, compile SDK 36, target SDK 36, and cleartext traffic disabled.
- `npm audit --omit=dev` reported 27 advisory paths (24 high, 3 moderate)
  through Expo CLI/Metro, React Native tooling, `node-forge`, and `uuid`.
  Reachability in the shipped APK has not been triaged; `npm audit --force`
  proposes incompatible major-version changes. No dependency upgrade was made.
- No signed APK was created, no EAS credentials were generated, and no device
  was modified.
