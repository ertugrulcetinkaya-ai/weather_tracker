import { resolveApiBaseUrl } from '../resolveBaseUrl';

const appConfig = require('../../../app.config.js') as {
  configureExpoConfig: (
    config: Record<string, unknown>,
    environment: Record<string, string | undefined>
  ) => Record<string, unknown>;
};
const androidTrafficPlugin = require('../../../plugins/with-android-traffic-policy.js') as {
  applyGradlePolicy: (contents: string) => string;
};
const expoConfig = require('../../../app.json').expo as Record<string, unknown>;

describe('API base URL configuration', () => {
  test('development defaults to the local backend', () => {
    expect(resolveApiBaseUrl(undefined, true)).toBe('http://127.0.0.1:8000');
  });

  test('development accepts a LAN HTTP endpoint', () => {
    expect(resolveApiBaseUrl(' http://192.168.1.40:8000/ ', true)).toBe(
      'http://192.168.1.40:8000'
    );
  });

  test('release configuration rejects a missing API URL', () => {
    expect(() =>
      appConfig.configureExpoConfig(expoConfig, { APP_ENV: 'production' })
    ).toThrow(/EXPO_PUBLIC_API_BASE_URL/);
  });

  test('release configuration rejects an HTTP API URL', () => {
    expect(() =>
      appConfig.configureExpoConfig(expoConfig, {
        APP_ENV: 'production',
        EXPO_PUBLIC_API_BASE_URL: 'http://api.example.com',
      })
    ).toThrow(/HTTPS/);
  });

  test('release configuration accepts HTTPS and retains the stable Android identity', () => {
    const configured = appConfig.configureExpoConfig(expoConfig, {
      APP_ENV: 'production',
      EXPO_PUBLIC_API_BASE_URL: 'https://api.example.com/',
    }) as { android: { package: string; versionCode: number } };

    expect(configured.android.package).toBe('com.ertugrulcetinkaya.weathertracker');
    expect(configured.android.versionCode).toBe(1);
  });

  test('release configuration rejects localhost even when it uses HTTPS', () => {
    expect(() =>
      appConfig.configureExpoConfig(expoConfig, {
        APP_ENV: 'production',
        EXPO_PUBLIC_API_BASE_URL: 'https://localhost:8000',
      })
    ).toThrow(/public HTTPS host/);
  });

  test('release configuration rejects a private LAN host even when it uses HTTPS', () => {
    expect(() => resolveApiBaseUrl('https://192.168.1.40', false)).toThrow(/public HTTPS host/);
  });

  test('release configuration rejects a private IPv6 host but accepts a matching DNS prefix', () => {
    expect(() => resolveApiBaseUrl('https://[fd00::1]', false)).toThrow(/public HTTPS host/);
    expect(resolveApiBaseUrl('https://fd.example.com', false)).toBe('https://fd.example.com');
  });

  test('API base URLs cannot include query strings or fragments', () => {
    expect(() => resolveApiBaseUrl('https://api.example.com?', false)).toThrow(/base URL/);
    expect(() => resolveApiBaseUrl('https://api.example.com/#fragment', false)).toThrow(
      /base URL/
    );
  });

  test('Android debug and release use separate signing and cleartext policies', () => {
    const gradle = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
        }
    }
}`;

    const configured = androidTrafficPlugin.applyGradlePolicy(gradle);

    expect(configured).toContain('signingConfig signingConfigs.debug');
    expect(configured).toContain('signingConfig signingConfigs.release');
    expect(configured).toContain(
      'manifestPlaceholders = [weatherTrackerUsesCleartextTraffic: "true"]'
    );
    expect(configured).toContain(
      'manifestPlaceholders = [weatherTrackerUsesCleartextTraffic: "false"]'
    );
    expect(androidTrafficPlugin.applyGradlePolicy(configured)).toBe(configured);
  });
});
