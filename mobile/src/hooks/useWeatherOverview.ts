import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchWeatherOverview } from '../api/weather';
import { loadWeatherCache, saveWeatherCache } from '../storage/weatherCache';
import type { WeatherLocation, WeatherOverview } from '../types/weather';

type OverviewStatus = 'idle' | 'loading' | 'ready' | 'error';
type RefreshStatus = 'idle' | 'loading' | 'error';

export function useWeatherOverview(location: WeatherLocation, enabled: boolean) {
  const [overview, setOverview] = useState<WeatherOverview | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [status, setStatus] = useState<OverviewStatus>('idle');
  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus>('idle');
  const controllerRef = useRef<AbortController | null>(null);
  const overviewRef = useRef<WeatherOverview | null>(null);
  const fetchedAtRef = useRef<number | null>(null);

  const load = useCallback(
    async ({ preserveExisting }: { preserveExisting: boolean }) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const hasExistingSnapshot = preserveExisting && overviewRef.current !== null;

      if (hasExistingSnapshot) {
        setRefreshStatus('loading');
      } else {
        overviewRef.current = null;
        fetchedAtRef.current = null;
        setOverview(null);
        setFetchedAt(null);
        setStatus('loading');
        setRefreshStatus('idle');
      }

      let networkAccepted = false;
      let activeNetworkFailure = false;

      if (!preserveExisting) {
        void loadWeatherCache(location)
          .then((cached) => {
            if (networkAccepted) return;
            if (controller.signal.aborted || controllerRef.current !== controller) return;
            if (cached === null) return;
            networkAccepted = true;
            overviewRef.current = cached.overview;
            fetchedAtRef.current = cached.fetchedAt;
            setOverview(cached.overview);
            setFetchedAt(cached.fetchedAt);
            setStatus('ready');
            setRefreshStatus(activeNetworkFailure ? 'error' : 'loading');
          })
          .catch(() => undefined);
      }

      try {
        const data = await fetchWeatherOverview(location, controller.signal);
        if (controller.signal.aborted || controllerRef.current !== controller) return;
        const acceptedAt = Date.now();
        networkAccepted = true;
        overviewRef.current = data;
        fetchedAtRef.current = acceptedAt;
        setOverview(data);
        setFetchedAt(acceptedAt);
        setStatus('ready');
        setRefreshStatus('idle');
        void saveWeatherCache(location, data, acceptedAt).catch(() => undefined);
      } catch {
        if (controller.signal.aborted || controllerRef.current !== controller) return;
        if (!hasExistingSnapshot && overviewRef.current === null) {
          networkAccepted = false;
          activeNetworkFailure = true;
        } else {
          networkAccepted = true;
        }
        if (hasExistingSnapshot || overviewRef.current !== null) {
          setStatus('ready');
          setRefreshStatus('error');
        } else {
          setStatus('error');
          setRefreshStatus('idle');
        }
      }
    },
    [location]
  );

  const refresh = useCallback(() => load({ preserveExisting: true }), [load]);

  useEffect(() => {
    if (!enabled) return;
    void load({ preserveExisting: false });
    return () => controllerRef.current?.abort();
  }, [enabled, load]);

  return { fetchedAt, overview, refresh, status, refreshStatus };
}
