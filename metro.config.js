// Sentry's Metro config: adds debug IDs to the bundle so release stack traces
// map back to the source maps uploaded at build time.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

module.exports = getSentryExpoConfig(__dirname);
