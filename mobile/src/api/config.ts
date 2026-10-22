const configuredUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
const developmentDefaultUrl = __DEV__ ? 'http://127.0.0.1:8000' : undefined;

if (!configuredUrl && !developmentDefaultUrl) {
  throw new Error('EXPO_PUBLIC_API_BASE_URL must be set to an HTTPS URL for release builds.');
}

const resolvedUrl = configuredUrl ?? developmentDefaultUrl;

if (resolvedUrl && !__DEV__ && !resolvedUrl.toLowerCase().startsWith('https://')) {
  throw new Error('EXPO_PUBLIC_API_BASE_URL must use HTTPS for release builds.');
}

export const BACKEND_URL = resolvedUrl!.replace(/\/+$/, '');
