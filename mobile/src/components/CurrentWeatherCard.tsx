import { StyleSheet, Text, View } from 'react-native';

import type { CurrentWeather } from '../types/weather';
import { formatWeatherTime, getWeatherCondition } from '../weather/condition';
import { formatWindSpeed } from '../weather/format';

type CurrentWeatherCardProps = {
  current: CurrentWeather;
  fetchedAt?: number | null;
};

function formatLastUpdated(fetchedAt: number): string {
  const time = new Date(fetchedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `Son güncelleme: ${time}`;
}

export function CurrentWeatherCard({ current, fetchedAt }: CurrentWeatherCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.emoji}>
        {getWeatherCondition(current.weather_code).emoji}
      </Text>
      <Text style={styles.location}>{current.location.toUpperCase()}</Text>
      <Text style={styles.temperature}>{Math.round(current.temperature)}°</Text>
      <Text style={styles.condition}>
        {getWeatherCondition(current.weather_code).label}
      </Text>
      <Text style={styles.apparent}>
        Hissedilen {Math.round(current.apparent_temperature)}°
      </Text>
      <Text style={styles.updatedAt}>{formatWeatherTime(current.time)}</Text>
      {fetchedAt !== null && fetchedAt !== undefined && (
        <Text style={styles.lastUpdated}>{formatLastUpdated(fetchedAt)}</Text>
      )}
      <View style={styles.divider} />
      <View style={styles.row}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Nem</Text>
          <Text style={styles.metricValue}>%{current.humidity}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Rüzgâr</Text>
          <Text style={styles.metricValue}>
            {formatWindSpeed(current.wind_speed)} km/h
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f2f6fa',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e1e8f0',
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    width: '100%',
  },
  emoji: {
    fontSize: 44,
    marginBottom: 4,
  },
  location: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 2,
  },
  temperature: {
    fontSize: 52,
    fontWeight: 'bold',
    marginTop: 4,
    marginBottom: 2,
  },
  condition: {
    fontSize: 16,
    fontWeight: '500',
  },
  apparent: {
    fontSize: 15,
    color: '#555',
    marginTop: 4,
  },
  updatedAt: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
  },
  lastUpdated: {
    fontSize: 11,
    color: '#9aa5b1',
    marginTop: 4,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#dde5ee',
    marginVertical: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 40,
  },
  metric: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 13,
    color: '#777',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
  },
});
