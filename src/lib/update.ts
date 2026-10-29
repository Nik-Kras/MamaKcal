/**
 * "Є нова версія": the app compares its own version with the latest GitHub release of this
 * (public) repo. The release's APK is always named MamaKcal.apk (README, Release builds).
 */

export const LATEST_RELEASE_API = "https://api.github.com/repos/Nik-Kras/MamaKcal/releases/latest";
export const LATEST_APK_URL = "https://github.com/Nik-Kras/MamaKcal/releases/latest/download/MamaKcal.apk";

/** "v1.2.0" or "1.2" → [1, 2, 0]; null when it isn't a version. */
export function parseVersion(v: string | null | undefined): number[] | null {
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec((v ?? "").trim());
  return m ? [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)] : null;
}

/** Is `latest` a newer version than `current`? Unreadable versions never count as newer. */
export function isNewer(latest: string | null | undefined, current: string | null | undefined): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

/** The release's version, if it ships the APK under the expected name. Untrusted JSON from the network. */
export function releaseVersion(json: unknown): string | null {
  const r = json as { tag_name?: unknown; assets?: { name?: unknown }[] } | null;
  if (!r || typeof r.tag_name !== "string" || !Array.isArray(r.assets)) return null;
  if (!r.assets.some((a) => a?.name === "MamaKcal.apk")) return null;
  return parseVersion(r.tag_name) ? r.tag_name : null;
}
