import { useCallback, useEffect, useRef, useState } from 'react';

import {
  isSameLocation,
  loadLocationPreferences,
  saveFavorites,
  saveSelectedLocation,
} from '../storage/locations';
import type { WeatherLocation } from '../types/weather';

export function useLocationPreferences(defaultLocation: WeatherLocation) {
  const [selectedLocation, setSelectedLocation] = useState(defaultLocation);
  const [favorites, setFavorites] = useState<WeatherLocation[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [persistenceError, setPersistenceError] = useState(false);
  const selectionChangedRef = useRef(false);
  const favoritesChangedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadLocationPreferences()
      .then((preferences) => {
        if (cancelled) return;
        if (!selectionChangedRef.current && preferences.selectedLocation !== null) {
          setSelectedLocation(preferences.selectedLocation);
        }
        if (!favoritesChangedRef.current) {
          setFavorites(preferences.favorites);
        }
      })
      .catch(() => {
        if (!cancelled) setPersistenceError(true);
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectLocation = useCallback((location: WeatherLocation) => {
    selectionChangedRef.current = true;
    setSelectedLocation(location);
    setPersistenceError(false);
    void saveSelectedLocation(location).catch(() => setPersistenceError(true));
  }, []);

  const toggleFavorite = useCallback((location: WeatherLocation) => {
    favoritesChangedRef.current = true;
    setPersistenceError(false);
    setFavorites((current) => {
      const exists = current.some((favorite) => isSameLocation(favorite, location));
      const next = exists
        ? current.filter((favorite) => !isSameLocation(favorite, location))
        : [...current, { ...location }];
      void saveFavorites(next).catch(() => setPersistenceError(true));
      return next;
    });
  }, []);

  return {
    favorites,
    hydrated,
    persistenceError,
    selectedLocation,
    selectLocation,
    toggleFavorite,
  };
}
