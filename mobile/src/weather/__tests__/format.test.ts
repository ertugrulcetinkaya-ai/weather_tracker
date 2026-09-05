import { formatPrecipitation, formatWindSpeed } from '../format';

describe('weather number formatting', () => {
  it.each([
    [7, '7'],
    [7.0, '7'],
    [7.24, '7.2'],
    [7.26, '7.3'],
    [13.234, '13.2'],
  ])('formats wind speed %s as %s', (value, expected) => {
    expect(formatWindSpeed(value)).toBe(expected);
  });

  it.each([
    [0, '0'],
    [1, '1'],
    [1.2, '1.2'],
    [1.25, '1.25'],
    [1.234, '1.23'],
    [1.2000000000000002, '1.2'],
  ])('formats precipitation %s as %s', (value, expected) => {
    expect(formatPrecipitation(value)).toBe(expected);
  });
});
