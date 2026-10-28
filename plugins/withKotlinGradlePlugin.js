// Pins the Kotlin Gradle plugin, i.e. the Kotlin compiler, to a given version.
// The template leaves `kotlin-gradle-plugin` without a version, so React Native's
// own catalog decides (2.1.20 in RN 0.81) and expo-build-properties' kotlinVersion
// only reaches Expo's bookkeeping, not the compiler. LiteRT-LM's Android library is
// built with Kotlin 2.3 and needs a 2.2+ compiler (decision D17).
const { withProjectBuildGradle } = require("expo/config-plugins");

module.exports = function withKotlinGradlePlugin(config, { version }) {
  return withProjectBuildGradle(config, (cfg) => {
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /classpath\(['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin(?::[^'"]*)?['"]\)/,
      `classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:${version}')`,
    );
    return cfg;
  });
};
