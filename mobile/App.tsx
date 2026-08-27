import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { checkBackendHealth } from './src/api/health';
import { fetchCurrentWeather, fetchHourlyWeather, fetchNextRainEvent, searchLocations } from './src/api/weather';
import type { CurrentWeather, HourlyWeather, LocationSearchResult, RainEvent, WeatherLocation } from './src/types/weather';
import { formatWeatherTime, getWeatherCondition } from './src/weather/condition';

type ConnectionState = 'checking' | 'connected' | 'disconnected';
type WeatherState = 'loading' | 'ready' | 'error';

const WEATHER_LOCATIONS: WeatherLocation[] = [
  { name: 'Elazığ', latitude: 38.6743, longitude: 39.2232 },
  { name: 'İstanbul', latitude: 41.0082, longitude: 28.9784 },
  { name: 'Ankara', latitude: 39.9334, longitude: 32.8597 },
];

const LOCATION_STORAGE_KEY = 'weather_tracker:selected_location';
const FAVORITES_STORAGE_KEY = 'weather_tracker:favorite_locations';

function isSameLocation(a: WeatherLocation, b: WeatherLocation): boolean {
  return a.name === b.name && a.latitude === b.latitude && a.longitude === b.longitude;
}

function parseStoredLocation(raw: string | null): WeatherLocation | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const candidate = parsed as Partial<WeatherLocation>;
    if (
      typeof candidate.name !== 'string' ||
      typeof candidate.latitude !== 'number' ||
      typeof candidate.longitude !== 'number' ||
      !Number.isFinite(candidate.latitude) ||
      !Number.isFinite(candidate.longitude) ||
      candidate.latitude < -90 ||
      candidate.latitude > 90 ||
      candidate.longitude < -180 ||
      candidate.longitude > 180
    ) {
      return null;
    }
    return { name: candidate.name, latitude: candidate.latitude, longitude: candidate.longitude };
  } catch {
    return null;
  }
}

function parseStoredFavorites(raw: string | null): WeatherLocation[] {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const result: WeatherLocation[] = [];
    for (const item of parsed) {
      if (typeof item !== 'object' || item === null) continue;
      const candidate = item as Partial<WeatherLocation>;
      if (
        typeof candidate.name !== 'string' ||
        typeof candidate.latitude !== 'number' ||
        typeof candidate.longitude !== 'number' ||
        !Number.isFinite(candidate.latitude) ||
        !Number.isFinite(candidate.longitude) ||
        candidate.latitude < -90 ||
        candidate.latitude > 90 ||
        candidate.longitude < -180 ||
        candidate.longitude > 180
      ) {
        continue;
      }
      result.push({ name: candidate.name, latitude: candidate.latitude, longitude: candidate.longitude });
    }
    return result;
  } catch {
    return [];
  }
}

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
  const [locationHydrated, setLocationHydrated] = useState(false);
  const [weatherState, setWeatherState] = useState<WeatherState>('loading');
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [hourlyState, setHourlyState] = useState<WeatherState>('loading');
  const [hourly, setHourly] = useState<HourlyWeather[]>([]);
  const [rainState, setRainState] = useState<WeatherState>('loading');
  const [nextRain, setNextRain] = useState<RainEvent | null>(null);
  const [favorites, setFavorites] = useState<WeatherLocation[]>([]);
  const requestSeq = useRef(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchCompleted, setSearchCompleted] = useState(false);
  const searchSeq = useRef(0);

  const runHealthCheck = useCallback(async () => {
    setConnection('checking');
    try {
      await checkBackendHealth();
      setConnection('connected');
    } catch {
      setConnection('disconnected');
    }
  }, []);

  const refreshWeather = useCallback(async (loc: WeatherLocation) => {
    const requestId = ++requestSeq.current;
    setWeatherState('loading');
    setHourlyState('loading');
    setRainState('loading');

    fetchCurrentWeather(loc)
      .then((data) => {
        if (requestId !== requestSeq.current) return;
        setWeather(data);
        setWeatherState('ready');
      })
      .catch(() => {
        if (requestId !== requestSeq.current) return;
        setWeatherState('error');
      });

    fetchHourlyWeather(loc)
      .then((data) => {
        if (requestId !== requestSeq.current) return;
        setHourly(data);
        setHourlyState('ready');
      })
      .catch(() => {
        if (requestId !== requestSeq.current) return;
        setHourlyState('error');
      });

    fetchNextRainEvent(loc)
      .then((data) => {
        if (requestId !== requestSeq.current) return;
        setNextRain(data);
        setRainState('ready');
      })
      .catch(() => {
        if (requestId !== requestSeq.current) return;
        setRainState('error');
      });
  }, []);

  useEffect(() => {
    runHealthCheck();
  }, [runHealthCheck]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let stored: WeatherLocation | null = null;
      let favs: WeatherLocation[] = [];
      try {
        const [raw, rawFavorites] = await Promise.all([
          AsyncStorage.getItem(LOCATION_STORAGE_KEY),
          AsyncStorage.getItem(FAVORITES_STORAGE_KEY),
        ]);
        stored = parseStoredLocation(raw);
        favs = parseStoredFavorites(rawFavorites);
      } catch {
        stored = null;
        favs = [];
      }
      if (cancelled) return;
      if (stored !== null) {
        setSelectedLocation(stored);
      }
      setFavorites(favs);
      setLocationHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!locationHydrated) return;
    refreshWeather(selectedLocation);
  }, [locationHydrated, selectedLocation, refreshWeather]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      searchSeq.current += 1;
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(null);
      setSearchCompleted(false);
      return;
    }
    const timer = setTimeout(() => {
      const requestId = ++searchSeq.current;
      setSearchLoading(true);
      setSearchError(null);
      setSearchCompleted(false);
      searchLocations(trimmed)
        .then((results) => {
          if (requestId !== searchSeq.current) return;
          setSearchResults(results);
          setSearchLoading(false);
          setSearchCompleted(true);
        })
        .catch(() => {
          if (requestId !== searchSeq.current) return;
          setSearchResults([]);
          setSearchError('Arama yapılamadı.');
          setSearchLoading(false);
          setSearchCompleted(true);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const handleCitySelect = (loc: WeatherLocation) => {
    if (loc.name === selectedLocation.name) return;
    setSelectedLocation(loc);
    AsyncStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(loc)).catch(() => {});
  };

  const handleSearchSelect = (result: LocationSearchResult) => {
    const location: WeatherLocation = {
      name: result.name,
      latitude: result.latitude,
      longitude: result.longitude,
    };
    handleCitySelect(location);
    searchSeq.current += 1;
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setSearchLoading(false);
    setSearchCompleted(false);
  };

  const isFavorite = favorites.some((f) => isSameLocation(f, selectedLocation));

  const handleFavoriteToggle = () => {
    const next = isFavorite
      ? favorites.filter((f) => !isSameLocation(f, selectedLocation))
      : [...favorites, { ...selectedLocation }];
    setFavorites(next);
    AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
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

      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="Şehir veya yer ara"
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      {searchLoading && <Text style={styles.searchStatus}>Aranıyor...</Text>}
      {searchError !== null && !searchLoading && (
        <Text style={styles.searchStatus}>{searchError}</Text>
      )}
      {!searchLoading &&
        searchError === null &&
        searchCompleted &&
        searchResults.length === 0 && (
          <Text style={styles.searchStatus}>Sonuç bulunamadı.</Text>
        )}
      {searchResults.length > 0 && (
        <View style={styles.searchResults}>
          {searchResults.map((result) => (
            <Pressable
              key={`${result.name}-${result.latitude}-${result.longitude}`}
              style={styles.searchResultRow}
              onPress={() => handleSearchSelect(result)}
            >
              <Text style={styles.searchResultName}>{result.name}</Text>
              {result.admin1 !== null && result.admin1 !== '' && (
                <Text style={styles.searchResultAdmin}>{result.admin1}</Text>
              )}
            </Pressable>
          ))}
        </View>
      )}

      {favorites.length > 0 && (
        <>
          <Text style={styles.favoritesTitle}>Favoriler</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.favoritesScroll}
            contentContainerStyle={styles.favoritesContent}
          >
            {favorites.map((loc) => (
              <Pressable
                key={`${loc.name}-${loc.latitude}-${loc.longitude}`}
                style={[
                  styles.cityChip,
                  styles.favoriteChip,
                  isSameLocation(loc, selectedLocation) && styles.cityChipActive,
                ]}
                onPress={() => handleCitySelect(loc)}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.cityChipText,
                    styles.favoriteChipText,
                    isSameLocation(loc, selectedLocation) && styles.cityChipTextActive,
                  ]}
                >
                  {loc.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      <Pressable style={styles.favoriteToggle} onPress={handleFavoriteToggle}>
        <Text style={styles.favoriteToggleText}>
          {isFavorite ? '★ Favorilerden çıkar' : '☆ Favoriye ekle'}
        </Text>
      </Pressable>

      {weatherState === 'loading' && <Text>Hava durumu yükleniyor...</Text>}
      {weatherState === 'error' && (
        <>
          <Text>Hava durumu alınamadı.</Text>
          <Button title="Tekrar Dene" onPress={() => refreshWeather(selectedLocation)} />
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
  searchBox: {
    width: '100%',
    marginBottom: 8,
  },
  searchInput: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f2f6fa',
    borderWidth: 1,
    borderColor: '#e1e8f0',
    fontSize: 14,
    color: '#333',
  },
  searchStatus: {
    fontSize: 13,
    color: '#777',
    marginTop: 8,
  },
  searchResults: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1e8f0',
    backgroundColor: '#f2f6fa',
    marginBottom: 8,
  },
  searchResultRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8f0',
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  searchResultAdmin: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  favoritesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginTop: 12,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  favoritesScroll: {
    width: '100%',
    height: 52,
    flexGrow: 0,
  },
  favoritesContent: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
    alignItems: 'center',
  },
  favoriteChip: {
    flexShrink: 0,
    minWidth: 110,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteChipText: {
    flexShrink: 0,
    lineHeight: 20,
  },
  favoriteToggle: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  favoriteToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#c2410c',
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
