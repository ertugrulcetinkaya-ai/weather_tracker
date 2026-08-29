import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchWeatherOverview } from '../api/weather';
import type { WeatherLocation, WeatherOverview } from '../types/weather';

type OverviewStatus = 'idle' | 'loading' | 'ready' | 'error';

export function useWeatherOverview(location: WeatherLocation, enabled: boolean) {
  const [overview, setOverview] = useState<WeatherOverview | null>(null);
  const [status, setStatus] = useState<OverviewStatus>('idle');
  const controllerRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setOverview(null);
    setStatus('loading');
    try {
      const data = await fetchWeatherOverview(location, controller.signal);
      if (controller.signal.aborted) return;
      setOverview(data);
      setStatus('ready');
    } catch {
      if (controller.signal.aborted) return;
      setStatus('error');
    }
  }, [location]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    return () => controllerRef.current?.abort();
  }, [enabled, refresh]);

  return { overview, refresh, status };
}
