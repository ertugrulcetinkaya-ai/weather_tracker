import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import { LocationControls } from '../LocationControls';
import type { LocationSearchResult, WeatherLocation } from '../../types/weather';

const FAVORITE_CHIP_BERLIN_TEST_ID = 'favorite-chip-Berlin';
const FAVORITE_CHIP_KYOTO_TEST_ID = 'favorite-chip-Kyoto';

const izmir: WeatherLocation = {
  name: 'Izmir',
  latitude: 38.4237,
  longitude: 27.1428,
};

const istanbul: WeatherLocation = {
  name: 'Istanbul',
  latitude: 41.0082,
  longitude: 28.9784,
};

const ankara: WeatherLocation = {
  name: 'Ankara',
  latitude: 39.9334,
  longitude: 32.8597,
};

const berlinFavorite: WeatherLocation = {
  name: 'Berlin',
  latitude: 52.52,
  longitude: 13.405,
};

const kyotoFavorite: WeatherLocation = {
  name: 'Kyoto',
  latitude: 35.0116,
  longitude: 135.7681,
};

const berlinSearchResult: LocationSearchResult = {
  name: 'Berlin',
  latitude: 52.52,
  longitude: 13.405,
  admin1: 'Berlin',
  country: 'Germany',
};

const parisSearchResult: LocationSearchResult = {
  name: 'Paris',
  latitude: 48.8566,
  longitude: 2.3522,
  admin1: 'Ile-de-France',
  country: 'France',
};

const unknownSearchResult: LocationSearchResult = {
  name: 'Springfield',
  latitude: 39.7817,
  longitude: -89.6501,
  admin1: '',
  country: 'United States',
};

type RenderOptions = Partial<Parameters<typeof LocationControls>[0]>;

async function renderControls(overrides: RenderOptions = {}) {
  const props = {
    locations: [izmir, istanbul],
    favorites: [] as WeatherLocation[],
    searchQuery: '',
    searchStatus: 'idle' as const,
    searchResults: [] as LocationSearchResult[],
    persistenceError: false,
    isFavorite: false,
    isSelected: (_location: WeatherLocation) => false,
    onLocationSelect: jest.fn(),
    onSearchResultSelect: jest.fn(),
    onSearchQueryChange: jest.fn(),
    onFavoriteToggle: jest.fn(),
    ...overrides,
  };

  const utils = await render(<LocationControls {...props} />);

  return { ...utils, props };
}

describe('LocationControls quick cities', () => {
  it('renders every quick city and reports presses with the matching location', async () => {
    const { getByText, props } = await renderControls();

    await fireEvent.press(getByText('Izmir'));
    expect(props.onLocationSelect).toHaveBeenCalledWith(izmir);

    await fireEvent.press(getByText('Istanbul'));
    expect(props.onLocationSelect).toHaveBeenLastCalledWith(istanbul);
    expect(props.onLocationSelect).toHaveBeenCalledTimes(2);
  });

  it('marks only the selected quick city as selected for accessibility', async () => {
    const { getByRole, queryByRole } = await renderControls({
      locations: [izmir, istanbul, ankara],
      isSelected: (location) => location.name === 'Istanbul',
    });

    // accessibilityState lives on the Pressable host, so query the button hosts.
    expect(
      getByRole('button', { name: 'Izmir' }).props.accessibilityState,
    ).toMatchObject({
      selected: false,
    });
    expect(
      getByRole('button', { name: 'Istanbul' }).props.accessibilityState,
    ).toMatchObject({
      selected: true,
    });
    expect(queryByRole('button', { name: 'Ankara' })).not.toBeNull();
  });
});

describe('LocationControls search input', () => {
  it('shows the controlled query and forwards typed text to onSearchQueryChange', async () => {
    const { getByPlaceholderText, props } = await renderControls({
      searchQuery: 'berl',
    });

    const input = getByPlaceholderText('Şehir veya yer ara');
    expect(input.props.value).toBe('berl');
    expect(input.props.accessibilityLabel).toBe('Konum ara');

    await fireEvent.changeText(input, 'Berlin');
    expect(props.onSearchQueryChange).toHaveBeenCalledTimes(1);
    expect(props.onSearchQueryChange).toHaveBeenCalledWith('Berlin');
  });
});

describe('LocationControls search status', () => {
  it('shows the loading message while a search is in flight and nothing else', async () => {
    const { getByText, queryByText } = await renderControls({
      searchStatus: 'loading',
      searchQuery: 'berl',
    });

    expect(getByText('Aranıyor...')).toBeOnTheScreen();
    expect(queryByText('Arama yapılamadı.')).toBeNull();
    expect(queryByText('Sonuç bulunamadı.')).toBeNull();
  });

  it('exposes the error message with an alert role when the search fails', async () => {
    const { getByRole } = await renderControls({
      searchStatus: 'error',
      searchQuery: 'berl',
    });

    expect(
      getByRole('alert', { name: 'Arama yapılamadı.' }),
    ).toBeOnTheScreen();
  });

  it('shows an empty-result message when the search is ready with no matches', async () => {
    const { getByText, queryByText } = await renderControls({
      searchStatus: 'ready',
      searchQuery: 'zzzzz',
      searchResults: [],
    });

    expect(getByText('Sonuç bulunamadı.')).toBeOnTheScreen();
    expect(queryByText('Aranıyor...')).toBeNull();
  });

  it('renders result rows with their admin region and omits blank admin values', async () => {
    const { getAllByText, getByText, queryByText } = await renderControls({
      searchStatus: 'ready',
      searchQuery: 'spring',
      searchResults: [berlinSearchResult, parisSearchResult, unknownSearchResult],
    });

    // Berlin's name and admin1 are identical, so both texts render; assert the
    // duplicated pair plus the single-copy rows that carry a distinct admin.
    expect(getAllByText('Berlin')).toHaveLength(2);
    expect(getByText('Paris')).toBeOnTheScreen();
    expect(getByText('Springfield')).toBeOnTheScreen();

    expect(getByText('Ile-de-France')).toBeOnTheScreen();
    expect(queryByText('United States')).toBeNull();
  });

  it('reports the tapped search result through onSearchResultSelect', async () => {
    const { getByText, props } = await renderControls({
      searchStatus: 'ready',
      searchQuery: 'par',
      searchResults: [berlinSearchResult, parisSearchResult],
    });

    await fireEvent.press(getByText('Paris'));
    expect(props.onSearchResultSelect).toHaveBeenCalledTimes(1);
    expect(props.onSearchResultSelect).toHaveBeenCalledWith(parisSearchResult);
  });
});

describe('LocationControls favorites', () => {
  it('hides the favorites section entirely when there are no favorites', async () => {
    const { queryByText } = await renderControls({ favorites: [] });

    expect(queryByText('Favoriler')).toBeNull();
    expect(queryByText('Berlin')).toBeNull();
  });

  it('renders each favorite chip and reports presses with the favorite location', async () => {
    const { getByTestId, getByText, props } = await renderControls({
      favorites: [berlinFavorite, kyotoFavorite],
    });

    expect(getByText('Favoriler')).toBeOnTheScreen();
    expect(getByTestId('favorite-chip-Berlin')).toBeOnTheScreen();
    expect(getByTestId('favorite-chip-Kyoto')).toBeOnTheScreen();

    await fireEvent.press(getByText('Kyoto'));
    expect(props.onLocationSelect).toHaveBeenCalledTimes(1);
    expect(props.onLocationSelect).toHaveBeenCalledWith(kyotoFavorite);
  });

  it('reflects the selected favorite through accessibility state only for that chip', async () => {
    const { getByTestId } = await renderControls({
      favorites: [berlinFavorite, kyotoFavorite],
      isSelected: (location) =>
        location.name === kyotoFavorite.name &&
        location.latitude === kyotoFavorite.latitude &&
        location.longitude === kyotoFavorite.longitude,
    });

    // The chip host (Pressable) owns accessibilityState, not its inner Text.
    expect(
      getByTestId(FAVORITE_CHIP_BERLIN_TEST_ID).props.accessibilityState,
    ).toMatchObject({
      selected: false,
    });
    expect(
      getByTestId(FAVORITE_CHIP_KYOTO_TEST_ID).props.accessibilityState,
    ).toMatchObject({
      selected: true,
    });
  });

  it('keeps the favorite chip tap target and text metrics intact', async () => {
    const { getByTestId, getByText } = await renderControls({
      favorites: [berlinFavorite],
    });

    const chip = getByTestId(FAVORITE_CHIP_BERLIN_TEST_ID);
    // RNTL testID lookup resolves to the chip host, which carries the merged
    // Pressable style and the accessibility role.
    expect(chip.props.accessibilityRole).toBe('button');

    const chipStyle = StyleSheet.flatten(chip.props.style) as object;
    expect(chipStyle).toMatchObject({
      height: 44,
      minWidth: 110,
      flexShrink: 0,
    });

    const chipTextStyle = StyleSheet.flatten(
      getByText('Berlin').props.style,
    ) as object;
    expect(chipTextStyle).toMatchObject({
      lineHeight: 20,
    });
  });
});

describe('LocationControls favorite toggle', () => {
  it('invites the user to add the current location when it is not a favorite', async () => {
    const { getByText, props } = await renderControls({ isFavorite: false });

    await fireEvent.press(getByText('☆ Favoriye ekle'));
    expect(props.onFavoriteToggle).toHaveBeenCalledTimes(1);
  });

  it('offers removal when the current location is already a favorite', async () => {
    const { getByText, queryByText, props } = await renderControls({
      isFavorite: true,
    });

    expect(queryByText('☆ Favoriye ekle')).toBeNull();
    await fireEvent.press(getByText('★ Favorilerden çıkar'));
    expect(props.onFavoriteToggle).toHaveBeenCalledTimes(1);
  });
});

describe('LocationControls persistence error', () => {
  it('surfaces the storage warning with an alert role only when persistence failed', async () => {
    const { queryByRole } = await renderControls({ persistenceError: false });

    expect(
      queryByRole('alert', {
        name: 'Konum tercihleri bu cihazda kaydedilemedi.',
      }),
    ).toBeNull();
  });

  it('shows the storage warning as an alert when preferences cannot be saved', async () => {
    const { getByRole } = await renderControls({ persistenceError: true });

    expect(
      getByRole('alert', {
        name: 'Konum tercihleri bu cihazda kaydedilemedi.',
      }),
    ).toBeOnTheScreen();
  });
});
