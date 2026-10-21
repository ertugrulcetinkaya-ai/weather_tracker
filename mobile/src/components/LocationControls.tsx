import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { DeviceLocationStatus } from '../hooks/useDeviceLocation';
import type { LocationSearchResult, WeatherLocation } from '../types/weather';
import type { WeatherTheme } from '../weather/theme';

type LocationControlsProps = {
  locations: WeatherLocation[];
  favorites: WeatherLocation[];
  searchQuery: string;
  searchStatus: 'idle' | 'loading' | 'ready' | 'error';
  searchResults: LocationSearchResult[];
  persistenceError: boolean;
  isFavorite: boolean;
  deviceLocationStatus: DeviceLocationStatus;
  theme: WeatherTheme;
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
  theme,
  isSelected,
  onLocationSelect,
  onSearchResultSelect,
  onSearchQueryChange,
  onFavoriteToggle,
  onCurrentLocation,
}: LocationControlsProps) {
  const [isCityPickerOpen, setIsCityPickerOpen] = useState(false);
  const isDeviceLocationLoading = deviceLocationStatus === 'loading';
  const pickerLocations = [
    ...favorites,
    ...locations.filter(
      (location) =>
        !favorites.some(
          (favorite) =>
            favorite.name === location.name &&
            favorite.latitude === location.latitude &&
            favorite.longitude === location.longitude
        )
    ),
  ];

  const selectLocation = (location: WeatherLocation) => {
    setIsCityPickerOpen(false);
    onLocationSelect(location);
  };

  const selectSearchResult = (result: LocationSearchResult) => {
    setIsCityPickerOpen(false);
    onSearchResultSelect(result);
  };

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Şehir seç"
          accessibilityState={{ expanded: isCityPickerOpen }}
          style={({ pressed }) => [
            styles.cityPickerButton,
            {
              backgroundColor: pressed ? theme.accentSoft : theme.surface,
              borderColor: theme.surfaceBorder,
            },
          ]}
          onPress={() => setIsCityPickerOpen((open) => !open)}
        >
          <Text style={[styles.cityPickerGlyph, { color: theme.accent }]} aria-hidden>
            ⌖
          </Text>
          <Text style={[styles.cityPickerText, { color: theme.text }]}>Şehir seç</Text>
          <Text style={[styles.chevron, { color: theme.mutedText }]} aria-hidden>
            ▾
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? 'Favorilerden çıkar' : 'Favoriye ekle'}
          style={({ pressed }) => [
            styles.favoriteToggle,
            {
              backgroundColor: pressed ? theme.accentSoft : theme.surface,
              borderColor: theme.surfaceBorder,
            },
          ]}
          onPress={onFavoriteToggle}
        >
          <Text style={[styles.favoriteToggleGlyph, { color: theme.accent }]} aria-hidden>
            {isFavorite ? '★' : '☆'}
          </Text>
        </Pressable>
      </View>

      {isCityPickerOpen && (
        <ScrollView
          horizontal
          accessibilityLabel="Favoriler ve şehirler"
          showsHorizontalScrollIndicator={false}
          style={styles.cityList}
          contentContainerStyle={styles.cityListContent}
        >
          {pickerLocations.map((location) => {
            const isFavoriteLocation = favorites.some(
              (favorite) =>
                favorite.name === location.name &&
                favorite.latitude === location.latitude &&
                favorite.longitude === location.longitude
            );

            return (
              <Pressable
                key={`${location.name}-${location.latitude}-${location.longitude}`}
                testID={isFavoriteLocation ? `favorite-chip-${location.name}` : undefined}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected(location) }}
                style={({ pressed }) =>
                  isFavoriteLocation
                    ? [styles.favoriteTouchTarget, { opacity: pressed ? 0.76 : 1 }]
                    : [
                        styles.cityChip,
                        {
                          backgroundColor: isSelected(location) ? theme.accent : theme.surface,
                          borderColor: isSelected(location) ? theme.accent : theme.surfaceBorder,
                          opacity: pressed ? 0.76 : 1,
                        },
                      ]
                }
                onPress={() => selectLocation(location)}
              >
                {isFavoriteLocation ? (
                  <View
                    testID={`favorite-chip-visual-${location.name}`}
                    style={[
                      styles.favoriteChip,
                      {
                        backgroundColor: isSelected(location) ? theme.accent : theme.surface,
                        borderColor: isSelected(location) ? theme.accent : theme.surfaceBorder,
                      },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.favoriteChipText,
                        { color: isSelected(location) ? theme.activeText : theme.text },
                      ]}
                    >
                      {location.name}
                    </Text>
                  </View>
                ) : (
                  <Text
                    style={[
                      styles.cityChipText,
                      { color: isSelected(location) ? theme.activeText : theme.text },
                    ]}
                  >
                    {location.name}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <View
        style={[
          styles.searchBox,
          { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
        ]}
      >
        <Text style={[styles.searchGlyph, { color: theme.mutedText }]} aria-hidden>
          ⌕
        </Text>
        <TextInput
          accessibilityLabel="Konum ara"
          autoCorrect={false}
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Şehir veya yer ara"
          placeholderTextColor={theme.mutedText}
          returnKeyType="search"
          value={searchQuery}
          onChangeText={onSearchQueryChange}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mevcut konumumu kullan"
          accessibilityHint="Hava durumunu mevcut konumunuza göre gösterir"
          accessibilityState={{ disabled: isDeviceLocationLoading }}
          disabled={isDeviceLocationLoading}
          style={({ pressed }) => [
            styles.deviceLocationButton,
            {
              backgroundColor: theme.accentSoft,
              opacity: pressed ? 0.72 : isDeviceLocationLoading ? 0.58 : 1,
            },
          ]}
          onPress={onCurrentLocation}
        >
          <Text style={[styles.deviceLocationGlyph, { color: theme.accent }]}>
            {isDeviceLocationLoading ? '…' : '◎'}
          </Text>
        </Pressable>
      </View>

      {isDeviceLocationLoading && (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.searchStatus, { color: theme.mutedText }]}
        >
          Konum alınıyor...
        </Text>
      )}

      {deviceLocationStatus === 'permission-denied' && (
        <Text accessibilityRole="alert" style={[styles.errorMessage, { color: theme.errorText }]}>
          Konum izni verilmedi.
        </Text>
      )}
      {deviceLocationStatus === 'services-disabled' && (
        <Text accessibilityRole="alert" style={[styles.errorMessage, { color: theme.errorText }]}>
          Konum servisleri kapalı.
        </Text>
      )}
      {deviceLocationStatus === 'error' && (
        <Text accessibilityRole="alert" style={[styles.errorMessage, { color: theme.errorText }]}>
          Konum alınamadı. Tekrar deneyin.
        </Text>
      )}

      {searchStatus === 'loading' && (
        <Text style={[styles.searchStatus, { color: theme.mutedText }]}>Aranıyor...</Text>
      )}
      {searchStatus === 'error' && (
        <Text accessibilityRole="alert" style={[styles.searchStatus, { color: theme.errorText }]}>
          Arama yapılamadı.
        </Text>
      )}
      {searchStatus === 'ready' && searchResults.length === 0 && (
        <Text style={[styles.searchStatus, { color: theme.mutedText }]}>Sonuç bulunamadı.</Text>
      )}
      {searchResults.length > 0 && (
        <View
          style={[
            styles.searchResults,
            { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
          ]}
        >
          {searchResults.map((result, index) => (
            <Pressable
              key={`${result.name}-${result.latitude}-${result.longitude}`}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.searchResultRow,
                {
                  borderBottomColor: theme.surfaceBorder,
                  backgroundColor: pressed ? theme.accentSoft : theme.surface,
                  borderBottomWidth: index === searchResults.length - 1 ? 0 : StyleSheet.hairlineWidth,
                },
              ]}
              onPress={() => selectSearchResult(result)}
            >
              <Text style={[styles.searchResultName, { color: theme.text }]}>{result.name}</Text>
              {result.admin1 !== null && result.admin1 !== '' && (
                <Text style={[styles.searchResultAdmin, { color: theme.mutedText }]}>
                  {result.admin1}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      )}

      {persistenceError && (
        <Text accessibilityRole="alert" style={[styles.errorMessage, { color: theme.errorText }]}>
          Konum tercihleri bu cihazda kaydedilemedi.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 10,
    marginBottom: 14,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  cityPickerButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cityPickerGlyph: {
    fontSize: 19,
    marginRight: 9,
  },
  cityPickerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  chevron: {
    fontSize: 12,
  },
  favoriteToggle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteToggleGlyph: {
    fontSize: 24,
    lineHeight: 28,
  },
  cityList: {
    maxHeight: 54,
    flexGrow: 0,
  },
  cityListContent: {
    alignItems: 'center',
    gap: 8,
    paddingRight: 12,
  },
  cityChip: {
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 15,
  },
  cityChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchBox: {
    width: '100%',
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 2,
  },
  searchGlyph: {
    fontSize: 21,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingVertical: 8,
    fontSize: 14,
  },
  deviceLocationButton: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceLocationGlyph: {
    fontSize: 23,
    fontWeight: '500',
  },
  errorMessage: {
    fontSize: 13,
    marginHorizontal: 4,
  },
  searchStatus: {
    fontSize: 13,
    marginHorizontal: 4,
  },
  searchResults: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  searchResultRow: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchResultAdmin: {
    fontSize: 12,
    marginTop: 2,
  },
  favoriteTouchTarget: {
    minWidth: 110,
    minHeight: 48,
    justifyContent: 'center',
  },
  favoriteChip: {
    height: 44,
    minWidth: 110,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  favoriteChipText: {
    flexShrink: 0,
    lineHeight: 20,
    fontSize: 14,
    fontWeight: '500',
  },
});
