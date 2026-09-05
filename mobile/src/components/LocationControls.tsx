import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { DeviceLocationStatus } from '../hooks/useDeviceLocation';
import type { LocationSearchResult, WeatherLocation } from '../types/weather';

type LocationControlsProps = {
  locations: WeatherLocation[];
  favorites: WeatherLocation[];
  searchQuery: string;
  searchStatus: 'idle' | 'loading' | 'ready' | 'error';
  searchResults: LocationSearchResult[];
  persistenceError: boolean;
  isFavorite: boolean;
  deviceLocationStatus: DeviceLocationStatus;
  isSelected: (location: WeatherLocation) => boolean;
  onLocationSelect: (location: WeatherLocation) => void;
  onSearchResultSelect: (result: LocationSearchResult) => void;
  onSearchQueryChange: (text: string) => void;
  onFavoriteToggle: () => void;
  onCurrentLocation: () => void;
};

export function LocationControls({
  locations,
  favorites,
  searchQuery,
  searchStatus,
  searchResults,
  persistenceError,
  isFavorite,
  deviceLocationStatus,
  isSelected,
  onLocationSelect,
  onSearchResultSelect,
  onSearchQueryChange,
  onFavoriteToggle,
  onCurrentLocation,
}: LocationControlsProps) {
  const isDeviceLocationLoading = deviceLocationStatus === 'loading';

  return (
    <>
      <View style={styles.cityRow}>
        {locations.map((loc) => (
          <Pressable
            key={loc.name}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected(loc) }}
            style={[styles.cityChip, isSelected(loc) && styles.cityChipActive]}
            onPress={() => onLocationSelect(loc)}
          >
            <Text
              style={[
                styles.cityChipText,
                isSelected(loc) && styles.cityChipTextActive,
              ]}
            >
              {loc.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mevcut konumumu kullan"
        accessibilityState={{ disabled: isDeviceLocationLoading }}
        disabled={isDeviceLocationLoading}
        style={[
          styles.deviceLocationButton,
          isDeviceLocationLoading && styles.deviceLocationButtonLoading,
        ]}
        onPress={onCurrentLocation}
      >
        <Text style={styles.deviceLocationText}>
          {isDeviceLocationLoading ? 'Konum alınıyor...' : '📍 Mevcut konumum'}
        </Text>
      </Pressable>
      {deviceLocationStatus === 'permission-denied' && (
        <Text accessibilityRole="alert" style={styles.deviceLocationError}>
          Konum izni verilmedi.
        </Text>
      )}
      {deviceLocationStatus === 'services-disabled' && (
        <Text accessibilityRole="alert" style={styles.deviceLocationError}>
          Konum servisleri kapalı.
        </Text>
      )}
      {deviceLocationStatus === 'error' && (
        <Text accessibilityRole="alert" style={styles.deviceLocationError}>
          Konum alınamadı. Tekrar deneyin.
        </Text>
      )}

      <View style={styles.searchBox}>
        <TextInput
          accessibilityLabel="Konum ara"
          autoCorrect={false}
          style={styles.searchInput}
          placeholder="Şehir veya yer ara"
          placeholderTextColor="#999"
          returnKeyType="search"
          value={searchQuery}
          onChangeText={onSearchQueryChange}
        />
      </View>
      {searchStatus === 'loading' && <Text style={styles.searchStatus}>Aranıyor...</Text>}
      {searchStatus === 'error' && (
        <Text accessibilityRole="alert" style={styles.searchStatus}>Arama yapılamadı.</Text>
      )}
      {searchStatus === 'ready' && searchResults.length === 0 && (
        <Text style={styles.searchStatus}>Sonuç bulunamadı.</Text>
      )}
      {searchResults.length > 0 && (
        <View style={styles.searchResults}>
          {searchResults.map((result) => (
            <Pressable
              key={`${result.name}-${result.latitude}-${result.longitude}`}
              accessibilityRole="button"
              style={styles.searchResultRow}
              onPress={() => onSearchResultSelect(result)}
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
                testID={`favorite-chip-${loc.name}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected(loc) }}
                style={[
                  styles.cityChip,
                  styles.favoriteChip,
                  isSelected(loc) && styles.cityChipActive,
                ]}
                onPress={() => onLocationSelect(loc)}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.cityChipText,
                    styles.favoriteChipText,
                    isSelected(loc) && styles.cityChipTextActive,
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
        onPress={onFavoriteToggle}
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
    </>
  );
}

const styles = StyleSheet.create({
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
  deviceLocationButton: {
    alignSelf: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  deviceLocationButtonLoading: {
    opacity: 0.6,
  },
  deviceLocationText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3730a3',
  },
  deviceLocationError: {
    fontSize: 12,
    color: '#b91c1c',
  },
});
