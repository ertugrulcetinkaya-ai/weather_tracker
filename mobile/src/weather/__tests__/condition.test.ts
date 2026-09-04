import { formatWeatherTime, getWeatherCondition } from '../condition';

describe('getWeatherCondition', () => {
  it('returns the exact condition for a known WMO code', () => {
    expect(getWeatherCondition(0)).toEqual({ label: 'Açık', emoji: '☀️' });
    expect(getWeatherCondition(95)).toEqual({
      label: 'Gök gürültülü fırtına',
      emoji: '⛈️',
    });
  });

  it('returns the fallback condition for an unknown code', () => {
    expect(getWeatherCondition(42)).toEqual({
      label: 'Hava durumu',
      emoji: '🌡️',
    });
  });
});

describe('formatWeatherTime', () => {
  it('formats a valid ISO-like timestamp as HH:mm itibarıyla', () => {
    expect(formatWeatherTime('2024-05-17T14:05')).toBe('14:05 itibarıyla');
    expect(formatWeatherTime('2023-01-01T00:00')).toBe('00:00 itibarıyla');
  });

  it('returns the fallback message for a malformed timestamp', () => {
    expect(formatWeatherTime('2024-05-17 14:05')).toBe(
      'Güncelleme zamanı bilinmiyor',
    );
    expect(formatWeatherTime('not-a-timestamp')).toBe(
      'Güncelleme zamanı bilinmiyor',
    );
    expect(formatWeatherTime('')).toBe('Güncelleme zamanı bilinmiyor');
  });
});
