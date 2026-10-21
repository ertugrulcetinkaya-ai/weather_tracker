import { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';

import type { RainEvent } from '../types/weather';
import { formatPrecipitation } from '../weather/format';
import { formatRainCountdown, getRainTiming } from '../weather/rainTiming';

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
};

export function NextRainCard({
  nextRain,
  timezone,
  forecastCurrent,
}: NextRainCardProps) {
  const [now, setNow] = useState(() => Date.now());
  const timing =
    nextRain === null || !forecastCurrent || timezone === ''
      ? null
      : getRainTiming(nextRain, timezone, now);

  useEffect(() => {
    if (!forecastCurrent || nextRain === null || timing?.status !== 'future') {
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

  const cardLabel =
    nextRain === null
      ? [
          'Sıradaki yağış.',
          'Önümüzdeki 24 saatte yağış beklenmiyor.',
          forecastCurrent ? '' : 'Tahmin güncel olmayabilir.',
        ]
          .filter(Boolean)
          .join(' ')
      : [
          'Sıradaki yağış.',
          forecastCurrent
            ? timing?.status === 'ongoing'
              ? 'Yağış devam ediyor.'
              : timing?.status === 'future'
                ? formatRainCountdown(timing.millisecondsUntilStart)
                : timing?.status === 'ended'
                  ? 'Bu yağış sona erdi.'
                  : 'Yağış zamanı hesaplanamadı.'
            : 'Tahmin güncel değil. Geri sayım gösterilmiyor.',
          `Saat ${formatHour(nextRain.start_time)} ile ${formatHour(nextRain.end_time)} arasında.`,
          `Toplam ${formatPrecipitation(nextRain.total_precipitation)} mm.`,
          `En yoğun saat ${formatHour(nextRain.peak_time)}.`,
        ].join(' ');

  return (
    <>
      <Text style={styles.rainTitle}>Sıradaki Yağış</Text>
      <View
        accessible
        accessibilityLabel={cardLabel}
        accessibilityRole="text"
        style={styles.rainCard}
      >
        {nextRain !== null ? (
          <>
            <Text style={styles.rainEmoji}>🌧️</Text>
            <Text style={styles.rainTime}>
              {formatHour(nextRain.start_time)} – {formatHour(nextRain.end_time)}
            </Text>
            {forecastCurrent ? (
              <Text style={styles.rainDetail}>
                {timing?.status === 'ongoing'
                  ? 'Yağış devam ediyor.'
                  : timing?.status === 'future'
                    ? formatRainCountdown(timing.millisecondsUntilStart)
                    : timing?.status === 'ended'
                      ? 'Bu yağış sona erdi.'
                      : 'Yağış zamanı hesaplanamadı.'}
              </Text>
            ) : (
              <Text style={styles.staleDetail}>
                Tahmin güncel değil. Geri sayım gösterilmiyor.
              </Text>
            )}
            <Text style={styles.rainDetail}>
              Toplam {formatPrecipitation(nextRain.total_precipitation)} mm
            </Text>
            <Text style={styles.rainDetail}>
              En yoğun: {formatHour(nextRain.peak_time)}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.rainEmoji}>☀️</Text>
            <Text style={styles.rainDetail}>
              Önümüzdeki 24 saatte yağış beklenmiyor.
            </Text>
            {!forecastCurrent && (
              <Text style={styles.staleDetail}>Tahmin güncel olmayabilir.</Text>
            )}
          </>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  rainCard: {
    backgroundColor: '#f2f6fa',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e1e8f0',
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  rainTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginTop: 20,
    marginBottom: 8,
  },
  rainEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  rainTime: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  rainDetail: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  staleDetail: {
    fontSize: 13,
    color: '#9a3412',
    marginBottom: 2,
  },
});
