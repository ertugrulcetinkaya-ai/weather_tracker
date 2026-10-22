const DEVELOPMENT_DEFAULT_API_URL = 'http://127.0.0.1:8000';

function isNonPublicHost(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  const isIPv6Address = host.includes(':');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    (isIPv6Address &&
      (host === '::' ||
        host === '::1' ||
        host.startsWith('fc') ||
        host.startsWith('fd') ||
        /^fe[89ab]/.test(host)))
  ) {
    return true;
  }

  const octets = host.split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet, index) => !/^\d{1,3}$/.test(host.split('.')[index]) || octet > 255)
  ) {
    return false;
  }

  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function resolveApiBaseUrl(configuredUrl, isDevelopment) {
  const value = typeof configuredUrl === 'string' ? configuredUrl.trim() : '';
  if (!value) {
    if (isDevelopment) return DEVELOPMENT_DEFAULT_API_URL;
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be set to an HTTPS URL for release builds.');
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be a valid absolute URL.');
  }

  if (
    !parsed.hostname ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    value.includes('?') ||
    value.includes('#')
  ) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be a valid API base URL.');
  }

  if (parsed.protocol !== 'https:' && !(isDevelopment && parsed.protocol === 'http:')) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must use HTTPS for release builds.');
  }

  if (!isDevelopment && isNonPublicHost(parsed.hostname)) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must point to a public HTTPS host for release builds.');
  }

  return value.replace(/\/+$/, '');
}

module.exports = { DEVELOPMENT_DEFAULT_API_URL, isNonPublicHost, resolveApiBaseUrl };
