import React from 'react';
import { AppState, StyleSheet } from 'react-native';
import { act, render } from '@testing-library/react-native';

import { NextRainCard } from '../NextRainCard';
import type { RainEvent } from '../../types/weather';
import { getWeatherTheme } from '../../weather/theme';

const rainEvent: RainEvent = {
  start_time: '2026-08-24T18:00',
  end_time: '2026-08-24T19:00',
  total_precipitation: 4.5,
  peak_time: '2026-08-24T18:00',
};

type AppStateListener = (state: string) => void;
const initialAppState = AppState.currentState;

function mockAppState() {
  let listener: AppStateListener | undefined;
  const subscriptions: Array<{ remove: jest.Mock }> = [];
  const addEventListenerSpy = jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, nextListener) => {
      listener = nextListener as AppStateListener;
      const subscription = { remove: jest.fn() };
      subscriptions.push(subscription);
      return subscription as never;
    });

  return {
    addEventListenerSpy,
    subscriptions,
    emit: (state: string) => {
      AppState.currentState = state as typeof AppState.currentState;
      listener?.(state);
    },
  };
}

describe('NextRainCard', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    AppState.currentState = initialAppState;
  });

  it.each([
    ['İstanbul', 'Europe/Istanbul', '2026-08-24T14:30:00.000Z'],
    ['Ankara', 'Europe/Istanbul', '2026-08-24T14:30:00.000Z'],
  ])('shows the remaining time for %s in the selected city timezone', async (_city, timezone, now) => {
    jest.setSystemTime(new Date(now));
    const { getByText, getByLabelText, getByTestId } = await render(
      <NextRainCard
        nextRain={rainEvent}
        timezone={timezone}
        forecastCurrent
        theme={getWeatherTheme(0)}
      />,
    );

    expect(getByTestId('rain-start-time').props.children).toBe('18:00');
    expect(getByTestId('rain-end-time').props.children).toBe('19:00');
    expect(getByTestId('next-rain-status').props.children).toBe(
      'Başlamasına 30 dakika kaldı.',
    );
    expect(getByText('4.5 mm')).toBeTruthy();
    expect(getByTestId('rain-peak-time').props.children).toBe('18:00');
    expect(getByLabelText(/Başlamasına 30 dakika kaldı/)).toBeTruthy();
    expect(getByText('· Yerel saat')).toBeTruthy();
    expect(getByText('Yağış türü belirtilmiyor.')).toBeTruthy();
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
        theme={getWeatherTheme(0)}
      />,
    );

    expect(getByText('Başlamasına 1 saat kaldı.')).toBeTruthy();
  });

  it.each([
    [
      'the repeated fall-back start time',
      '2026-11-01T01:30',
      '2026-11-01T02:30',
      '2026-11-01T04:00:00.000Z',
    ],
    [
      'the repeated fall-back end time',
      '2026-11-01T00:30',
      '2026-11-01T01:30',
      '2026-11-01T04:00:00.000Z',
    ],
    [
      'the skipped spring-forward time',
      '2026-03-08T02:30',
      '2026-03-08T03:30',
      '2026-03-08T06:00:00.000Z',
    ],
    [
      'an invalid local time',
      '2026-08-24T25:30',
      '2026-08-24T26:00',
      '2026-08-24T14:00:00.000Z',
    ],
  ])('does not claim an exact time for %s', async (_scenario, start_time, end_time, now) => {
    jest.setSystemTime(new Date(now));
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const ambiguousRain = { ...rainEvent, start_time, end_time };
    const { getByText, getByLabelText, queryByText } = await render(
      <NextRainCard
        nextRain={ambiguousRain}
        timezone="America/New_York"
        forecastCurrent
        theme={getWeatherTheme(0)}
      />,
    );

    expect(getByText('Yağış zamanı kesin olarak hesaplanamıyor.')).toBeTruthy();
    expect(
      getByLabelText(/Yağış zamanı kesin olarak hesaplanamıyor/),
    ).toBeTruthy();
    expect(queryByText(/Başlamasına .* kaldı/)).toBeNull();
    expect(queryByText('Yağış devam ediyor.')).toBeNull();
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it('updates the visible remaining time once per minute', async () => {
    jest.setSystemTime(new Date('2026-08-24T14:30:00.000Z'));
    const appState = mockAppState();
    const { getByText } = await render(
      <NextRainCard
        nextRain={rainEvent}
        timezone="Europe/Istanbul"
        forecastCurrent
        theme={getWeatherTheme(61)}
      />,
    );
    expect(getByText('Başlamasına 30 dakika kaldı.')).toBeTruthy();

    await act(async () => {
      appState.emit('active');
      jest.advanceTimersByTime(60_000);
    });

    expect(getByText('Başlamasına 29 dakika kaldı.')).toBeTruthy();
  });

  it('updates future to ongoing to ended during one active render session', async () => {
    jest.setSystemTime(new Date('2026-08-24T15:00:00.000Z'));
    const appState = mockAppState();
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const event = {
      ...rainEvent,
      start_time: '2026-08-24T18:01',
      end_time: '2026-08-24T18:02',
    };
    const { getByText, getByLabelText } = await render(
      <NextRainCard nextRain={event} timezone="Europe/Istanbul" forecastCurrent />,
    );

    expect(getByText('Başlamasına 1 dakika kaldı.')).toBeTruthy();
    await act(async () => appState.emit('active'));
    expect(setIntervalSpy).toHaveBeenCalled();

    await act(async () => jest.advanceTimersByTime(60_000));
    expect(getByText('Yağış devam ediyor.')).toBeTruthy();
    expect(getByLabelText(/Yağış devam ediyor/)).toBeTruthy();
    const ongoingInterval = setIntervalSpy.mock.results.at(-1)?.value;
    expect(ongoingInterval).toBeDefined();

    await act(async () => jest.advanceTimersByTime(60_000));
    expect(getByText('Bu yağış sona erdi.')).toBeTruthy();
    expect(getByLabelText(/Bu yağış sona erdi/)).toBeTruthy();
    expect(clearIntervalSpy).toHaveBeenCalledWith(ongoingInterval);
    expect(appState.subscriptions.at(-1)?.remove).toHaveBeenCalledTimes(1);
  });

  it('moves from ongoing to ended when the card first renders during rain', async () => {
    jest.setSystemTime(new Date('2026-08-24T15:00:00.000Z'));
    const appState = mockAppState();
    const event = {
      ...rainEvent,
      start_time: '2026-08-24T18:00',
      end_time: '2026-08-24T18:01',
    };
    const { getByText, getByLabelText } = await render(
      <NextRainCard nextRain={event} timezone="Europe/Istanbul" forecastCurrent />,
    );

    expect(getByText('Yağış devam ediyor.')).toBeTruthy();
    await act(async () => appState.emit('active'));
    await act(async () => jest.advanceTimersByTime(60_000));

    expect(getByText('Bu yağış sona erdi.')).toBeTruthy();
    expect(getByLabelText(/Bu yağış sona erdi/)).toBeTruthy();
  });

  it('stops while backgrounded and recalculates against the real time on foreground', async () => {
    jest.setSystemTime(new Date('2026-08-24T15:00:00.000Z'));
    const appState = mockAppState();
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const event = {
      ...rainEvent,
      start_time: '2026-08-24T18:01',
      end_time: '2026-08-24T18:02',
    };
    const { getByText, queryByText } = await render(
      <NextRainCard nextRain={event} timezone="Europe/Istanbul" forecastCurrent />,
    );

    expect(getByText('Başlamasına 1 dakika kaldı.')).toBeTruthy();
    await act(async () => appState.emit('active'));
    await act(async () => appState.emit('background'));
    expect(clearIntervalSpy).toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(60_000));
    expect(getByText('Başlamasına 1 dakika kaldı.')).toBeTruthy();

    await act(async () => appState.emit('active'));
    expect(getByText('Yağış devam ediyor.')).toBeTruthy();
    expect(queryByText(/Başlamasına .* kaldı/)).toBeNull();

    await act(async () => appState.emit('background'));
    await act(async () => jest.advanceTimersByTime(60_000));
    expect(getByText('Yağış devam ediyor.')).toBeTruthy();
    await act(async () => appState.emit('active'));

    expect(getByText('Bu yağış sona erdi.')).toBeTruthy();
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

  it('uses the rainy theme surface and readable copy while rain is ongoing', async () => {
    jest.setSystemTime(new Date('2026-08-24T15:30:00.000Z'));
    const rainyTheme = getWeatherTheme(61);
    const event = {
      ...rainEvent,
      start_time: '2026-08-24T18:00',
      end_time: '2026-08-24T19:00',
    };
    const { getByTestId, getByText } = await render(
      <NextRainCard
        nextRain={event}
        timezone="Europe/Istanbul"
        forecastCurrent
        theme={rainyTheme}
      />,
    );

    expect(StyleSheet.flatten(getByTestId('next-rain-card').props.style).backgroundColor).toBe(
      rainyTheme.surface,
    );
    expect(StyleSheet.flatten(getByTestId('next-rain-status').props.style).color).toBe(
      rainyTheme.text,
    );
    expect(getByTestId('next-rain-status').props.children).toBe('Yağış devam ediyor.');
    expect(StyleSheet.flatten(getByText('Sıradaki Yağış').props.style).color).toBe(rainyTheme.text);
  });

  it('shows that rain has ended when now is after its end', async () => {
    jest.setSystemTime(new Date('2026-08-24T16:30:00.000Z'));
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const appStateSpy = jest.spyOn(AppState, 'addEventListener');
    const { getByText, getByLabelText } = await render(
      <NextRainCard
        nextRain={rainEvent}
        timezone="Europe/Istanbul"
        forecastCurrent
      />,
    );

    expect(getByText('Bu yağış sona erdi.')).toBeTruthy();
    expect(getByLabelText(/Bu yağış sona erdi/)).toBeTruthy();
    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(appStateSpy).not.toHaveBeenCalled();
  });

  it('cleans up the active timer and AppState subscription when unmounted', async () => {
    jest.setSystemTime(new Date('2026-08-24T14:30:00.000Z'));
    const appState = mockAppState();
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const { unmount } = await render(
      <NextRainCard
        nextRain={rainEvent}
        timezone="Europe/Istanbul"
        forecastCurrent
      />,
    );
    await act(async () => appState.emit('active'));
    const activeInterval = setIntervalSpy.mock.results.at(-1)?.value;

    await act(async () => unmount());

    expect(activeInterval).toBeDefined();
    expect(clearIntervalSpy).toHaveBeenCalledWith(activeInterval);
    expect(appState.subscriptions.at(-1)?.remove).toHaveBeenCalledTimes(1);
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

  it('uses a calm snowy theme when no rain is expected without showing a sun icon', async () => {
    const snowyTheme = getWeatherTheme(71);
    const { getByText, getByTestId, queryByText } = await render(
      <NextRainCard
        nextRain={null}
        timezone="Europe/Istanbul"
        forecastCurrent
        theme={snowyTheme}
      />,
    );

    expect(getByText('Önümüzdeki 24 saatte yağış beklenmiyor.')).toBeTruthy();
    expect(queryByText('☀️')).toBeNull();
    expect(queryByText(/kar başlayacak|kar yağacak/i)).toBeNull();
    expect(StyleSheet.flatten(getByTestId('next-rain-card').props.style).backgroundColor).toBe(
      snowyTheme.surface,
    );
  });

  it('keeps local rain hours readable across midnight and preserves trace amounts', async () => {
    jest.setSystemTime(new Date('2026-08-24T19:30:00.000Z'));
    const overnightTrace = {
      start_time: '2026-08-24T23:00',
      end_time: '2026-08-25T01:00',
      total_precipitation: 0.004,
      peak_time: '2026-08-25T00:00',
    };
    const { getByTestId, getByText } = await render(
      <NextRainCard
        nextRain={overnightTrace}
        timezone="Europe/Istanbul"
        forecastCurrent
        theme={getWeatherTheme(0)}
      />,
    );

    expect(getByTestId('next-rain-status').props.children).toBe(
      'Başlamasına 30 dakika kaldı.',
    );
    expect(getByTestId('rain-start-time').props.children).toBe('23:00');
    expect(getByTestId('rain-end-time').props.children).toBe('01:00');
    expect(getByText('<0.01 mm')).toBeTruthy();
    expect(getByTestId('rain-peak-time').props.children).toBe('00:00');
  });

  it('shows cached rain details without presenting an exact countdown', async () => {
    jest.setSystemTime(new Date('2026-08-24T14:30:00.000Z'));
    const { getByText, getByTestId, queryByText, getByLabelText } = await render(
      <NextRainCard
        nextRain={rainEvent}
        timezone="Europe/Istanbul"
        forecastCurrent={false}
        theme={getWeatherTheme(0)}
      />,
    );

    expect(getByTestId('next-rain-status').props.children).toBe(
      'Tahmin güncel değil. Geri sayım gösterilmiyor.',
    );
    expect(getByText('4.5 mm')).toBeTruthy();
    expect(getByTestId('rain-start-time').props.children).toBe('18:00');
    expect(queryByText(/Başlamasına .* kaldı/)).toBeNull();
    expect(getByLabelText(/geri sayım gösterilmiyor/i)).toBeTruthy();
    expect(getByText('Tahmin güncel değil. Geri sayım gösterilmiyor.')).toBeTruthy();
  });

  it.each([
    ['sunny', 0],
    ['cloudy', 3],
    ['rainy', 61],
    ['snowy', 71],
    ['neutral', 999],
  ])('keeps %s theme text contrast accessible on its card surfaces', async (_kind, code) => {
    const theme = getWeatherTheme(code);
    const luminance = (color: string) => {
      const components = color
        .slice(1)
        .match(/.{2}/g)
        ?.map((component) => parseInt(component, 16) / 255);
      if (!components) throw new Error(`Invalid color: ${color}`);
      const linear = components.map((value) =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
      );
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    const contrast = (foreground: string, background: string) => {
      const first = luminance(foreground);
      const second = luminance(background);
      return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
    };

    expect(contrast(theme.text, theme.surface)).toBeGreaterThanOrEqual(3);
    expect(contrast(theme.mutedText, theme.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.text, theme.accentSoft)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.mutedText, theme.accentSoft)).toBeGreaterThanOrEqual(4.5);
  });

  it('allows text to scale without fixed-height clipping on the card', async () => {
    const { getByTestId } = await render(
      <NextRainCard
        nextRain={rainEvent}
        timezone="Europe/Istanbul"
        forecastCurrent
        theme={getWeatherTheme(0)}
      />,
    );
    const status = getByTestId('next-rain-status');

    expect(status.props.allowFontScaling).toBe(true);
    expect(StyleSheet.flatten(status.props.style).height).toBeUndefined();
  });
});
