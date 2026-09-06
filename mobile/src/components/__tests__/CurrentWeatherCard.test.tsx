import { act, fireEvent, render } from '@testing-library/react-native';

import { CurrentWeatherCard } from '../CurrentWeatherCard';
import type { CurrentWeather } from '../../types/weather';

// Queries always come from the render result (never the global `screen`).

const current: CurrentWeather = {
  location: 'Kadıköy, İstanbul',
  temperature: 21.6, // rounds up to 22°
  apparent_temperature: 18.4, // rounds down to 18°
  humidity: 63,
  wind_speed: 14.2,
  weather_code: 61, // 'Yağmurlu' / 🌧️
  time: '2025-06-15T14:30',
};

describe('CurrentWeatherCard', () => {
  it('shows location uppercased', async () => {
    const { getByText } = await render(<CurrentWeatherCard current={current} />);

    expect(getByText('KADIKÖY, İSTANBUL')).toBeTruthy();
  });

  it('shows the rounded temperature with a degree sign', async () => {
    const { getByText } = await render(<CurrentWeatherCard current={current} />);

    // Must render the rounded value (22°), not the raw one.
    expect(getByText('22°')).toBeTruthy();
  });

  it('shows the rounded apparent temperature', async () => {
    const { getByText } = await render(<CurrentWeatherCard current={current} />);

    expect(getByText('Hissedilen 18°')).toBeTruthy();
  });

  it('shows humidity as a percentage', async () => {
    const { getByText } = await render(<CurrentWeatherCard current={current} />);

    expect(getByText('Nem')).toBeTruthy();
    expect(getByText('%63')).toBeTruthy();
  });

  it('shows wind speed with the km/h unit', async () => {
    const { getByText } = await render(<CurrentWeatherCard current={current} />);

    expect(getByText('Rüzgâr')).toBeTruthy();
    expect(getByText('14.2 km/h')).toBeTruthy();
  });

  it('rounds wind speed to one decimal and removes trailing zeroes', async () => {
    const { getByText } = await render(
      <CurrentWeatherCard current={{ ...current, wind_speed: 7.234 }} />,
    );

    expect(getByText('7.2 km/h')).toBeTruthy();
  });

  it('shows the condition label and emoji for the weather code', async () => {
    const { getByText } = await render(<CurrentWeatherCard current={current} />);

    expect(getByText('Yağmurlu')).toBeTruthy();
    expect(getByText('🌧️')).toBeTruthy();
  });

  it('shows the formatted update time derived from current.time', async () => {
    const { getByText } = await render(<CurrentWeatherCard current={current} />);

    expect(getByText('14:30 itibarıyla')).toBeTruthy();
  });

  describe('last-updated indicator', () => {
    it('renders no last-updated label when fetchedAt is null', async () => {
      const { queryByText } = await render(
        <CurrentWeatherCard current={current} fetchedAt={null} />,
      );

      expect(queryByText(/^Son güncelleme: /)).toBeNull();
    });

    it('renders no last-updated label when fetchedAt is absent (backwards compatible)', async () => {
      const { queryByText } = await render(
        <CurrentWeatherCard current={current} />,
      );

      expect(queryByText(/^Son güncelleme: /)).toBeNull();
    });

    it('renders a Turkish last-updated label with HH:MM derived from fetchedAt', async () => {
      // Fix the clock so Date/toLocaleTimeString is deterministic and timezone-safe:
      // construct the expected string using the same local-time formatting path.
      const timestamp = new Date(2025, 5, 15, 9, 7).getTime();
      const expectedTime = new Date(timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const { getByText } = await render(
        <CurrentWeatherCard current={current} fetchedAt={timestamp} />,
      );

      expect(getByText(`Son güncelleme: ${expectedTime}`)).toBeTruthy();
    });

    it('rerenders with a new fetchedAt value', async () => {
      const first = new Date(2025, 5, 15, 9, 7).getTime();
      const second = new Date(2025, 5, 15, 18, 42).getTime();

      const { getByText, rerender } = await render(
        <CurrentWeatherCard current={current} fetchedAt={first} />,
      );

      expect(
        getByText(`Son güncelleme: ${formatTime(first)}`),
      ).toBeTruthy();

      await act(async () => {
        rerender(<CurrentWeatherCard current={current} fetchedAt={second} />);
      });

      expect(
        getByText(`Son güncelleme: ${formatTime(second)}`),
      ).toBeTruthy();
    });
  });
});

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
