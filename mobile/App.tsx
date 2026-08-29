import { StatusBar } from 'expo-status-bar';
import { Button, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useLocationPreferences } from './src/hooks/useLocationPreferences';
import { useLocationSearch } from './src/hooks/useLocationSearch';
import { useWeatherOverview } from './src/hooks/useWeatherOverview';
import { isSameLocation } from './src/storage/locations';
import type { LocationSearchResult, WeatherLocation } from './src/types/weather';
import { formatWeatherTime, getWeatherCondition } from './src/weather/condition';

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
  const {
    favorites,
    hydrated,
    persistenceError,
    selectedLocation,
    selectLocation,
    toggleFavorite,
  } = useLocationPreferences(WEATHER_LOCATIONS[0]);
  const search = useLocationSearch();
  const { overview, refresh, status: overviewStatus } = useWeatherOverview(
    selectedLocation,
    hydrated
  );

  const handleCitySelect = (loc: WeatherLocation) => {
    if (isSameLocation(loc, selectedLocation)) return;
    selectLocation(loc);
  };

  const handleSearchSelect = (result: LocationSearchResult) => {
    const location: WeatherLocation = {
      name: result.name,
      latitude: result.latitude,
      longitude: result.longitude,
    };
    handleCitySelect(location);
    search.reset();
  };

  const isFavorite = favorites.some((f) => isSameLocation(f, selectedLocation));

  const handleFavoriteToggle = () => {
    toggleFavorite(selectedLocation);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <Text style={styles.title}>Hava Takip</Text>

      <View style={styles.cityRow}>
        {WEATHER_LOCATIONS.map((loc) => (
          <Pressable
            key={loc.name}
            accessibilityRole="button"
            accessibilityState={{ selected: isSameLocation(loc, selectedLocation) }}
            style={[styles.cityChip, isSameLocation(loc, selectedLocation) && styles.cityChipActive]}
            onPress={() => handleCitySelect(loc)}
          >
            <Text
              style={[
                styles.cityChipText,
                isSameLocation(loc, selectedLocation) && styles.cityChipTextActive,
              ]}
            >
              {loc.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.searchBox}>
        <TextInput
          accessibilityLabel="Konum ara"
          autoCorrect={false}
          style={styles.searchInput}
          placeholder="Şehir veya yer ara"
          placeholderTextColor="#999"
          returnKeyType="search"
          value={search.query}
          onChangeText={search.setQuery}
        />
      </View>
      {search.status === 'loading' && <Text style={styles.searchStatus}>Aranıyor...</Text>}
      {search.status === 'error' && (
        <Text accessibilityRole="alert" style={styles.searchStatus}>Arama yapılamadı.</Text>
      )}
      {search.status === 'ready' && search.results.length === 0 && (
        <Text style={styles.searchStatus}>Sonuç bulunamadı.</Text>
      )}
      {search.results.length > 0 && (
        <View style={styles.searchResults}>
          {search.results.map((result) => (
            <Pressable
              key={`${result.name}-${result.latitude}-${result.longitude}`}
              accessibilityRole="button"
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
                accessibilityRole="button"
                accessibilityState={{ selected: isSameLocation(loc, selectedLocation) }}
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

      <Pressable
        accessibilityRole="button"
        style={styles.favoriteToggle}
        onPress={handleFavoriteToggle}
      >
        <Text style={styles.favoriteToggleText}>
          {isFavorite ? '★ Favorilerden çıkar' : '☆ Favoriye ekle'}
        </Text>
      </Pressable>

      {persistenceError && (
        <Text accessibilityRole="alert" style={styles.persistenceError}>
          Konum tercihleri bu cihazda kaydedilemedi.
        </Text>
      )}

      {(!hydrated || overviewStatus === 'idle' || overviewStatus === 'loading') && (
        <Text style={styles.loadingStatus}>Hava durumu yükleniyor...</Text>
      )}
      {overviewStatus === 'error' && (
        <View style={styles.errorState}>
          <Text accessibilityRole="alert" style={styles.errorText}>
            Hava durumu alınamadı.
          </Text>
          <Button title="Tekrar Dene" onPress={() => void refresh()} />
        </View>
      )}
      {overviewStatus === 'ready' && overview !== null && (
        <View style={styles.card}>
          <Text style={styles.emoji}>
            {getWeatherCondition(overview.current.weather_code).emoji}
          </Text>
          <Text style={styles.location}>{overview.current.location.toUpperCase()}</Text>
          <Text style={styles.temperature}>{Math.round(overview.current.temperature)}°</Text>
          <Text style={styles.condition}>
            {getWeatherCondition(overview.current.weather_code).label}
          </Text>
          <Text style={styles.apparent}>
            Hissedilen {Math.round(overview.current.apparent_temperature)}°
          </Text>
          <Text style={styles.updatedAt}>{formatWeatherTime(overview.current.time)}</Text>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Nem</Text>
              <Text style={styles.metricValue}>%{overview.current.humidity}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Rüzgâr</Text>
              <Text style={styles.metricValue}>{overview.current.wind_speed} km/s</Text>
            </View>
          </View>
        </View>
      )}

      {overviewStatus === 'ready' && overview !== null && (
        <>
          <Text style={styles.rainTitle}>Sıradaki Yağış</Text>
          <View style={styles.rainCard}>
            {overview.next_rain !== null ? (
              <>
                <Text style={styles.rainEmoji}>🌧️</Text>
                <Text style={styles.rainTime}>
                  {formatHour(overview.next_rain.start_time)} –{' '}
                  {formatHour(overview.next_rain.end_time)}
                </Text>
                <Text style={styles.rainDetail}>
                  Toplam {Number(overview.next_rain.total_precipitation.toFixed(2))} mm
                </Text>
                <Text style={styles.rainDetail}>
                  En yoğun: {formatHour(overview.next_rain.peak_time)}
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

      {overviewStatus === 'ready' && overview !== null && (
        <>
          <Text style={styles.hourlyTitle}>Saatlik Tahmin</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.hourlyScroll}
            contentContainerStyle={styles.hourlyContent}
          >
            {overview.hourly.map((hour) => (
              <View key={hour.time} style={styles.hourlyCard}>
                <Text style={styles.hourlyTime}>{hour.time.slice(11, 16)}</Text>
                <Text style={styles.hourlyEmoji}>
                  {getWeatherCondition(hour.weather_code).emoji}
                </Text>
                <Text style={styles.hourlyTemperature}>
                  {Math.round(hour.temperature)}°C
                </Text>
                <Text style={styles.hourlyPrecipitation}>{hour.precipitation} mm</Text>
              </View>
            ))}
          </ScrollView>
        </>
      )}

      <Text style={styles.status}>
        {overviewStatus === 'ready'
          ? 'Backend: Bağlı'
          : overviewStatus === 'error'
            ? 'Backend: Bağlantı Yok'
            : 'Backend kontrol ediliyor...'}
      </Text>
      <StatusBar style="auto" />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 40,
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
  persistenceError: {
    marginTop: 8,
    fontSize: 12,
    color: '#b91c1c',
  },
  loadingStatus: {
    marginVertical: 32,
    color: '#555',
  },
  errorState: {
    alignItems: 'center',
    gap: 12,
    marginVertical: 32,
  },
  errorText: {
    color: '#b91c1c',
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
