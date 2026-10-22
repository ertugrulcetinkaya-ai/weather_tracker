const { spawnSync } = require('node:child_process');
const path = require('node:path');

const { resolveApiBaseUrl } = require('../src/api/resolveBaseUrl');

const mobileRoot = path.resolve(__dirname, '..');
const androidRoot = path.join(mobileRoot, 'android');

function validateReleaseApiUrl(value = process.env.EXPO_PUBLIC_API_BASE_URL) {
  return resolveApiBaseUrl(value, false);
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(result.error.message);
    return 1;
  }

  return result.status ?? 1;
}

function buildAndroidRelease() {
  try {
    validateReleaseApiUrl();
  } catch (error) {
    console.error(error.message);
    return 1;
  }

  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const prebuildStatus = run(npx, ['expo', 'prebuild', '--platform', 'android'], mobileRoot);
  if (prebuildStatus !== 0) return prebuildStatus;

  const gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
  return run(gradle, [':app:assembleRelease'], androidRoot);
}

if (require.main === module) {
  process.exitCode = buildAndroidRelease();
}

module.exports = { buildAndroidRelease, validateReleaseApiUrl };
