import { LiteRtLm } from "../../modules/litert-lm";
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
const TIMEOUT_MS = 120_000;

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
  if (modelReady()) LiteRtLm?.warmUp().catch(() => {});
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

  const requestId = ++requestSeq;
  const onAbort = () => native.cancel(requestId);
  signal.addEventListener("abort", onAbort);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const raw = await Promise.race([
      native.describe(requestId, photoUri.replace(/^file:\/\//, ""), PROMPT),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          native.cancel(requestId);
          reject(new RecognizeFailure("failed"));
        }, TIMEOUT_MS);
      }),
    ]);
    return toItems(raw, foods, matcher, makeKey);
  } catch (e) {
    if (e instanceof RecognizeFailure) throw e;
    console.warn("[MamaKcal] on-device model failed", e);
    throw new RecognizeFailure("failed");
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}
