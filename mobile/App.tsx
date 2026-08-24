import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

import { checkBackendHealth } from './src/api/health';
import { fetchCurrentWeather } from './src/api/weather';
import type { CurrentWeather } from './src/types/weather';

type ConnectionState = 'checking' | 'connected' | 'disconnected';
type WeatherState = 'loading' | 'ready' | 'error';

export default function App() {
  const [connection, setConnection] = useState<ConnectionState>('checking');
  const [weatherState, setWeatherState] = useState<WeatherState>('loading');
  const [weather, setWeather] = useState<CurrentWeather | null>(null);

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

  useEffect(() => {
    runHealthCheck();
    loadWeather();
  }, [runHealthCheck, loadWeather]);

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
          <Text style={styles.location}>{weather.location.toUpperCase()}</Text>
          <Text style={styles.temperature}>{Math.round(weather.temperature)}°</Text>
          <Text style={styles.apparent}>
            Hissedilen {Math.round(weather.apparent_temperature)}°
          </Text>
          <View style={styles.row}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Nem</Text>
              <Text>%{weather.humidity}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Rüzgâr</Text>
              <Text>{weather.wind_speed} km/s</Text>
            </View>
          </View>
        </View>
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
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    width: '100%',
  },
  location: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 2,
  },
  temperature: {
    fontSize: 48,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  apparent: {
    fontSize: 16,
    color: '#555',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 32,
  },
  metric: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 13,
    color: '#777',
    marginBottom: 4,
  },
  status: {
    marginTop: 32,
    fontSize: 12,
    color: '#999',
  },
});
