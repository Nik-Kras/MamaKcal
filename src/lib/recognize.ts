import { LiteRtLm } from "../../modules/litert-lm";
import { record, reportError, risky, span } from "../diag/diagnostics";
import type { Food } from "../types";
import type { Matcher } from "./match";
import { PROMPT, toItems, type Recognition } from "./recognition";

/**
 * Recognise a plate on the phone itself: Gemma 3n E2B via LiteRT-LM (see
 * modules/litert-lm and bench/). Nothing leaves the phone.
 */

export type RecognizeError = "nomodel" | "failed";

export class RecognizeFailure extends Error {
  constructor(public kind: RecognizeError) {
    super(kind);
  }
}

/** Generous: the first photo also loads the model (several seconds on a phone). */
const TIMEOUT_MS = 90_000;

/** Set once the model file failed to load this session: later photos fail at once instead of waiting for the timeout. */
let loadFailed = false;

function isLoadFailure(e: unknown): boolean {
  const x = e as { code?: unknown; message?: unknown } | null;
  return x?.code === "LOAD_FAILED" || (typeof x?.message === "string" && x.message.includes("LOAD_FAILED"));
}

function modelReady(): boolean {
  try {
    return !!LiteRtLm?.modelInfo().exists;
  } catch {
    return false;
  }
}

/** Without the model file, a development build answers with this sample so the flow can be tried. Checked per photo, so a model copied in later is used at once. */
export function isDemo(): boolean {
  return __DEV__ && !modelReady();
}
const DEMO = "Fried potatoes | 200g\nFried eggs | 100g\nPork chop | 150g\nCucumber | 100g\nMixed vegetables | 50g";

/** Load the model ahead of the first photo (call when the camera opens). Errors surface later, on use. */
export function warmUp(): void {
  const native = LiteRtLm;
  if (!native || !modelReady()) return;
  // Each camera visit tries the load again: a failure may have been memory pressure, not the file.
  loadFailed = false;
  void risky("model.load", () => span("model.load", "ai.load", () => native.warmUp())).catch((e) => {
    if (isLoadFailure(e)) loadFailed = true;
    reportError(e, "model.load");
  });
}

let keySeq = 0;
let requestSeq = 0;
const makeKey = () => `i${Date.now().toString(36)}${(keySeq++).toString(36)}`;

export async function recognizeMeal(photoUri: string, foods: Food[], matcher: Matcher, signal: AbortSignal): Promise<Recognition> {
  if (isDemo()) {
    await new Promise((r) => setTimeout(r, 1500));
    if (signal.aborted) throw new RecognizeFailure("failed");
    return toItems(DEMO, foods, matcher, makeKey);
  }
  const native = LiteRtLm;
  if (!native || !modelReady()) throw new RecognizeFailure("nomodel");

  if (loadFailed) throw new RecognizeFailure("failed");

  const requestId = ++requestSeq;
  const started = Date.now();
  const onAbort = () => native.cancel(requestId);
  signal.addEventListener("abort", onAbort);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const raw = await risky("model.describe", () =>
      span("model.describe", "ai.run", () =>
        Promise.race([
          native.describe(requestId, photoUri.replace(/^file:\/\//, ""), PROMPT),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              native.cancel(requestId);
              reject(new Error(`model.describe timed out after ${TIMEOUT_MS / 1000} s`));
            }, TIMEOUT_MS);
          }),
        ]),
      ),
    );
    const r = toItems(raw, foods, matcher, makeKey);
    // Counts only: the food names stay on the phone.
    record("model.describe.done", {
      ms: Date.now() - started,
      lines: r.items.length,
      unknown: r.items.filter((it) => it.unknown).length,
      food: r.isFood,
    });
    return r;
  } catch (e) {
    if (e instanceof RecognizeFailure) throw e;
    if (isLoadFailure(e)) loadFailed = true;
    if (signal.aborted) {
      record("model.describe.cancelled");
    } else {
      console.warn("[MamaKcal] on-device model failed", e);
      reportError(e, "model.describe", { ms: Date.now() - started });
    }
    throw new RecognizeFailure("failed");
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}
