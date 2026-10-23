import { resolveApiBaseUrl } from '../resolveBaseUrl';

const appConfig = require('../../../app.config.js') as {
  configureExpoConfig: (
    config: Record<string, unknown>,
    environment: Record<string, string | undefined>
  ) => Record<string, unknown>;
  isReleaseBuild: (environment: Record<string, string | undefined>) => boolean;
};
const androidTrafficPlugin = require('../../../plugins/with-android-traffic-policy.js') as {
  applyGradlePolicy: (contents: string) => string;
};
const androidReleaseScript = require('../../../scripts/android-release.js') as {
  validateReleaseApiUrl: (value?: string) => string;
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

  test('EAS production marker requires a release API URL even without APP_ENV', () => {
    expect(() =>
      appConfig.configureExpoConfig(expoConfig, { EAS_BUILD_PROFILE: 'production' })
    ).toThrow(/EXPO_PUBLIC_API_BASE_URL/);
  });

  test('production JS bundling requires a release API URL without EAS markers', () => {
    expect(() =>
      appConfig.configureExpoConfig(expoConfig, { NODE_ENV: 'production' })
    ).toThrow(/EXPO_PUBLIC_API_BASE_URL/);
  });

  test('explicit development keeps localhost and LAN HTTP behavior', () => {
    expect(
      appConfig.configureExpoConfig(expoConfig, {
        APP_ENV: 'development',
        EAS_BUILD_PROFILE: 'development',
        EXPO_PUBLIC_API_BASE_URL: 'http://192.168.1.40:8000',
        NODE_ENV: 'production',
      })
    ).toBeDefined();
    expect(
      appConfig.isReleaseBuild({
        APP_ENV: 'development',
        EAS_BUILD_PROFILE: 'development',
        NODE_ENV: 'production',
      })
    ).toBe(false);
  });

  test('production NODE_ENV cannot be masked by APP_ENV development', () => {
    expect(appConfig.isReleaseBuild({ APP_ENV: 'development', NODE_ENV: 'production' })).toBe(
      true
    );
    expect(() =>
      appConfig.configureExpoConfig(expoConfig, {
        APP_ENV: 'development',
        NODE_ENV: 'production',
      })
    ).toThrow(/EXPO_PUBLIC_API_BASE_URL/);
  });

  test('production markers take precedence over conflicting development markers', () => {
    expect(appConfig.isReleaseBuild({ APP_ENV: 'development', EAS_BUILD_PROFILE: 'production' })).toBe(
      true
    );
    expect(appConfig.isReleaseBuild({ APP_ENV: 'production', EAS_BUILD_PROFILE: 'development' })).toBe(
      true
    );
    expect(() =>
      appConfig.configureExpoConfig(expoConfig, {
        APP_ENV: 'development',
        EAS_BUILD_PROFILE: 'production',
      })
    ).toThrow(/EXPO_PUBLIC_API_BASE_URL/);
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
    }) as {
      android: { package: string; versionCode: number; blockedPermissions: string[] };
    };

    expect(configured.android.package).toBe('com.ertugrulcetinkaya.weathertracker');
    expect(configured.android.versionCode).toBe(1);
    expect(configured.android.blockedPermissions).toEqual([
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.VIBRATE',
    ]);
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

  test('release configuration rejects IPv6 and special-use IPv4 literals', () => {
    expect(() => resolveApiBaseUrl('https://[fd00::1]', false)).toThrow(/public HTTPS host/);
    expect(() => resolveApiBaseUrl('https://[::ffff:7f00:1]', false)).toThrow(/public HTTPS host/);
    expect(() => resolveApiBaseUrl('https://100.64.0.1', false)).toThrow(/public HTTPS host/);
    expect(() => resolveApiBaseUrl('https://8.8.8.8', false)).toThrow(/public HTTPS host/);
    expect(resolveApiBaseUrl('https://fd.example.com', false)).toBe('https://fd.example.com');
  });

  test('direct Android release workflow requires a public HTTPS URL before prebuild', () => {
    expect(() => androidReleaseScript.validateReleaseApiUrl(undefined)).toThrow(
      /EXPO_PUBLIC_API_BASE_URL/
    );
    expect(() => androidReleaseScript.validateReleaseApiUrl('http://api.example.com')).toThrow(
      /HTTPS/
    );
    expect(androidReleaseScript.validateReleaseApiUrl('https://api.example.com')).toBe(
      'https://api.example.com'
    );
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

  test('all Android release tasks validate the public HTTPS URL without env markers', () => {
    const configured = androidTrafficPlugin.applyGradlePolicy(`android {
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
}`);

    expect(configured).toContain('verifyWeatherTrackerReleaseApiUrl');
    expect(configured).toContain('task.name.toLowerCase().contains("release")');
    expect(configured).toContain('require(\'./src/api/resolveBaseUrl\')');
    expect(configured).toContain('resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL, false)');
    expect(configured).toContain('task.dependsOn(weatherTrackerReleaseApiUrlValidation)');
    expect(configured).not.toContain('storePassword');
    expect(configured).not.toContain('keyAlias');
    expect(androidTrafficPlugin.applyGradlePolicy(configured)).toBe(configured);
  });

  test('EAS production keeps remote-managed signing and a production environment', () => {
    const easConfig = require('../../../eas.json') as {
      build: {
        production: {
          credentialsSource: string;
          environment: string;
          env: { APP_ENV: string; EXPO_PUBLIC_API_BASE_URL: string };
          android: { buildType: string };
          distribution: string;
        };
      };
    };

    expect(easConfig.build.production.credentialsSource).toBe('remote');
    expect(easConfig.build.production.environment).toBe('production');
    expect(easConfig.build.production.env.APP_ENV).toBe('production');
    expect(easConfig.build.production.env.EXPO_PUBLIC_API_BASE_URL).toBe(
      'https://weather-tracker-nine-delta.vercel.app'
    );
    expect(easConfig.build.production.distribution).toBe('internal');
    expect(easConfig.build.production.android.buildType).toBe('apk');
  });
});
