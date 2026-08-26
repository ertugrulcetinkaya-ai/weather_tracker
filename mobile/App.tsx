import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { checkBackendHealth } from './src/api/health';
import { fetchCurrentWeather, fetchHourlyWeather, fetchNextRainEvent } from './src/api/weather';
import type { CurrentWeather, HourlyWeather, RainEvent, WeatherLocation } from './src/types/weather';
import { formatWeatherTime, getWeatherCondition } from './src/weather/condition';

type ConnectionState = 'checking' | 'connected' | 'disconnected';
type WeatherState = 'loading' | 'ready' | 'error';

const WEATHER_LOCATIONS: WeatherLocation[] = [
  { name: 'Elazığ', latitude: 38.6743, longitude: 39.2232 },
  { name: 'İstanbul', latitude: 41.0082, longitude: 28.9784 },
  { name: 'Ankara', latitude: 39.9334, longitude: 32.8597 },
];

function formatHour(time: string): string {
  const parts = time.split('T');
  if (parts.length < 2) return time;
  const timePart = parts[1];
  const match = timePart.match(/^(\d{2}):(\d{2})/);
  if (match) return `${match[1]}:${match[2]}`;
  return timePart;
}

export default function App() {
  const [connection, setConnection] = useState<ConnectionState>('checking');
  const [selectedLocation, setSelectedLocation] = useState<WeatherLocation>(WEATHER_LOCATIONS[0]);
  const [weatherState, setWeatherState] = useState<WeatherState>('loading');
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [hourlyState, setHourlyState] = useState<WeatherState>('loading');
  const [hourly, setHourly] = useState<HourlyWeather[]>([]);
  const [rainState, setRainState] = useState<WeatherState>('loading');
  const [nextRain, setNextRain] = useState<RainEvent | null>(null);
  const requestSeq = useRef(0);

  const runHealthCheck = useCallback(async () => {
    setConnection('checking');
    try {
      await checkBackendHealth();
      setConnection('connected');
    } catch {
      setConnection('disconnected');
    }
  }, []);

  const loadWeather = useCallback(async (loc: WeatherLocation) => {
    const seq = ++requestSeq.current;
    setWeatherState('loading');
    try {
      const data = await fetchCurrentWeather(loc);
      if (seq !== requestSeq.current) return;
      setWeather(data);
      setWeatherState('ready');
    } catch {
      if (seq !== requestSeq.current) return;
      setWeatherState('error');
    }
  }, []);

  const loadHourlyWeather = useCallback(async (loc: WeatherLocation) => {
    const seq = ++requestSeq.current;
    setHourlyState('loading');
    try {
      const data = await fetchHourlyWeather(loc);
      if (seq !== requestSeq.current) return;
      setHourly(data);
      setHourlyState('ready');
    } catch {
      if (seq !== requestSeq.current) return;
      setHourlyState('error');
    }
  }, []);

  const loadNextRain = useCallback(async (loc: WeatherLocation) => {
    const seq = ++requestSeq.current;
    setRainState('loading');
    try {
      const data = await fetchNextRainEvent(loc);
      if (seq !== requestSeq.current) return;
      setNextRain(data);
      setRainState('ready');
    } catch {
      if (seq !== requestSeq.current) return;
      setRainState('error');
    }
  }, []);

  useEffect(() => {
    runHealthCheck();
  }, [runHealthCheck]);

  useEffect(() => {
    loadWeather(selectedLocation);
    loadHourlyWeather(selectedLocation);
    loadNextRain(selectedLocation);
  }, [selectedLocation, loadWeather, loadHourlyWeather, loadNextRain]);

  const handleCitySelect = (loc: WeatherLocation) => {
    if (loc.name === selectedLocation.name) return;
    setSelectedLocation(loc);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hava Takip</Text>

      <View style={styles.cityRow}>
        {WEATHER_LOCATIONS.map((loc) => (
          <Pressable
            key={loc.name}
            style={[styles.cityChip, loc.name === selectedLocation.name && styles.cityChipActive]}
            onPress={() => handleCitySelect(loc)}
          >
            <Text
              style={[
                styles.cityChipText,
                loc.name === selectedLocation.name && styles.cityChipTextActive,
              ]}
            >
              {loc.name}
            </Text>
          </Pressable>
        ))}
      </View>

      {weatherState === 'loading' && <Text>Hava durumu yükleniyor...</Text>}
      {weatherState === 'error' && (
        <>
          <Text>Hava durumu alınamadı.</Text>
          <Button title="Tekrar Dene" onPress={() => loadWeather(selectedLocation)} />
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

      {rainState === 'loading' && (
        <Text style={styles.status}>Yağış tahmini yükleniyor...</Text>
      )}
      {rainState === 'error' && (
        <Text style={styles.status}>Yağış bilgisi alınamadı.</Text>
      )}
      {rainState === 'ready' && (
        <>
        <Text style={styles.rainTitle}>Sıradaki Yağış</Text>
        <View style={styles.rainCard}>
          {nextRain !== null ? (
            <>
              <Text style={styles.rainEmoji}>🌧️</Text>
              <Text style={styles.rainTime}>
                {formatHour(nextRain.start_time)} – {formatHour(nextRain.end_time)}
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
    marginBottom: 12,
  },
  cityRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  cityChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f2f6fa',
    borderWidth: 1,
    borderColor: '#e1e8f0',
  },
  cityChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  cityChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
  },
  cityChipTextActive: {
    color: '#fff',
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
  hourlyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  hourlyScroll: {
    width: '100%',
    height: 145,
    flexGrow: 0,
  },
  hourlyContent: {
    flexDirection: 'row',
    paddingRight: 16,
    alignItems: 'flex-start',
  },
  hourlyCard: {
    width: 72,
    height: 135,
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
