import { StyleSheet, Text, View } from 'react-native';

import type { RainEvent } from '../types/weather';

function formatHour(time: string): string {
  const parts = time.split('T');
  if (parts.length < 2) return time;
  const timePart = parts[1];
  const match = timePart.match(/^(\d{2}):(\d{2})/);
  if (match) return `${match[1]}:${match[2]}`;
  return timePart;
}

export function NextRainCard({ nextRain }: { nextRain: RainEvent | null }) {
  return (
    <>
      <Text style={styles.rainTitle}>Sıradaki Yağış</Text>
      <View style={styles.rainCard}>
        {nextRain !== null ? (
          <>
            <Text style={styles.rainEmoji}>🌧️</Text>
            <Text style={styles.rainTime}>
              {formatHour(nextRain.start_time)} –{' '}
              {formatHour(nextRain.end_time)}
            </Text>
            <Text style={styles.rainDetail}>
              Toplam {Number(nextRain.total_precipitation.toFixed(2))} mm
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
});
