import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AppState, Button, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CurrentWeatherCard } from './src/components/CurrentWeatherCard';
import { DailyForecast } from './src/components/DailyForecast';
import { NextRainCard } from './src/components/NextRainCard';
import { HourlyForecast } from './src/components/HourlyForecast';
import { LocationControls } from './src/components/LocationControls';

import { useDeviceLocation } from './src/hooks/useDeviceLocation';
import { useLocationPreferences } from './src/hooks/useLocationPreferences';
import { useLocationSearch } from './src/hooks/useLocationSearch';
import { useWeatherOverview } from './src/hooks/useWeatherOverview';
import { isSameLocation } from './src/storage/locations';
import type { LocationSearchResult, WeatherLocation } from './src/types/weather';

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
    <SafeAreaView style={styles.safeArea}>
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
      <Text style={styles.title}>Hava Takip</Text>

      <LocationControls
        locations={WEATHER_LOCATIONS}
        favorites={favorites}
        searchQuery={search.query}
        searchStatus={search.status}
        searchResults={search.results}
        persistenceError={persistenceError}
        isFavorite={isFavorite}
        deviceLocationStatus={deviceLocation.status}
        isSelected={(location) => isSameLocation(location, selectedLocation)}
        onLocationSelect={handleCitySelect}
        onSearchResultSelect={handleSearchSelect}
        onSearchQueryChange={search.setQuery}
        onFavoriteToggle={handleFavoriteToggle}
        onCurrentLocation={handleCurrentLocation}
      />

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
        <CurrentWeatherCard current={overview.current} fetchedAt={fetchedAt} />
      )}

      {overviewStatus === 'ready' && overview !== null && (
        <NextRainCard nextRain={overview.next_rain} />
      )}

      {overviewStatus === 'ready' && overview !== null && (
        <HourlyForecast hourly={overview.hourly} />
      )}

      {overviewStatus === 'ready' && overview !== null && (
        <DailyForecast daily={overview.daily} />
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
  status: {
    marginTop: 32,
    fontSize: 12,
    color: '#999',
  },
});
