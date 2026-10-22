const { withAndroidManifest, withAppBuildGradle } = require('expo/config-plugins');

const CLEAR_TEXT_PLACEHOLDER = '${weatherTrackerUsesCleartextTraffic}';
const RELEASE_API_URL_VALIDATION_TASK = 'verifyWeatherTrackerReleaseApiUrl';

const RELEASE_API_URL_VALIDATION = `
// Weather Tracker release artifacts require a public HTTPS API URL.
def weatherTrackerReleaseApiUrlValidation = tasks.register("${RELEASE_API_URL_VALIDATION_TASK}") {
    doLast {
        def validation = new ProcessBuilder(
            "node",
            "-e",
            "require('./src/api/resolveBaseUrl').resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL, false)"
        ).directory(rootProject.projectDir.parentFile).inheritIO().start()
        if (validation.waitFor() != 0) {
            throw new GradleException("Release builds require EXPO_PUBLIC_API_BASE_URL to be a valid public HTTPS URL.")
        }
    }
}
tasks.configureEach { task ->
    if (task.name != "${RELEASE_API_URL_VALIDATION_TASK}" && task.name.toLowerCase().contains("release")) {
        task.dependsOn(weatherTrackerReleaseApiUrlValidation)
    }
}
`.trim();

function findBlock(lines, name, start = 0, end = lines.length) {
  const blockLine = new RegExp(`^([\\t ]*)${name}\\s*\\{[\\t ]*$`);
  for (let index = start; index < end; index += 1) {
    const match = lines[index].match(blockLine);
    if (!match) continue;

    const indent = match[1];
    const closingLine = `${indent}}`;
    for (let closing = index + 1; closing < end; closing += 1) {
      if (lines[closing] === closingLine) {
        return { start: index, end: closing, indent };
      }
    }
    throw new Error(`Could not find the end of the Android ${name} Gradle block.`);
  }
  return null;
}

function updateNestedBlock(contents, parentName, childName, update) {
  const lines = contents.split('\n');
  const parent = findBlock(lines, parentName);
  if (!parent) throw new Error(`Could not find the Android ${parentName} Gradle block.`);

  const child = findBlock(lines, childName, parent.start + 1, parent.end);
  if (!child) throw new Error(`Could not find the Android ${childName} build type.`);

  const updated = update(lines.slice(child.start + 1, child.end), child.indent);
  lines.splice(child.start + 1, child.end - child.start - 1, ...updated);
  return lines.join('\n');
}

function applyGradlePolicy(contents) {
  let updated = updateNestedBlock(contents, 'android', 'signingConfigs', (lines, indent) => {
    if (findBlock(lines, 'release')) return lines;
    return [...lines, `${indent}    release {`, `${indent}    }`];
  });

  updated = updateNestedBlock(updated, 'android', 'buildTypes', (lines, indent) => {
    for (const [name, value] of [
      ['debug', 'true'],
      ['release', 'false'],
    ]) {
      const nested = findBlock(lines, name);
      if (!nested) throw new Error(`Could not find the Android ${name} build type.`);
      const blockLines = lines.slice(nested.start + 1, nested.end);
      const assignment = `manifestPlaceholders = [weatherTrackerUsesCleartextTraffic: "${value}"]`;
      if (!blockLines.includes(`${nested.indent}    ${assignment}`)) {
        lines.splice(nested.end, 0, `${nested.indent}    ${assignment}`);
      }
    }
    return lines;
  });

  updated = updateNestedBlock(updated, 'android', 'buildTypes', (lines) => {
    for (const [name, signingConfig] of [
      ['debug', 'debug'],
      ['release', 'release'],
    ]) {
      const block = findBlock(lines, name);
      if (!block) throw new Error(`Could not find the Android ${name} build type.`);
      const configLine = `signingConfig signingConfigs.${signingConfig}`;
      const signingLine = new RegExp('^\\s*signingConfig\\s+signingConfigs\\.\\w+\\s*$');
      const matchingIndex = lines.findIndex(
        (line, index) => index > block.start && index < block.end && signingLine.test(line)
      );
      if (matchingIndex >= 0) {
        lines[matchingIndex] = `${block.indent}    ${configLine}`;
      } else {
        lines.splice(block.end, 0, `${block.indent}    ${configLine}`);
      }
    }
    return lines;
  });

  if (!updated.includes(RELEASE_API_URL_VALIDATION_TASK)) {
    updated = `${updated.trimEnd()}\n\n${RELEASE_API_URL_VALIDATION}\n`;
  }

  return updated;
}

module.exports = function withAndroidTrafficPolicy(config) {
  config = withAndroidManifest(config, (modConfig) => {
    const application = modConfig.modResults.manifest.application?.[0];
    if (!application) throw new Error('Android manifest is missing the application element.');
    application.$['android:usesCleartextTraffic'] = CLEAR_TEXT_PLACEHOLDER;
    return modConfig;
  });

  config = withAppBuildGradle(config, (modConfig) => {
    modConfig.modResults.contents = applyGradlePolicy(modConfig.modResults.contents);
    return modConfig;
  });

  return config;
};

module.exports.applyGradlePolicy = applyGradlePolicy;
