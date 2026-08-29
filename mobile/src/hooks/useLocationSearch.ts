import { useCallback, useEffect, useRef, useState } from 'react';

import { searchLocations } from '../api/weather';
import type { LocationSearchResult } from '../types/weather';

type SearchStatus = 'idle' | 'loading' | 'ready' | 'error';

export function useLocationSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    controllerRef.current?.abort();

    if (trimmed.length < 2) {
      setResults([]);
      setStatus('idle');
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setResults([]);
    setStatus('loading');
    const timer = setTimeout(() => {
      void searchLocations(trimmed, controller.signal)
        .then((data) => {
          if (controller.signal.aborted) return;
          setResults(data);
          setStatus('ready');
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setResults([]);
          setStatus('error');
        });
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    setQuery('');
    setResults([]);
    setStatus('idle');
  }, []);

  return { query, reset, results, setQuery, status };
}
