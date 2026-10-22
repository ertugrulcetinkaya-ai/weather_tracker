import { resolveApiBaseUrl } from './resolveBaseUrl';

const configuredUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

export const BACKEND_URL = resolveApiBaseUrl(configuredUrl, __DEV__);
