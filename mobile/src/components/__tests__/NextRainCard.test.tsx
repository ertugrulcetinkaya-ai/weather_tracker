import React from 'react';
import { render } from '@testing-library/react-native';

import { NextRainCard } from '../NextRainCard';
import type { RainEvent } from '../../types/weather';

describe('NextRainCard', () => {
  it('renders formatted start, end, total precipitation, and peak time for a rain event', async () => {
    const rainEvent: RainEvent = {
      start_time: '2024-05-01T14:00',
      end_time: '2024-05-01T17:30',
      total_precipitation: 4.5,
      peak_time: '2024-05-01T16:00',
    };

    const { getByText, queryByText } = await render(
      <NextRainCard nextRain={rainEvent} />,
    );

    expect(getByText('Sıradaki Yağış')).toBeTruthy();

    // Start and end hours are formatted from ISO-like timestamps to HH:mm
    // and rendered as a single combined time range.
    expect(getByText('14:00 – 17:30')).toBeTruthy();

    // Total precipitation is shown in mm with up to 2 decimals.
    expect(getByText('Toplam 4.5 mm')).toBeTruthy();

    // Peak time is formatted as HH:mm.
    expect(getByText('En yoğun: 16:00')).toBeTruthy();

    // No-rain fallback message must not be present.
    expect(
      queryByText('Önümüzdeki 24 saatte yağış beklenmiyor.'),
    ).toBeNull();
  });

  it('formats precipitation with two decimal places when needed', async () => {
    const rainEvent: RainEvent = {
      start_time: '2024-05-01T08:05',
      end_time: '2024-05-01T09:05',
      total_precipitation: 1.234,
      peak_time: '2024-05-01T08:35',
    };

    const { getByText } = await render(<NextRainCard nextRain={rainEvent} />);

    expect(getByText('Toplam 1.23 mm')).toBeTruthy();
    expect(getByText('En yoğun: 08:35')).toBeTruthy();
  });

  it('shows the no-rain message when nextRain is null', async () => {
    const { getByText, queryByText } = await render(
      <NextRainCard nextRain={null} />,
    );

    expect(getByText('Sıradaki Yağış')).toBeTruthy();
    expect(
      getByText('Önümüzdeki 24 saatte yağış beklenmiyor.'),
    ).toBeTruthy();

    // Rain-event specific details must not be rendered.
    expect(queryByText(/Toplam/)).toBeNull();
    expect(queryByText(/En yoğun/)).toBeNull();
  });
});
