import { ApiError, requestJson } from '../client';

function responseWith(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(payload),
  } as unknown as Response;
}

function abortableFetch(): jest.MockedFunction<typeof fetch> {
  return jest.fn((_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    })
  );
}

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('requestJson', () => {
  test('sends JSON requests to the configured backend', async () => {
    const fetchMock = jest.fn().mockResolvedValue(responseWith({ status: 'ok' }));
    jest.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    await expect(requestJson('/health')).resolves.toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/health$/),
      expect.objectContaining({
        headers: { Accept: 'application/json' },
        signal: expect.any(AbortSignal),
      })
    );
  });

  test('preserves API error details and status codes', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(responseWith({ detail: 'provider unavailable' }, 502));

    const request = requestJson('/weather/overview');

    await expect(request).rejects.toEqual(
      expect.objectContaining<ApiError>({
        name: 'ApiError',
        message: 'provider unavailable',
        status: 502,
      })
    );
  });

  test('rejects successful responses that are not valid JSON', async () => {
    const response = responseWith(null);
    (response.json as jest.Mock).mockRejectedValue(new SyntaxError('invalid JSON'));
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    await expect(requestJson('/health')).rejects.toThrow('API response is not valid JSON');
  });

  test('aborts and classifies requests that exceed the timeout', async () => {
    jest.useFakeTimers();
    jest.spyOn(globalThis, 'fetch').mockImplementation(abortableFetch());

    const request = requestJson('/slow', { timeoutMs: 50 });
    const assertion = expect(request).rejects.toThrow('API request timed out');
    jest.advanceTimersByTime(50);

    await assertion;
  });

  test('propagates caller cancellation without misclassifying it as a timeout', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(abortableFetch());
    const controller = new AbortController();

    const request = requestJson('/weather/overview', { signal: controller.signal });
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });
});
