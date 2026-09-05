import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

import type { WeatherLocation } from '../types/weather';

export type DeviceLocationStatus =
  | 'idle'
  | 'loading'
  | 'permission-denied'
  | 'services-disabled'
  | 'error';

export type DeviceLocationHandler = (location: WeatherLocation) => void;

const FALLBACK_NAME = 'Mevcut konum';

function hasValidCoordinates(coords: Location.LocationObjectCoords): boolean {
  return (
    Number.isFinite(coords.latitude) &&
    Number.isFinite(coords.longitude) &&
    coords.latitude >= -90 &&
    coords.latitude <= 90 &&
    coords.longitude >= -180 &&
    coords.longitude <= 180
  );
}

function trimmed(value: string | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function resolveName(latitude: number, longitude: number): Promise<string> {
  try {
    const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (address === undefined) return FALLBACK_NAME;
    const candidates = [address.city, address.district, address.subregion, address.region];
    for (const candidate of candidates) {
      const name = trimmed(candidate);
      if (name !== '') return name;
    }
    return FALLBACK_NAME;
  } catch {
    return FALLBACK_NAME;
  }
}

export function useDeviceLocation() {
  const [status, setStatus] = useState<DeviceLocationStatus>('idle');
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const pendingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
    };
  }, []);

  const cancelPendingRequest = useCallback(() => {
    generationRef.current += 1;
    setStatus('idle');
  }, []);

  const requestCurrentLocation = useCallback((onLocation: DeviceLocationHandler) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    const generation = (generationRef.current += 1);
    setStatus('loading');

    const isCurrent = () => mountedRef.current && generationRef.current === generation;

    void (async () => {
      try {
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!isCurrent()) return;
        if (!servicesEnabled) {
          setStatus('services-disabled');
          return;
        }

        const permission = await Location.requestForegroundPermissionsAsync();
        if (!isCurrent()) return;
        if (!permission.granted) {
          setStatus('permission-denied');
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!isCurrent()) return;
        if (!hasValidCoordinates(position.coords)) {
          setStatus('error');
          return;
        }

        const { latitude, longitude } = position.coords;
        const name = await resolveName(latitude, longitude);
        if (!isCurrent()) return;
        setStatus('idle');
        onLocation({ name, latitude, longitude });
      } catch {
        if (!isCurrent()) return;
        setStatus('error');
      } finally {
        pendingRef.current = false;
      }
    })();
  }, []);

  return { cancelPendingRequest, requestCurrentLocation, status };
}
