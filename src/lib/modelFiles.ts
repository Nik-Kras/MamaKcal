/**
 * Where the app downloads the photo model from: a release of this (public) repo, in two
 * parts because GitHub limits release files to 2 GiB. The parts are the unmodified
 * gemma-3n-E2B-it-int4.litertlm (google/gemma-3n-E2B-it-litert-lm), split in order.
 * Gemma is provided under and subject to the Gemma Terms of Use: ai.google.dev/gemma/terms
 */

const BASE = "https://github.com/Nik-Kras/MamaKcal/releases/download/model-gemma-3n-e2b-int4/";

export const MODEL_PARTS = [
  { url: `${BASE}gemma-3n-E2B-it-int4.litertlm.part1`, bytes: 1_992_294_400 },
  { url: `${BASE}gemma-3n-E2B-it-int4.litertlm.part2`, bytes: 1_663_533_056 },
];

export const MODEL_BYTES = MODEL_PARTS.reduce((s, p) => s + p.bytes, 0);

/** SHA-256 of the joined file; the phone checks it before using the model. */
export const MODEL_SHA256 = "2ed7bc3a0026c93d5b8a4544b352d9d00cd66ff0bac3ef6a20ac3d2cba4010d6";

/** Gigabytes with one decimal and a Ukrainian decimal comma: 3655827456 → "3,7". */
export function gb(bytes: number): string {
  return (Math.max(0, bytes) / 1e9).toFixed(1).replace(".", ",");
}

/** How far the download is, 0–1. */
export function downloadShare(done: number, total: number): number {
  return total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
}
