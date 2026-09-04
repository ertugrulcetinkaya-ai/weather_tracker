import { render } from '@testing-library/react-native';

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

  it('shows wind speed with the km/s unit', async () => {
    const { getByText } = await render(<CurrentWeatherCard current={current} />);

    expect(getByText('Rüzgâr')).toBeTruthy();
    expect(getByText('14.2 km/s')).toBeTruthy();
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
});
