import { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';

import type { RainEvent } from '../types/weather';
import { formatPrecipitation } from '../weather/format';
import { formatRainCountdown, getRainTiming } from '../weather/rainTiming';
import { getWeatherTheme } from '../weather/theme';
import type { WeatherTheme } from '../weather/theme';

function formatHour(time: string): string {
  const parts = time.split('T');
  if (parts.length < 2) return time;
  const timePart = parts[1];
  const match = timePart.match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : timePart;
}

type NextRainCardProps = {
  nextRain: RainEvent | null;
  timezone: string;
  forecastCurrent: boolean;
  theme?: WeatherTheme;
};

function PrecipitationMark({ cloudColor, accentColor }: { cloudColor: string; accentColor: string }) {
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.precipitationMark}
    >
      <View style={[styles.cloudPuff, styles.cloudPuffLeft, { backgroundColor: cloudColor }]} />
      <View style={[styles.cloudPuff, styles.cloudPuffTop, { backgroundColor: cloudColor }]} />
      <View style={[styles.cloudPuff, styles.cloudPuffRight, { backgroundColor: cloudColor }]} />
      <View style={[styles.cloudBase, { backgroundColor: cloudColor }]} />
      <View style={[styles.precipitationDot, styles.precipitationDotLeft, { backgroundColor: accentColor }]} />
      <View style={[styles.precipitationDot, styles.precipitationDotMiddle, { backgroundColor: accentColor }]} />
      <View style={[styles.precipitationDot, styles.precipitationDotRight, { backgroundColor: accentColor }]} />
    </View>
  );
}

export function NextRainCard({
  nextRain,
  timezone,
  forecastCurrent,
  theme: suppliedTheme,
}: NextRainCardProps) {
  const [now, setNow] = useState(() => Date.now());
  const theme = suppliedTheme ?? getWeatherTheme(null);
  const timing =
    nextRain === null || !forecastCurrent || timezone === ''
      ? null
      : getRainTiming(nextRain, timezone, now);

  useEffect(() => {
    if (
      !forecastCurrent ||
      nextRain === null ||
      (timing?.status !== 'future' && timing?.status !== 'ongoing')
    ) {
      return undefined;
    }

    let interval: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }
    };
    const start = () => {
      stop();
      setNow(Date.now());
      interval = setInterval(() => setNow(Date.now()), 60_000);
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') start();
      else stop();
    });

    if (
      AppState.currentState === 'active' ||
      AppState.currentState === 'unknown' ||
      AppState.currentState === null
    ) {
      start();
    }

    return () => {
      stop();
      subscription.remove();
    };
  }, [forecastCurrent, nextRain, timing?.status, timezone]);

  const statusText =
    nextRain === null
      ? 'Önümüzdeki 24 saatte yağış beklenmiyor.'
      : !forecastCurrent
        ? 'Tahmin güncel değil. Geri sayım gösterilmiyor.'
        : timing?.status === 'ongoing'
          ? 'Yağış devam ediyor.'
          : timing?.status === 'future'
            ? formatRainCountdown(timing.millisecondsUntilStart)
            : timing?.status === 'ended'
              ? 'Bu yağış sona erdi.'
              : 'Yağış zamanı kesin olarak hesaplanamıyor.';

  const freshnessNote =
    !forecastCurrent && nextRain === null ? 'Tahmin güncel olmayabilir.' : null;
  const cardLabel =
    nextRain === null
      ? [
          'Sıradaki yağış.',
          statusText,
          freshnessNote ?? '',
        ]
          .filter(Boolean)
          .join(' ')
      : [
          'Sıradaki yağış.',
          statusText,
          `Başlangıç ${formatHour(nextRain.start_time)}, bitiş ${formatHour(nextRain.end_time)}; seçili şehrin yerel saati.`,
          `Toplam ${formatPrecipitation(nextRain.total_precipitation)} mm.`,
          `En yoğun saat ${formatHour(nextRain.peak_time)}.`,
          'Yağış türü belirtilmiyor.',
        ].join(' ');

  return (
    <>
      <Text allowFontScaling style={[styles.sectionTitle, { color: theme.text }]}>
        Sıradaki Yağış
      </Text>
      <View
        testID="next-rain-card"
        accessible
        accessibilityLabel={cardLabel}
        accessibilityRole="text"
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: theme.surfaceBorder,
          },
        ]}
      >
        <View style={styles.contentRow}>
          <View style={[styles.iconBadge, { backgroundColor: theme.accentSoft }]}>
            <PrecipitationMark cloudColor={theme.mutedText} accentColor={theme.accent} />
          </View>
          <View style={styles.details}>
            {nextRain !== null && (
              <View style={styles.timeRangeCompact}>
                <Text
                  testID="rain-start-time"
                  allowFontScaling
                  style={[styles.timeValue, { color: theme.mutedText }]}
                >
                  {formatHour(nextRain.start_time)}
                </Text>
                <Text allowFontScaling style={[styles.rangeSeparator, { color: theme.mutedText }]}>–</Text>
                <Text
                  testID="rain-end-time"
                  allowFontScaling
                  style={[styles.timeValue, { color: theme.mutedText }]}
                >
                  {formatHour(nextRain.end_time)}
                </Text>
                <Text allowFontScaling style={[styles.localTimeHint, { color: theme.mutedText }]}>· Yerel saat</Text>
              </View>
            )}

            <Text
              testID="next-rain-status"
              allowFontScaling
              style={[styles.status, { color: theme.text }]}
            >
              {statusText}
            </Text>

            {freshnessNote !== null && (
              <Text allowFontScaling style={[styles.freshnessNote, { color: theme.mutedText }]}>
                {freshnessNote}
              </Text>
            )}

            {nextRain !== null && (
              <>
                <View style={styles.metrics}>
                  <Text allowFontScaling style={[styles.metricValue, { color: theme.mutedText }]}>Toplam </Text>
                  <Text
                    testID="rain-total"
                    allowFontScaling
                    style={[styles.metricValue, { color: theme.mutedText }]}
                  >
                    {formatPrecipitation(nextRain.total_precipitation)} mm
                  </Text>
                  <Text allowFontScaling style={[styles.metricValue, { color: theme.mutedText }]}> · En yoğun </Text>
                  <Text
                    testID="rain-peak-time"
                    allowFontScaling
                    style={[styles.metricValue, { color: theme.mutedText }]}
                  >
                    {formatHour(nextRain.peak_time)}
                  </Text>
                </View>
                <Text allowFontScaling style={[styles.typeNote, { color: theme.mutedText }]}>
                  Yağış türü belirtilmiyor.
                </Text>
              </>
            )}
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
  },
  card: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  precipitationMark: {
    position: 'relative',
    width: 30,
    height: 28,
  },
  cloudPuff: { position: 'absolute', borderRadius: 10 },
  cloudPuffLeft: { left: 3, top: 10, width: 13, height: 12 },
  cloudPuffTop: { left: 9, top: 4, width: 17, height: 17 },
  cloudPuffRight: { left: 17, top: 9, width: 11, height: 12 },
  cloudBase: { position: 'absolute', left: 3, top: 13, width: 25, height: 9, borderRadius: 6 },
  precipitationDot: { position: 'absolute', top: 24, width: 3, height: 3, borderRadius: 2 },
  precipitationDotLeft: { left: 8 },
  precipitationDotMiddle: { left: 15 },
  precipitationDotRight: { left: 22 },
  details: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  timeRangeCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: 3,
    rowGap: 1,
  },
  rangeSeparator: { fontSize: 12, lineHeight: 17 },
  localTimeHint: { fontSize: 11, lineHeight: 17, marginLeft: 3 },
  status: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
    marginTop: 2,
  },
  freshnessNote: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  timeValue: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 2,
  },
  metricValue: { fontSize: 12, lineHeight: 17 },
  typeNote: { fontSize: 11, lineHeight: 15, marginTop: 1 },
});
