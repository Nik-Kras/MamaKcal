import * as SQLite from "expo-sqlite";

import type { Correction } from "../lib/learn";
import type { Food, Meal, Settings } from "../types";

/** What is saved on the phone. Screen state is not. */
export interface PersistShape {
  v: 1;
  meals: Meal[];
  customFoods: Food[];
  settings: Settings;
  /** Her corrections: the photo model's name for a food (nameKey) → the food she picked, and how often. */
  learned: Record<string, Correction>;
}

export const DEFAULT_SETTINGS: Settings = { norm: 1800 };

const DB_NAME = "mamakcal.db";
const K_STATE = "state";
const K_BACKUP = "state_backup";
const K_CORRUPT = "state_corrupt";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** A WAL-mode SQLite key/value table: atomic writes that survive a crash or kill. */
function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync("PRAGMA journal_mode = WAL;");
      await db.execAsync("CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);");
      return db;
    })();
  }
  return dbPromise;
}

async function readRow(db: SQLite.SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM kv WHERE key = ?;", [key]);
  return row ? row.value : null;
}

function parseShape(raw: string | null): PersistShape | null {
  if (!raw) return null;
  const data = JSON.parse(raw) as Partial<PersistShape>;
  if (!data || typeof data !== "object" || !Array.isArray(data.meals)) return null;
  return {
    v: 1,
    meals: data.meals,
    customFoods: Array.isArray(data.customFoods) ? data.customFoods : [],
    settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
    learned: data.learned && typeof data.learned === "object" ? data.learned : {},
  };
}

export type LoadResult =
  | { kind: "fresh" } // nothing saved yet: a new install
  | { kind: "ok"; data: PersistShape }
  | { kind: "failed" }; // something is saved but can't be read: never overwrite it

/**
 * Load saved data: the latest copy, else the previous good copy if the latest is
 * unreadable (the bad copy is kept aside). A read error or two bad copies is
 * "failed", which the caller must not treat as an empty install.
 */
export async function loadState(): Promise<LoadResult> {
  try {
    const db = await getDb();
    const current = await readRow(db, K_STATE);
    const backup = await readRow(db, K_BACKUP);
    if (current == null && backup == null) return { kind: "fresh" };
    try {
      const parsed = parseShape(current);
      if (parsed) return { kind: "ok", data: parsed };
    } catch {
      /* fall through to the backup */
    }
    if (current != null) {
      try {
        await db.runAsync("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?);", [K_CORRUPT, current]);
      } catch {
        /* best effort */
      }
    }
    try {
      const parsed = parseShape(backup);
      if (parsed) return { kind: "ok", data: parsed };
    } catch {
      /* both copies bad */
    }
    return { kind: "failed" };
  } catch {
    return { kind: "failed" };
  }
}

/** Save atomically, rotating the previous copy into the backup row first. Throws on failure. */
export async function saveState(data: PersistShape): Promise<void> {
  const db = await getDb();
  const value = JSON.stringify(data);
  await db.withTransactionAsync(async () => {
    const prev = await readRow(db, K_STATE);
    if (prev != null) {
      await db.runAsync("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?);", [K_BACKUP, prev]);
    }
    await db.runAsync("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?);", [K_STATE, value]);
  });
}
