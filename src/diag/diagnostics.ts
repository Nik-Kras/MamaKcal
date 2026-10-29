import * as Sentry from "@sentry/react-native";
import * as SQLite from "expo-sqlite";
import { AppState } from "react-native";

import { LiteRtLm } from "../../modules/litert-lm";
import { createBlackBox, type Crumb, type KeyValue } from "./blackbox";

/**
 * Diagnostics, as in RHP and iMannequin: the black box (always on, stays on the phone) plus
 * Sentry crash reports. Reports carry technical data only: never photos, food names,
 * weights or anything else she typed. There is no switch: the app has no settings screen
 * (decision D18). Sentry reports from release builds only (the DSN is in .env.production).
 */

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

/** A tiny synchronous key/value table, so a black-box line is on disk before the next one runs. */
function diskKeyValue(): KeyValue {
  try {
    const db = SQLite.openDatabaseSync("diag.db");
    db.execSync("CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);");
    return {
      getItem: (key) => db.getFirstSync<{ value: string }>("SELECT value FROM kv WHERE key = ?;", [key])?.value ?? null,
      setItem: (key, value) => void db.runSync("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?);", [key, value]),
    };
  } catch {
    // Diagnostics must never break the app: fall back to memory.
    const m = new Map<string, string>();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
  }
}

export const blackbox = createBlackBox(diskKeyValue(), "mamakcal");
let enabled = false;
let started = false;

/** Whether Sentry is running (release builds with a DSN). */
export function sentryEnabled(): boolean {
  return enabled;
}

export function record(stage: string, data?: Crumb["d"]) {
  blackbox.record(stage, data);
  if (enabled) Sentry.addBreadcrumb({ category: "app", message: stage, data: data ?? undefined, level: "info" });
}

/** Risky steps in flight: the model can be loading (camera opened) while a photo waits for it. */
const risks: string[] = [];

/** Runs `fn` as a risky step: if Android kills the app inside it, the next launch reports it. */
export async function risky<T>(name: string, fn: () => Promise<T>): Promise<T> {
  risks.push(name);
  blackbox.beginRisk(name);
  record(`risk.begin ${name}`);
  try {
    return await fn();
  } finally {
    risks.splice(risks.lastIndexOf(name), 1);
    if (risks.length) blackbox.beginRisk(risks[risks.length - 1]);
    else blackbox.endRisk();
    record(`risk.end ${name}`);
  }
}

/** Times `fn` as a Sentry span (shows up under Performance: real model speed on her phone). */
export function span<T>(name: string, op: string, fn: () => Promise<T>): Promise<T> {
  return enabled ? Sentry.startSpan({ name, op }, fn) : fn();
}

/** A short technical description of an error, safe to log (our error messages never hold her data). */
export function describeError(err: unknown): { name: string; message: string } {
  const e = err as { name?: string; message?: string; code?: string };
  return { name: String(e?.code ?? e?.name ?? typeof err), message: String(e?.message ?? err).slice(0, 300) };
}

export function reportError(err: unknown, where: string, data?: Crumb["d"]) {
  const { name } = describeError(err);
  record(`error ${where}`, { ...describeError(err), ...data });
  // Every rejection from the model module has the same JS stack: split issues by step and
  // error code (LOAD_FAILED, DESCRIBE_FAILED, …) so different failures don't merge into one.
  if (enabled) Sentry.captureException(err, { tags: { where }, extra: data, fingerprint: ["{{ default }}", where, name] });
}

/** Breadcrumbs that could carry what's on her screen (tap targets are labelled with food names). */
function safeBreadcrumb(b: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
  const c = b.category ?? "";
  if (c === "touch" || c.startsWith("ui.")) return null;
  return b;
}

/**
 * The SDK copies every JS breadcrumb into the native scope and then merges both lists into
 * each event, so each one arrives twice, a few milliseconds apart. Keep the first copy (the
 * native copy's data can differ in key order, so compare category and message only).
 */
function dedupeBreadcrumbs(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  const seen = new Map<string, number>();
  event.breadcrumbs = event.breadcrumbs?.filter((b) => {
    const key = `${b.category}|${b.message}`;
    const t = b.timestamp ?? 0;
    const prev = seen.get(key);
    seen.set(key, t);
    return prev === undefined || t - prev > 1;
  });
  return event;
}

/**
 * Called once, before the first screen renders. Starts the black-box session, sets up Sentry
 * if there is a DSN, and reports the previous session if it was killed in the middle of
 * loading or running the photo model.
 */
export function startDiagnostics() {
  if (started) return;
  started = true;
  const { previous, previousLog, end } = blackbox.start();
  AppState.addEventListener("change", (s) => {
    blackbox.setVisible(s === "active");
    record(`app.${s}`);
  });

  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    environment: __DEV__ ? "development" : "production",
    // Nothing personal: no IP, no user details, no screenshots or view hierarchy (her
    // screen shows the meal photo and food names), no session replay.
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    // One user, so every trace is kept: app start and the photo-model spans.
    tracesSampleRate: 1.0,
    // No backend of ours: no trace headers on outgoing requests.
    tracePropagationTargets: [],
    beforeBreadcrumb: safeBreadcrumb,
    beforeSend: dedupeBreadcrumbs,
    initialScope: {
      // ip_address null: never send or infer her IP (and with it, her location).
      user: { id: blackbox.installId(), ip_address: null },
      tags: { session: `${blackbox.installId()}-${blackbox.session?.id ?? "????"}` },
    },
  });
  enabled = true;

  let modelBytes = 0;
  try {
    modelBytes = LiteRtLm?.modelInfo().bytes ?? 0;
  } catch {
    /* no native module (tests) */
  }
  Sentry.setTags({ model_installed: modelBytes > 0, native_model_module: !!LiteRtLm });
  record("app.start", { model_mb: Math.round(modelBytes / 1048576) });

  if (previous && end !== "clean") {
    const lastT = previousLog.length ? previousLog[previousLog.length - 1].t : null;
    const seconds = previous.riskSince && lastT ? Math.round((lastT - previous.riskSince) / 1000) : null;
    Sentry.captureEvent({
      level: end === "crash" ? "fatal" : "warning",
      message:
        end === "crash"
          ? `App was killed during ${previous.risk} (likely out of memory)`
          : `App was killed in the background during ${previous.risk}`,
      fingerprint: ["app-killed", end, previous.risk ?? "unknown"],
      tags: { risk: previous.risk ?? "unknown", previous_session: `${blackbox.installId()}-${previous.id}` },
      extra: { seconds_in_risky_step_at_last_log: seconds, last_log: previousLog.at(-1)?.s ?? null },
      breadcrumbs: previousLog.map((c) => ({ timestamp: c.t / 1000, category: "blackbox", message: c.s, data: c.d })),
    });
  }
}

export { Sentry };
