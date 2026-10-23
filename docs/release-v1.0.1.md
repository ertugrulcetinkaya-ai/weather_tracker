# Weather Tracker 1.0.1

Android production APK release for the current `main` application.

- Forecast updates automatically when the app returns to the foreground and can be refreshed by pulling down.
- The app keeps the last successful forecast visible during refresh and reports when offline data may be stale.
- Favorite changes made during preference loading are reconciled with saved favorites to avoid losing existing locations.
- Hourly rain events use the provider's preceding-hour interval, so rain start, end, and peak times align with the forecast.

The production APK is built with the signed EAS `production` profile and linked from the GitHub release. Android build numbers are managed remotely by EAS.
