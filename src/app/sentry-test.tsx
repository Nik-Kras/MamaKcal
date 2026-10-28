/**
 * Not reachable from the app: open mamakcal://sentry-test (adb shell am start -d …) to
 * check that a crash reaches Sentry. The error is caught by the root ErrorBoundary.
 */
export default function SentryTest(): never {
  throw new Error("MamaKcal Sentry verification error");
}
