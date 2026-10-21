import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AppState, Button, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CurrentWeatherCard } from './src/components/CurrentWeatherCard';
import { DailyForecast } from './src/components/DailyForecast';
import { NextRainCard } from './src/components/NextRainCard';
import { HourlyForecast } from './src/components/HourlyForecast';
import { LocationControls } from './src/components/LocationControls';
import { WeatherSurface } from './src/components/WeatherSurface';

import { useDeviceLocation } from './src/hooks/useDeviceLocation';
import { useLocationPreferences } from './src/hooks/useLocationPreferences';
import { useLocationSearch } from './src/hooks/useLocationSearch';
import { useWeatherOverview } from './src/hooks/useWeatherOverview';
import { isSameLocation } from './src/storage/locations';
import type { LocationSearchResult, WeatherLocation } from './src/types/weather';
import { getWeatherTheme } from './src/weather/theme';

function formatLastUpdate(fetchedAt: number | null): string {
  if (fetchedAt === null) return '';
  return ` (Son güncelleme: ${new Date(fetchedAt).toLocaleString('tr-TR')})`;
}

const WEATHER_LOCATIONS: WeatherLocation[] = [
  { name: 'Elazığ', latitude: 38.6743, longitude: 39.2232 },
  { name: 'İstanbul', latitude: 41.0082, longitude: 28.9784 },
  { name: 'Ankara', latitude: 39.9334, longitude: 32.8597 },
];

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
  const deviceLocation = useDeviceLocation();
  const {
    fetchedAt,
    overview,
    refresh,
    refreshStatus,
    status: overviewStatus,
  } = useWeatherOverview(selectedLocation, hydrated);

  const handleCitySelect = (loc: WeatherLocation) => {
    deviceLocation.cancelPendingRequest();
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
  const weatherCode = overview?.current.weather_code ?? null;
  const theme = getWeatherTheme(weatherCode);

  const handleFavoriteToggle = () => {
    toggleFavorite(selectedLocation);
  };

  const handleCurrentLocation = () => {
    deviceLocation.requestCurrentLocation((location) => {
      selectLocation(location);
      search.reset();
    });
  };

  const previousAppStateRef = useRef<AppState['currentState']>(AppState.currentState);
  const refreshRef = useRef(refresh);
  const refreshStatusRef = useRef(refreshStatus);

  useEffect(() => {
    refreshRef.current = refresh;
    refreshStatusRef.current = refreshStatus;
  }, [refresh, refreshStatus]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const previousAppState = previousAppStateRef.current;
      previousAppStateRef.current = nextAppState;

      const isForegroundTransition =
        (previousAppState === 'background' || previousAppState === 'inactive') &&
        nextAppState === 'active';

      if (!isForegroundTransition) return;
      if (refreshStatusRef.current === 'loading') return;

      void refreshRef.current();
    });

    return () => subscription.remove();
  }, []);

  return (
    <WeatherSurface weatherCode={weatherCode}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style={theme.statusBarStyle} />
        <ScrollView
          testID="weather-scroll-view"
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshStatus === 'loading'}
              onRefresh={() => void refresh()}
            />
          }
        >
          <View style={styles.header}>
            <View
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.brandMark, { backgroundColor: theme.accentSoft }]}
            >
              <Text style={[styles.brandLetter, { color: theme.accent }]}>H</Text>
            </View>
            <Text style={[styles.title, { color: theme.text }]}>Hava Takip</Text>
          </View>

          <LocationControls
            locations={WEATHER_LOCATIONS}
            favorites={favorites}
            searchQuery={search.query}
            searchStatus={search.status}
            searchResults={search.results}
            persistenceError={persistenceError}
            isFavorite={isFavorite}
            deviceLocationStatus={deviceLocation.status}
            theme={theme}
            isSelected={(location) => isSameLocation(location, selectedLocation)}
            onLocationSelect={handleCitySelect}
            onSearchResultSelect={handleSearchSelect}
            onSearchQueryChange={search.setQuery}
            onFavoriteToggle={handleFavoriteToggle}
            onCurrentLocation={handleCurrentLocation}
          />

          {(!hydrated || overviewStatus === 'idle' || overviewStatus === 'loading') && (
            <Text style={[styles.loadingStatus, { color: theme.text }]}>Hava durumu yükleniyor...</Text>
          )}
          {overviewStatus === 'error' && (
            <View
              style={[
                styles.errorState,
                { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
              ]}
            >
              <Text accessibilityRole="alert" style={{ color: theme.errorText }}>
                Hava durumu alınamadı.
              </Text>
              <Button title="Tekrar Dene" onPress={() => void refresh()} />
            </View>
          )}
          {overviewStatus === 'ready' && overview !== null && (
            <CurrentWeatherCard current={overview.current} fetchedAt={fetchedAt} />
          )}

          {overviewStatus === 'ready' && overview !== null && (
            <View style={styles.forecastSection}>
              <NextRainCard
                nextRain={overview.next_rain}
                timezone={overview.timezone ?? ''}
                forecastCurrent={refreshStatus === 'idle' && fetchedAt !== null}
                theme={theme}
              />

              <HourlyForecast
                hourly={overview.hourly}
                rainStartTime={overview.next_rain?.start_time ?? null}
                theme={theme}
              />

              <DailyForecast daily={overview.daily} theme={theme} />
            </View>
          )}

          <Text
            style={[styles.status, { color: theme.text }]}
            accessibilityLiveRegion="polite"
          >
            {(() => {
              const hasValidOverview = overviewStatus === 'ready' && overview !== null;

              if (hasValidOverview && refreshStatus === 'idle') {
                return 'Backend: Bağlı';
              }

              if (hasValidOverview && refreshStatus === 'loading') {
                return `Bağlantı kontrol ediliyor...${formatLastUpdate(fetchedAt)}`;
              }

              if (hasValidOverview && refreshStatus === 'error') {
                return `Backend: Bağlantı yok${formatLastUpdate(fetchedAt)}`;
              }

              if (overviewStatus === 'error') {
                return 'Backend: Bağlantı Yok';
              }

              return 'Backend kontrol ediliyor...';
            })()}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </WeatherSurface>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flexGrow: 1,
    alignItems: 'stretch',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 36,
  },
  header: {
    width: '100%',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  brandLetter: {
    fontSize: 16,
    fontWeight: '700',
  },
  title: {
    fontSize: 21,
    fontWeight: '700',
  },
  loadingStatus: {
    marginVertical: 32,
  },
  errorState: {
    alignItems: 'center',
    gap: 12,
    marginVertical: 32,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  forecastSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: -18,
    marginTop: 4,
    paddingHorizontal: 18,
    paddingTop: 2,
    paddingBottom: 20,
  },
  status: {
    marginTop: 20,
    fontSize: 12,
  },
});
