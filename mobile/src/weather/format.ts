export function formatWindSpeed(value: number): string {
  return Number(value.toFixed(1)).toString();
}

export function formatPrecipitation(value: number): string {
  return Number(value.toFixed(2)).toString();
}
