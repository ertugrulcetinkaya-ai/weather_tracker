import { StyleSheet, Text, View } from 'react-native';
import type { HourlyWeather } from '../types/weather';
import { getWeatherTheme } from '../weather/theme';
import type { WeatherTheme } from '../weather/theme';
import { getHourlyChartPalette, HourlyWeatherChart } from './HourlyWeatherChart';

type HourlyForecastProps = {
  hourly: HourlyWeather[];
  rainStartTime?: string | null;
  theme?: WeatherTheme;
};

function formatHour(time: string): string {
  const match = /(?:T|^)(\d{2}):(\d{2})/.exec(time);
  return match ? `${match[1]}:${match[2]}` : time;
}

function shiftWallClockHour(time: string, hourOffset: number): string | null {
  const wallClockTime = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/.exec(time)?.[1];
  if (!wallClockTime) return null;

  // Keep provider wall-clock times independent of the device timezone and DST.
  const timestamp = Date.parse(`${wallClockTime}:00Z`);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp + hourOffset * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export function HourlyForecast({
  hourly,
  rainStartTime = null,
  theme,
}: HourlyForecastProps) {
  const resolvedTheme = theme ?? getWeatherTheme(hourly[0]?.weather_code);
  const palette = getHourlyChartPalette(resolvedTheme);
  const rainStartRecordTime =
    rainStartTime === null ? null : shiftWallClockHour(rainStartTime, 1);
  const firstRainStartIndex =
    rainStartRecordTime === null
      ? -1
      : hourly.findIndex((candidate) => candidate.time.slice(0, 16) === rainStartRecordTime);
  const hasRainStart =
    firstRainStartIndex >= 0 && hourly[firstRainStartIndex].precipitation > 0;
  const rainStartInterval = hasRainStart
    ? `${formatHour(rainStartTime ?? '')}–${formatHour(hourly[firstRainStartIndex].time)}`
    : null;

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text
          style={[
            styles.hourlyTitle,
            { color: resolvedTheme.text },
          ]}
        >
          24 Saatlik Tahmin
        </Text>
        {hourly.length > 1 && (
          <Text accessible={false} style={[styles.scrollHint, { color: resolvedTheme.mutedText }]}>
            Yatay kaydırın →
          </Text>
        )}
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: resolvedTheme.surface,
            borderColor: resolvedTheme.surfaceBorder,
          },
        ]}
      >
        {hourly.length === 0 ? (
          <Text
            testID="hourly-empty-state"
            style={[styles.emptyState, { color: resolvedTheme.mutedText }]}
          >
            Saatlik tahmin bulunmuyor.
          </Text>
        ) : (
          <>
            <View style={styles.legend} accessible={false}>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.temperatureSwatch,
                    { backgroundColor: palette.temperatureLine },
                  ]}
                />
                <Text style={[styles.legendText, { color: resolvedTheme.text }]}>
                  Sıcaklık (°C)
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.precipitationSwatch,
                    { backgroundColor: palette.precipitationBar },
                  ]}
                />
                <Text style={[styles.legendText, { color: resolvedTheme.text }]}>
                  Yağış miktarı (mm)
                </Text>
              </View>
              <Text style={[styles.legendText, { color: resolvedTheme.text }]}>
                Yağış olasılığı (%)
              </Text>
            </View>

            <Text style={[styles.intervalHint, { color: resolvedTheme.mutedText }]}>
              Sıcaklık gösterilen saatte; her yağış sütunu o saatte biten önceki 1 saatte.
            </Text>

            {hasRainStart && rainStartInterval !== null && (
              <View
                accessible={false}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[
                  styles.rainStartNotice,
                  { backgroundColor: resolvedTheme.accentSoft },
                ]}
              >
                <Text
                  allowFontScaling
                  style={[styles.rainStartText, { color: resolvedTheme.text }]}
                >
                  Yağış başlar {formatHour(rainStartTime ?? '')} · ilk sütun {rainStartInterval}
                </Text>
              </View>
            )}

            <HourlyWeatherChart
              hourly={hourly}
              theme={resolvedTheme}
              rainStartIndex={hasRainStart ? firstRainStartIndex : -1}
              rainStartTime={rainStartTime}
              rainStartInterval={rainStartInterval}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: '100%' },
  titleRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 24,
    marginBottom: 12,
  },
  hourlyTitle: {
    flexShrink: 1,
    fontSize: 18,
    fontWeight: '600',
  },
  scrollHint: {
    flexShrink: 0,
    fontSize: 12,
    fontWeight: '500',
  },
  card: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    paddingTop: 14,
    paddingBottom: 12,
    overflow: 'hidden',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 14,
    rowGap: 8,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  temperatureSwatch: { width: 18, height: 3, borderRadius: 2 },
  precipitationSwatch: { width: 8, height: 14, borderRadius: 5 },
  legendText: { fontSize: 12, fontWeight: '500' },
  intervalHint: {
    paddingHorizontal: 14,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  rainStartNotice: {
    alignSelf: 'stretch',
    marginHorizontal: 14,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  rainStartText: { fontSize: 13, fontWeight: '600' },
  emptyState: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    fontSize: 14,
    textAlign: 'center',
  },
});
