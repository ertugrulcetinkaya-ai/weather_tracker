export function formatWindSpeed(value: number): string {
  return Number(value.toFixed(1)).toString();
}

export function formatPrecipitation(value: number): string {
  if (value === 0) {
    return '0';
  }
  if (value > 0 && value < 0.01) {
    return '<0.01';
  }
  return Number(value.toFixed(2)).toString();
}
