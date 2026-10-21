import {
  calculateDailyTemperatureBar,
  getDailyTemperatureScale,
  isValidDailyTemperatureRange,
} from '../dailyTemperatureScale';

const day = (temperature_min: number, temperature_max: number) => ({
  temperature_min,
  temperature_max,
});

describe('daily temperature scale', () => {
  it('uses the coldest minimum and warmest maximum across valid days', () => {
    expect(getDailyTemperatureScale([day(-8, 2), day(3, 12), day(-3, 20)])).toEqual({
      minimum: -8,
      maximum: 20,
    });
  });

  it('places ranges from different days on the same scale', () => {
    const scale = getDailyTemperatureScale([day(-10, 30)]);

    expect(calculateDailyTemperatureBar(day(5, 15), scale)).toEqual({
      left: 37.5,
      width: 25,
      isPoint: false,
    });
    expect(calculateDailyTemperatureBar(day(10, 25), scale)).toEqual({
      left: 50,
      width: 37.5,
      isPoint: false,
    });
  });

  it('supports negative-only scales and keeps temperatures in their true order', () => {
    const scale = getDailyTemperatureScale([day(-18, -4), day(-12, -1)]);

    expect(scale).toEqual({ minimum: -18, maximum: -1 });
    expect(calculateDailyTemperatureBar(day(-12, -1), scale)).toEqual({
      left: (6 / 17) * 100,
      width: (11 / 17) * 100,
      isPoint: false,
    });
  });

  it('uses a point when all days have the same temperature', () => {
    const days = [day(7, 7), day(7, 7), day(7, 7)];
    const scale = getDailyTemperatureScale(days);

    expect(scale).toEqual({ minimum: 7, maximum: 7 });
    expect(calculateDailyTemperatureBar(days[0], scale)).toEqual({
      left: 50,
      width: 0,
      isPoint: true,
    });
  });

  it('uses a point for a single day whose minimum equals its maximum', () => {
    const scale = getDailyTemperatureScale([day(-10, 20), day(5, 5)]);

    expect(calculateDailyTemperatureBar(day(5, 5), scale)).toEqual({
      left: 50,
      width: 0,
      isPoint: true,
    });
  });

  it('keeps a very wide daily range proportional to the weekly range', () => {
    const scale = getDailyTemperatureScale([day(-40, 45), day(-50, 50)]);

    expect(calculateDailyTemperatureBar(day(-40, 45), scale)).toEqual({
      left: 10,
      width: 85,
      isPoint: false,
    });
  });

  it('ignores invalid data when building the scale and does not invent a range', () => {
    const invalidDays = [day(Number.NaN, 20), day(12, Number.POSITIVE_INFINITY), day(8, 3)];

    expect(invalidDays.every((item) => !isValidDailyTemperatureRange(item))).toBe(true);
    expect(getDailyTemperatureScale(invalidDays)).toBeNull();
    expect(calculateDailyTemperatureBar(invalidDays[0], { minimum: 0, maximum: 20 })).toBeNull();
  });

  it('returns no scale for an empty or invalid list', () => {
    expect(getDailyTemperatureScale([])).toBeNull();
    expect(getDailyTemperatureScale([day(4, 2)])).toBeNull();
  });
});
