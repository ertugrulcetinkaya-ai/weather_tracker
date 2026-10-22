const baseConfig = require('./app.json').expo;
const { resolveApiBaseUrl } = require('./src/api/resolveBaseUrl');

function isReleaseBuild(environment) {
  if (environment.APP_ENV === 'production' || environment.EAS_BUILD_PROFILE === 'production') {
    return true;
  }

  if (environment.EAS_BUILD_PROFILE === 'development') {
    return false;
  }

  if (environment.NODE_ENV === 'production') return true;

  if (environment.APP_ENV === 'development') return false;

  return false;
}

function configureExpoConfig(config = baseConfig, environment = process.env) {
  const releaseBuild = isReleaseBuild(environment);
  resolveApiBaseUrl(environment.EXPO_PUBLIC_API_BASE_URL, !releaseBuild);

  return {
    ...config,
    plugins: [...(config.plugins ?? []), './plugins/with-android-traffic-policy'],
  };
}

function expoConfig({ config }) {
  return configureExpoConfig(config, process.env);
}

expoConfig.configureExpoConfig = configureExpoConfig;
expoConfig.isReleaseBuild = isReleaseBuild;

module.exports = expoConfig;
