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

function PrecipitationMark({ color }: { color: string }) {
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.precipitationMark}
    >
      <View style={[styles.markBar, styles.markBarShort, { backgroundColor: color }]} />
      <View style={[styles.markBar, styles.markBarMedium, { backgroundColor: color }]} />
      <View style={[styles.markBar, styles.markBarTall, { backgroundColor: color }]} />
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
        ].join(' ');

  const sectionTitleColor = theme.kind === 'rainy' ? '#15324D' : theme.text;

  return (
    <>
      <Text allowFontScaling style={[styles.sectionTitle, { color: sectionTitleColor }]}>
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
        <View style={styles.statusHeading}>
          <View style={[styles.iconBadge, { backgroundColor: theme.accentSoft }]}>
            <PrecipitationMark color={theme.accent} />
          </View>
          <Text allowFontScaling style={[styles.eyebrow, { color: theme.mutedText }]}>
            {nextRain === null
              ? 'ÖNÜMÜZDEKİ 24 SAAT'
              : forecastCurrent
                ? 'SIRADAKİ YAĞIŞ'
                : 'SON KAYDEDİLEN TAHMİN'}
          </Text>
        </View>

        <Text
          testID="next-rain-status"
          allowFontScaling
          style={[
            styles.status,
            { color: theme.text },
            nextRain === null && styles.noRainStatus,
          ]}
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
            <View style={[styles.separator, { backgroundColor: theme.surfaceBorder }]} />

            <View style={[styles.timeRange, { backgroundColor: theme.accentSoft }]}>
              <Text allowFontScaling style={[styles.localTimeHint, { color: theme.mutedText }]}>
                Seçili şehrin yerel saati
              </Text>
              <View style={styles.timeColumns}>
                <View style={styles.timeColumn}>
                  <Text allowFontScaling style={[styles.detailLabel, { color: theme.mutedText }]}>
                    BAŞLANGIÇ
                  </Text>
                  <Text
                    testID="rain-start-time"
                    allowFontScaling
                    style={[styles.timeValue, { color: theme.text }]}
                  >
                    {formatHour(nextRain.start_time)}
                  </Text>
                </View>
                <View style={[styles.timeDivider, { backgroundColor: theme.surfaceBorder }]} />
                <View style={styles.timeColumn}>
                  <Text allowFontScaling style={[styles.detailLabel, { color: theme.mutedText }]}>
                    BİTİŞ
                  </Text>
                  <Text
                    testID="rain-end-time"
                    allowFontScaling
                    style={[styles.timeValue, { color: theme.text }]}
                  >
                    {formatHour(nextRain.end_time)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.metrics}>
              <View style={styles.metric}>
                <Text allowFontScaling style={[styles.detailLabel, { color: theme.mutedText }]}>
                  TOPLAM YAĞIŞ
                </Text>
                <Text
                  testID="rain-total"
                  allowFontScaling
                  style={[styles.metricValue, { color: theme.text }]}
                >
                  {formatPrecipitation(nextRain.total_precipitation)} mm
                </Text>
              </View>
              <View style={[styles.metricDivider, { backgroundColor: theme.surfaceBorder }]} />
              <View style={styles.metric}>
                <Text allowFontScaling style={[styles.detailLabel, { color: theme.mutedText }]}>
                  EN YOĞUN SAAT
                </Text>
                <Text
                  testID="rain-peak-time"
                  allowFontScaling
                  style={[styles.metricValue, { color: theme.text }]}
                >
                  {formatHour(nextRain.peak_time)}
                </Text>
              </View>
            </View>
          </>
        )}
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
    padding: 16,
    marginBottom: 8,
  },
  statusHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  precipitationMark: {
    height: 19,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  markBar: { width: 3, borderRadius: 2 },
  markBarShort: { height: 7 },
  markBarMedium: { height: 12 },
  markBarTall: { height: 17 },
  eyebrow: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  status: {
    flexShrink: 1,
    fontSize: 26,
    lineHeight: 33,
    fontWeight: '700',
    marginTop: 12,
  },
  noRainStatus: {
    fontSize: 18,
    lineHeight: 25,
  },
  freshnessNote: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  separator: {
    height: 1,
    marginTop: 16,
    marginBottom: 14,
  },
  timeRange: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  localTimeHint: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 7,
  },
  timeColumns: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  timeColumn: {
    flex: 1,
    minWidth: 0,
  },
  timeDivider: {
    width: 1,
    marginHorizontal: 12,
  },
  detailLabel: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    letterSpacing: 0.35,
  },
  timeValue: {
    flexShrink: 1,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    marginTop: 2,
  },
  metrics: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 14,
  },
  metric: {
    flex: 1,
    minWidth: 0,
  },
  metricDivider: {
    width: 1,
    marginHorizontal: 12,
  },
  metricValue: {
    flexShrink: 1,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '700',
    marginTop: 2,
  },
});
