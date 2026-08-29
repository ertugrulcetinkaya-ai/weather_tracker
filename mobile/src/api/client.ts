import { BACKEND_URL } from './config';

const DEFAULT_TIMEOUT_MS = 10_000;

type RequestOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function extractErrorDetail(payload: unknown): string | null {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'detail' in payload &&
    typeof payload.detail === 'string'
  ) {
    return payload.detail;
  }
  return null;
}

export async function requestJson(
  path: string,
  { signal, timeoutMs = DEFAULT_TIMEOUT_MS }: RequestOptions = {}
): Promise<unknown> {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort();
  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener('abort', abortFromCaller, { once: true });
  }
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(`${BACKEND_URL}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = extractErrorDetail(payload);
      throw new ApiError(
        detail ?? `API request failed with status ${response.status}`,
        response.status
      );
    }
    if (payload === null) {
      throw new ApiError('API response is not valid JSON', response.status);
    }
    return payload;
  } catch (error) {
    if (timedOut) {
      throw new ApiError('API request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}
