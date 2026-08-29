const configuredUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

export const BACKEND_URL = (configuredUrl || 'http://127.0.0.1:8000').replace(/\/$/, '');
