# Android R3 — production APK acceptance

Updated 2026-10-23 (Europe/Istanbul). This release record supersedes the earlier
pre-build status that said Expo was not linked, no keystore existed, no APK was
built, and no Android emulator was available.

The APK, local encrypted backup and on-device emulator observations in this
record were reported by the Codex run on the owner's Mac Studio. GitHub CI and
the repository files can be checked independently, but this GitHub-side review
did **not** independently read the local APK, keystore, backup DMG or ADB logs.
Do not mistake the recorded SHA-256 values for a second local-file verification.

## Production delivery

- Expo owner: `ertugrulcetinkaya`, Free plan.
- EAS project ID: `e49adc1e-99de-4bfc-9556-dbea23f14a4e`.
- EAS project: https://expo.dev/accounts/ertugrulcetinkaya/projects/weather-tracker
- Build: https://expo.dev/accounts/ertugrulcetinkaya/projects/weather-tracker/builds/fa5449f6-c7ad-4466-b3a5-af6f78a506ed
- Profile: `production` with `distribution: internal`, Android `apk`,
  `credentialsSource: remote`, and remote version auto-increment.
- Android package: `com.ertugrulcetinkaya.weathertracker`.
- Built Android versionCode: `2`; checked-in initial versionCode remains `1`
  while remote EAS manages build versions.
- Production backend: `https://weather-tracker-nine-delta.vercel.app`.
  The APK's JS bundle was inspected and reported to contain this origin without
  localhost, loopback or development LAN API hosts.
- Mac local APK: `~/Documents/WeatherTracker-Releases/WeatherTracker-production.apk`.
- Reported APK SHA-256:
  `01128a4fc542738de4b5cb18d8e4d624bbe5478990d5e1a87d5d48ef6a24bc71`.
- Free EAS quota after build: Android `1/15`; total `1/30`; estimated
  additional charges `$0.00`. This is a build-time status, not a guarantee
  of future account charges.

## Signing identity and secure backup

- EAS remote Android signing key created and used for the first signed APK.
- Keystore alias: `e58d8d2d7ac68ebd942ecf5259fca903`.
- APK signing-certificate SHA-256:
  `2B:14:B4:ED:2E:CA:4E:D3:6A:A4:F6:D3:7E:18:26:9D:0E:66:C9:B8:51:A3:56:FB:CF:3B:7D:87:8A:AD:F6:D3`.
- The certificate fingerprint was compared with the exported keystore by the
  Mac Studio Codex run and reported as matching.
- AES-256 encrypted backup:
  `~/Documents/WeatherTracker-Secrets/Android-Signing-Backup.dmg`.
  Reported file mode `600`, containing folder mode `700`.
- The DMG was reportedly unmounted, remounted, read, and the contained
  certificate fingerprint rechecked. An additional `hdiutil verify` invocation
  returned `Resource temporarily unavailable`; that check remains unresolved,
  rather than being represented as a pass.
- A second physically separate encrypted copy has **not** been confirmed.
  The owner should preserve one before relying on this as the sole recovery copy.
- No keystore passwords, private keys, or exported credentials are to be
  committed, uploaded to GitHub Actions artifacts or copied into release notes.

## Real HTTPS service verification

Measured on 2026-10-23 using separate requests with a 10-second cap:

| Endpoint | Result | Per-request times (ms) |
| --- | --- | --- |
| `/health` | 3/3 HTTP 200, `{"status":"ok"}` | 423.5, 327.5, 421.7 |
| `/locations/search?q=istanbul` | 3/3 HTTP 200, five city matches | 814.5, 817.1, 849.9 |
| `/weather/overview` | 3/3 HTTP 200, real Elazığ forecast | 689.2, 714.3, 766.7 |

The observed overview included Elazığ `12.6 °C` and timezone
`Europe/Istanbul`. DNS resolved the domain to `216.198.79.195` and
`64.29.17.195`; TLS 1.3 hostname/chain checks passed with a wildcard
`*.vercel.app` certificate expiring 2026-11-27. All nine requests finished
in less than 0.85 seconds. These samples do not prove all future requests meet
the 10-second client timeout.

Production Vercel function location remains `iad1`; Frankfurt `fra1` was
not A/B benchmarked and no region change was made. Vercel project and deployment
could be read, but team billing/usage details were unavailable due to a
403 scope error; Expo Free usage above was checked separately.

## Android API 36 signed-APK emulator acceptance

Codex reports running the signed APK in AVD
`codex_weather_tracker_api36`, launching its own `MainActivity`; an earlier
Expo Go session was explicitly excluded from APK acceptance.

| Acceptance check | Observed outcome |
| --- | --- |
| Live production API in APK | PASS — public HTTPS origin |
| Search/select İstanbul | PASS |
| Current weather, hourly forecast, rain event | PASS |
| Seven-day forecast | PASS — 7 days shown |
| Hourly list | PASS — 17:00 through next-day 16:00 |
| Ankara then İstanbul city switch | PASS |
| Airplane-mode manual refresh | PASS — offline indicated |
| Cached forecast after offline app restart | PASS |
| Restore network and refresh | PASS — `Veriler güncel` |
| Native APK launch rather than Expo Go | PASS |
| Android dark-system appearance | Observed light theme retained |
| Change city while request still pending | Not separately evidenced |
| Forced HTTP failure or deliberate 10s timeout | Not separately evidenced |
| Physical Samsung installation | NOT PERFORMED — owner acceptance pending |

The Expo prebuild warns that `expo-system-ui` is not installed, so
`userInterfaceStyle: "light"` may not be enforced by Expo on Android.
The observed app remained light under system dark mode. This is a noted
design/configuration follow-up, not a claim of automatic dark-mode support.

## Release configuration and automated checks

- Expo production profile embeds the actual HTTPS API origin.
- `app.config.js` release validation and the Android release Gradle checks
  reject missing, HTTP, localhost, LAN and IP-literal API destinations.
- The reported API 36 manifest merge has `usesCleartextTraffic=false`
  and only required Internet/foreground-location and app-scoped
  dynamic receiver permissions. Unused storage/overlay/vibration
  permissions are explicitly blocked.
- Backend Ruff and 222 pytest tests: PASS.
- Mobile TypeScript and 20 Jest suites / 328 tests: PASS.
- GitHub backend, mobile, Vercel, Preview Comments checks on PR #30: PASS
  at the time this record was prepared.
- `npm audit --omit=dev`: 24 high, 3 moderate, 0 critical advisory paths.
  Reported source-map inspection did not find the listed toolchain
  dependencies in the production bundle; `@react-native/virtualized-lists`
  was present but not used directly by screens. This is targeted triage,
  not a complete security audit. Do not run `npm audit fix --force`
  without compatibility evaluation.

## Outstanding work

- Preserve an independent encrypted backup copy of the Android signing key.
- Investigate the noncritical `hdiutil verify` failure if needed; do not
  discard the successfully reopened backup.
- Record actual behavior for pending-request city switch and deliberately
  delayed/error responses during further acceptance.
- Track the `expo-system-ui` appearance warning and dependency advisories
  separately from first-APK functional acceptance.
- Physical install, update-safety, user-data retention and visual acceptance
  on the Samsung device belong to a separate owner-approved stage.
