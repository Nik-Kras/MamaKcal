import * as FileSystem from "expo-file-system/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/**
 * Meal photos live under the app's document directory (not the cache), so they
 * survive restarts and updates. Only their file:// URIs go into the database.
 */
const PHOTO_DIR = (FileSystem.documentDirectory ?? "") + "photos/";

/** Long edge kept on the phone and shown to the model: enough to tell foods apart. */
const LONG_EDGE = 1280;

let seq = 0;

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(PHOTO_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
}

export interface PreparedPhoto {
  /** Permanent file:// URI of the resized JPEG; the on-device model reads this file. */
  uri: string;
}

/** Resize a camera or gallery image and store it. */
export async function preparePhoto(src: string, width: number, height: number): Promise<PreparedPhoto> {
  const landscape = width >= height;
  const big = Math.max(width, height) > LONG_EDGE;
  const ctx = ImageManipulator.manipulate(src);
  if (big) ctx.resize(landscape ? { width: LONG_EDGE, height: null } : { width: null, height: LONG_EDGE });
  const image = await ctx.renderAsync();
  const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });

  await ensureDir();
  const dest = `${PHOTO_DIR}m_${Date.now().toString(36)}_${(seq++).toString(36)}.jpg`;
  await FileSystem.moveAsync({ from: out.uri, to: dest });
  return { uri: dest };
}

/**
 * Delete stored photos that no meal uses (discarded drafts, deleted meals).
 * Run once at start-up, after a good load and before any new photo is taken.
 * Compares file names, not full URIs, so a change in how the folder path is
 * written can never make every photo look unused.
 */
export async function removeUnusedPhotos(usedUris: string[]): Promise<void> {
  try {
    const used = new Set(usedUris.map((u) => u.slice(u.lastIndexOf("/") + 1)));
    const info = await FileSystem.getInfoAsync(PHOTO_DIR);
    if (!info.exists) return;
    const names = await FileSystem.readDirectoryAsync(PHOTO_DIR);
    for (const name of names) {
      if (!used.has(name)) await FileSystem.deleteAsync(PHOTO_DIR + name, { idempotent: true });
    }
  } catch {
    /* tidy-up only; never block start-up */
  }
}
