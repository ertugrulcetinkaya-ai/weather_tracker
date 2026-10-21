import React from 'react';
import { AppState } from 'react-native';
import { act, render } from '@testing-library/react-native';

import { NextRainCard } from '../NextRainCard';
import type { RainEvent } from '../../types/weather';

const rainEvent: RainEvent = {
  start_time: '2026-08-24T18:00',
  end_time: '2026-08-24T19:00',
  total_precipitation: 4.5,
  peak_time: '2026-08-24T18:00',
};

describe('NextRainCard', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([
    ['İstanbul', 'Europe/Istanbul', '2026-08-24T14:30:00.000Z'],
    ['Ankara', 'Europe/Istanbul', '2026-08-24T14:30:00.000Z'],
  ])('shows the remaining time for %s in the selected city timezone', async (_city, timezone, now) => {
    jest.setSystemTime(new Date(now));
    const { getByText, getByLabelText } = await render(
      <NextRainCard nextRain={rainEvent} timezone={timezone} forecastCurrent />,
    );

    expect(getByText('18:00 – 19:00')).toBeTruthy();
    expect(getByText('Başlamasına 30 dakika kaldı.')).toBeTruthy();
    expect(getByText('Toplam 4.5 mm')).toBeTruthy();
    expect(getByText('En yoğun: 18:00')).toBeTruthy();
    expect(getByLabelText(/Başlamasına 30 dakika kaldı/)).toBeTruthy();
  });

  it('calculates the remaining time in a timezone different from Istanbul', async () => {
    jest.setSystemTime(new Date('2026-08-24T14:00:00.000Z'));
    const newYorkRain = {
      ...rainEvent,
      start_time: '2026-08-24T11:00',
      end_time: '2026-08-24T12:00',
      peak_time: '2026-08-24T11:00',
    };
    const { getByText } = await render(
      <NextRainCard
        nextRain={newYorkRain}
        timezone="America/New_York"
        forecastCurrent
      />,
    );

    expect(getByText('Başlamasına 1 saat kaldı.')).toBeTruthy();
  });

  it('updates the visible remaining time once per minute', async () => {
    jest.setSystemTime(new Date('2026-08-24T14:30:00.000Z'));
    let onAppStateChange: ((state: string) => void) | undefined;
    const appStateSpy = jest.spyOn(AppState, 'addEventListener').mockImplementation(
      (_event, listener) => {
        onAppStateChange = listener as (state: string) => void;
        return { remove: jest.fn() } as never;
      },
    );
    const { getByText } = await render(
      <NextRainCard
        nextRain={rainEvent}
        timezone="Europe/Istanbul"
        forecastCurrent
      />,
    );
    expect(getByText('Başlamasına 30 dakika kaldı.')).toBeTruthy();

    await act(async () => {
      onAppStateChange?.('active');
      jest.advanceTimersByTime(60_000);
    });

    expect(getByText('Başlamasına 29 dakika kaldı.')).toBeTruthy();
    appStateSpy.mockRestore();
  });

  it('shows that rain is ongoing when now falls between its local start and end', async () => {
    jest.setSystemTime(new Date('2026-08-24T15:30:00.000Z'));
    const newYorkRain = {
      ...rainEvent,
      start_time: '2026-08-24T11:00',
      end_time: '2026-08-24T12:00',
      peak_time: '2026-08-24T11:00',
    };
    const { getByText, getByLabelText } = await render(
      <NextRainCard
        nextRain={newYorkRain}
        timezone="America/New_York"
        forecastCurrent
      />,
    );

    expect(getByText('Yağış devam ediyor.')).toBeTruthy();
    expect(getByLabelText(/Yağış devam ediyor/)).toBeTruthy();
  });

  it('does not show a countdown for an offline cached forecast without a timezone', async () => {
    jest.setSystemTime(new Date('2026-08-24T14:30:00.000Z'));
    const { getByText, queryByText, getByLabelText } = await render(
      <NextRainCard
        nextRain={rainEvent}
        timezone=""
        forecastCurrent={false}
      />,
    );

    expect(getByText('Tahmin güncel değil. Geri sayım gösterilmiyor.')).toBeTruthy();
    expect(queryByText(/Başlamasına .* kaldı/)).toBeNull();
    expect(getByLabelText(/geri sayım gösterilmiyor/i)).toBeTruthy();
  });

  it('preserves the no-rain message when there is no event', async () => {
    const { getByText, queryByText, getByLabelText } = await render(
      <NextRainCard
        nextRain={null}
        timezone="Europe/Istanbul"
        forecastCurrent
      />,
    );

    expect(getByText('Sıradaki Yağış')).toBeTruthy();
    expect(getByText('Önümüzdeki 24 saatte yağış beklenmiyor.')).toBeTruthy();
    expect(getByLabelText(/24 saatte yağış beklenmiyor/)).toBeTruthy();
    expect(queryByText(/Toplam/)).toBeNull();
    expect(queryByText(/En yoğun/)).toBeNull();
  });

  it('keeps a stale no-rain message with an explicit freshness note', async () => {
    const { getByText } = await render(
      <NextRainCard
        nextRain={null}
        timezone="Europe/Istanbul"
        forecastCurrent={false}
      />,
    );

    expect(getByText('Önümüzdeki 24 saatte yağış beklenmiyor.')).toBeTruthy();
    expect(getByText('Tahmin güncel olmayabilir.')).toBeTruthy();
  });
});
