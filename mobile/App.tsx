import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';

import { checkBackendHealth } from './src/api/health';
import { fetchCurrentWeather, fetchHourlyWeather } from './src/api/weather';
import type { CurrentWeather, HourlyWeather } from './src/types/weather';
import { formatWeatherTime, getWeatherCondition } from './src/weather/condition';

type ConnectionState = 'checking' | 'connected' | 'disconnected';
type WeatherState = 'loading' | 'ready' | 'error';

export default function App() {
  const [connection, setConnection] = useState<ConnectionState>('checking');
  const [weatherState, setWeatherState] = useState<WeatherState>('loading');
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [hourlyState, setHourlyState] = useState<WeatherState>('loading');
  const [hourly, setHourly] = useState<HourlyWeather[]>([]);

  const runHealthCheck = useCallback(async () => {
    setConnection('checking');
    try {
      await checkBackendHealth();
      setConnection('connected');
    } catch {
      setConnection('disconnected');
    }
  }, []);

  const loadWeather = useCallback(async () => {
    setWeatherState('loading');
    try {
      setWeather(await fetchCurrentWeather());
      setWeatherState('ready');
    } catch {
      setWeatherState('error');
    }
  }, []);

  const loadHourlyWeather = useCallback(async () => {
    setHourlyState('loading');
    try {
      setHourly(await fetchHourlyWeather());
      setHourlyState('ready');
    } catch {
      setHourlyState('error');
    }
  }, []);

  useEffect(() => {
    runHealthCheck();
    loadWeather();
    loadHourlyWeather();
  }, [runHealthCheck, loadWeather, loadHourlyWeather]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hava Takip</Text>
      {weatherState === 'loading' && <Text>Hava durumu yükleniyor...</Text>}
      {weatherState === 'error' && (
        <>
          <Text>Hava durumu alınamadı.</Text>
          <Button title="Tekrar Dene" onPress={loadWeather} />
        </>
      )}
      {weatherState === 'ready' && weather !== null && (
        <View style={styles.card}>
          <Text style={styles.emoji}>{getWeatherCondition(weather.weather_code).emoji}</Text>
          <Text style={styles.location}>{weather.location.toUpperCase()}</Text>
          <Text style={styles.temperature}>{Math.round(weather.temperature)}°</Text>
          <Text style={styles.condition}>
            {getWeatherCondition(weather.weather_code).label}
          </Text>
          <Text style={styles.apparent}>
            Hissedilen {Math.round(weather.apparent_temperature)}°
          </Text>
          <Text style={styles.updatedAt}>{formatWeatherTime(weather.time)}</Text>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Nem</Text>
              <Text style={styles.metricValue}>%{weather.humidity}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Rüzgâr</Text>
              <Text style={styles.metricValue}>{weather.wind_speed} km/s</Text>
            </View>
          </View>
        </View>
      )}

      <Text style={styles.hourlyTitle}>Saatlik Tahmin</Text>

      {hourlyState === 'loading' && (
        <Text style={styles.status}>Saatlik tahmin yükleniyor...</Text>
      )}

      {hourlyState === 'error' && (
        <Text style={styles.status}>Saatlik tahmin alınamadı.</Text>
      )}

      {hourlyState === 'ready' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.hourlyScroll}
          contentContainerStyle={styles.hourlyContent}
        >
          {hourly.map((h) => (
            <View key={h.time} style={styles.hourlyCard}>
              <Text style={styles.hourlyTime}>
                {h.time.slice(11, 16)}
              </Text>
              <Text style={styles.hourlyEmoji}>
                {getWeatherCondition(h.weather_code).emoji}
              </Text>
              <Text style={styles.hourlyTemperature}>
                {Math.round(h.temperature)}°C
              </Text>
              <Text style={styles.hourlyPrecipitation}>
                {h.precipitation} mm
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      <Text style={styles.status}>
        {connection === 'checking'
          ? 'Backend kontrol ediliyor...'
          : connection === 'connected'
            ? 'Backend: Bağlı'
            : 'Backend: Bağlantı Yok'}
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
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
  status: {
    marginTop: 32,
    fontSize: 12,
    color: '#999',
  },
  hourlyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  hourlyScroll: {
    width: '100%',
  },
  hourlyContent: {
    paddingRight: 16,
  },
  hourlyCard: {
    width: 72,
    backgroundColor: '#f2f6fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1e8f0',
    padding: 10,
    alignItems: 'center',
    marginRight: 8,
  },
  hourlyTime: {
    fontSize: 11,
    color: '#777',
    marginBottom: 6,
  },
  hourlyEmoji: {
    fontSize: 22,
    marginBottom: 6,
  },
  hourlyTemperature: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  hourlyPrecipitation: {
    fontSize: 10,
    color: '#555',
  },
});
