import * as Haptics from "expo-haptics";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import { FOODS } from "../data/foods";
import { record, reportError } from "../diag/diagnostics";
import { timeHM, todayISO, fmt } from "../lib/format";
import { activeCorrections, learnFromMeal, type Correction } from "../lib/learn";
import { Matcher } from "../lib/match";
import { cleanAmount, listNames, mealKcal, parseAmount } from "../lib/nutrition";
import { preparePhoto, removeUnusedPhotos, type PreparedPhoto } from "../lib/photo";
import { recognizeMeal, RecognizeFailure, type RecognizeError } from "../lib/recognize";
import type { Draft, Food, Meal, Settings } from "../types";
import { LiteRtLm } from "../../modules/litert-lm";
import { DEFAULT_SETTINGS, loadDraft, loadState, saveDraft, saveState, type PersistShape } from "./persistence";

interface Data {
  meals: Meal[];
  customFoods: Food[];
  settings: Settings;
  learned: Record<string, Correction>;
}

export type AnalysisStatus = "working" | "nofood" | RecognizeError | "done";

export interface Analysis {
  id: number;
  /** What to show while working: the stored photo once ready, else the camera file. */
  photo: string;
  status: AnalysisStatus;
  /** false when the photo itself couldn't be prepared: only manual entry is left. */
  canRetry: boolean;
}

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

interface Store {
  hydrated: boolean;
  /** Saved data exists but couldn't be read. Nothing is saved until a retry succeeds. */
  loadFailed: boolean;
  retryLoad: () => void;
  /** A draft left by a kill was restored at start-up; the layout reopens the review, then calls ackResumedDraft. */
  resumedDraft: boolean;
  ackResumedDraft: () => void;
  meals: Meal[];
  settings: Settings;
  /** Built-in foods plus the ones she added. */
  foods: Food[];
  /** Maps the photo model's food names onto the list, including her corrections. */
  matcher: Matcher;
  /** Foods she logged recently, newest first: offered first when she adds or swaps a food. */
  recentFoodIds: string[];

  draft: Draft | null;
  analysis: Analysis | null;
  toast: Toast | null;
  startAnalysis: (src: string, width: number, height: number) => void;
  retryAnalysis: () => void;
  cancelAnalysis: () => void;
  /** Leave recognition and type the meal in, keeping the photo. */
  draftFromAnalysis: () => void;
  startManual: () => void;
  openMeal: (id: string) => boolean;
  updateDraft: (fn: (d: Draft) => Draft) => void;
  /** Drop the draft, but only if it is still the one with this id. */
  clearDraft: (id: string) => void;
  /** Save the draft as a meal. Returns false if there was nothing to save. */
  logDraft: () => boolean;
  deleteDraftMeal: () => void;
  dismissToast: () => void;
  setNorm: (n: number) => void;
  addCustomFood: (name: string, kcal100: number) => Food;
}

const Ctx = createContext<Store | null>(null);

let idSeq = 0;
const newId = (p: string) => `${p}${Date.now().toString(36)}${(idSeq++).toString(36)}`;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [data, setData] = useState<Data>({ meals: [], customFoods: [], settings: DEFAULT_SETTINGS, learned: {} });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [resumedDraft, setResumedDraft] = useState(false);
  const ackResumedDraft = useCallback(() => setResumedDraft(false), []);

  const dataRef = useRef(data);
  dataRef.current = data;
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const foods = useMemo(() => [...data.customFoods, ...FOODS], [data.customFoods]);
  const foodsRef = useRef(foods);
  foodsRef.current = foods;
  const matcher = useMemo(() => new Matcher(foods, activeCorrections(data.learned)), [foods, data.learned]);
  const matcherRef = useRef(matcher);
  matcherRef.current = matcher;

  const recentFoodIds = useMemo(() => {
    const out: string[] = [];
    for (const m of [...data.meals].sort((a, b) => b.createdAt - a.createdAt)) {
      for (const it of m.items) if (it.foodId && !out.includes(it.foodId)) out.push(it.foodId);
      if (out.length >= 10) break;
    }
    return out.slice(0, 10);
  }, [data.meals]);

  // ---- load, then tidy photos nothing uses any more. Saving starts only after a
  // good load (or a new install): a failed load must never be saved over her data.
  const [loadFailed, setLoadFailed] = useState(false);
  const load = useCallback(async () => {
    setLoadFailed(false);
    const res = await loadState();
    if (res.kind === "failed") {
      reportError(new Error("Saved meals could not be read"), "store.load");
      setLoadFailed(true);
      return;
    }
    record("store.loaded", { kind: res.kind, meals: res.kind === "ok" ? res.data.meals.length : 0 });
    const meals = res.kind === "ok" ? res.data.meals : [];
    if (res.kind === "ok") {
      setData({ meals, customFoods: res.data.customFoods, settings: res.data.settings, learned: res.data.learned });
    }
    // A draft left by a kill (its meal, if it edited one, must still exist).
    const saved = await loadDraft();
    const restored = saved && (!saved.mealId || meals.some((m) => m.id === saved.mealId)) ? saved : null;
    if (restored) {
      setDraft(restored);
      setResumedDraft(true);
    }
    setHydrated(true);
    // After the first screen is up: tidying files must not hold it back.
    const used = meals.map((m) => m.photo).filter((p): p is string => !!p);
    if (restored?.photo) used.push(restored.photo);
    void removeUnusedPhotos(used);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  // ---- save: debounced after every change, and at once when the app goes to the background.
  // Saves run one after another and each writes the latest data, so they never interleave.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const flush = useCallback(() => {
    saveChain.current = saveChain.current.then(async () => {
      const d = dataRef.current;
      const shape: PersistShape = { v: 1, meals: d.meals, customFoods: d.customFoods, settings: d.settings, learned: d.learned };
      try {
        await saveState(shape);
      } catch (e) {
        try {
          await saveState(shape);
        } catch (e2) {
          console.error("[MamaKcal] save failed", e2 || e);
          reportError(e2 || e, "store.save");
        }
      }
      // Right after the meals: a logged meal and its cleared draft are written together, so
      // a kill can't leave the logged meal behind as a draft to log twice.
      await saveDraft(draftRef.current).catch((e) => reportError(e, "store.saveDraft"));
    });
    return saveChain.current;
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flush(), 300);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [hydrated, data, flush]);

  // The review draft has its own row, saved the same way (and removed when it is cleared or logged).
  const flushDraft = useCallback(() => {
    saveChain.current = saveChain.current.then(async () => {
      try {
        await saveDraft(draftRef.current);
      } catch (e) {
        reportError(e, "store.saveDraft");
      }
    });
    return saveChain.current;
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => void flushDraft(), 300);
    return () => clearTimeout(t);
  }, [hydrated, draft, flushDraft]);

  // Recognition running right now; the model is freed when it ends if the app is in the background by then.
  const analyzing = useRef(0);
  const unloadModel = useCallback(() => {
    if (!LiteRtLm || analyzing.current > 0) return;
    // 3.7 GB resident makes the app the first thing Android kills; it reloads on the next photo.
    LiteRtLm.unload().catch((e) => reportError(e, "model.unload"));
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active" || !hydrated) return;
      void flush();
      void flushDraft();
      if (s === "background") void saveChain.current.then(unloadModel);
    });
    return () => sub.remove();
  }, [hydrated, flush, flushDraft, unloadModel]);

  // ---- toast: one at a time, gone after 10 s (long enough to notice and reach Скасувати)
  const toastSeq = useRef(0);
  const showToast = useCallback((text: string, action?: Toast["action"]) => {
    setToast({ id: ++toastSeq.current, text, action });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast((cur) => (cur?.id === toast.id ? null : cur)), 10_000);
    return () => clearTimeout(t);
  }, [toast]);

  // ---- recognition
  const prepared = useRef<PreparedPhoto | null>(null);
  const run = useRef<{ id: number; abort: AbortController } | null>(null);
  const runSeq = useRef(0);

  const recognize = useCallback(async (id: number, abort: AbortController) => {
    const photo = prepared.current;
    if (!photo) return;
    analyzing.current++;
    try {
      const r = await recognizeMeal(photo.uri, foodsRef.current, matcherRef.current, abort.signal);
      if (run.current?.id !== id) return; // cancelled or superseded
      if (!r.isFood) {
        setAnalysis((a) => (a?.id === id ? { ...a, status: "nofood" } : a));
        return;
      }
      // Dirty from the start: Back must not silently throw the recognition away.
      setDraft({ id: newId("d"), photo: photo.uri, dishName: "", items: r.items, dirty: true });
      setAnalysis((a) => (a?.id === id ? { ...a, status: "done" } : a));
    } catch (e) {
      if (run.current?.id !== id) return;
      const kind: RecognizeError = e instanceof RecognizeFailure ? e.kind : "failed";
      setAnalysis((a) => (a?.id === id ? { ...a, status: kind } : a));
    } finally {
      analyzing.current--;
      if (AppState.currentState === "background") unloadModel();
    }
  }, [unloadModel]);

  const startAnalysis = useCallback(
    (src: string, width: number, height: number) => {
      run.current?.abort.abort();
      const id = ++runSeq.current;
      const abort = new AbortController();
      run.current = { id, abort };
      prepared.current = null;
      setDraft(null);
      setAnalysis({ id, photo: src, status: "working", canRetry: false });
      (async () => {
        let photo: PreparedPhoto;
        try {
          photo = await preparePhoto(src, width, height);
        } catch (e) {
          reportError(e, "photo.prepare", { width, height });
          if (run.current?.id === id) setAnalysis((a) => (a?.id === id ? { ...a, status: "failed" } : a));
          return;
        }
        // A slower, superseded run must not replace the current photo.
        if (run.current?.id !== id) return;
        prepared.current = photo;
        setAnalysis((a) => (a?.id === id ? { ...a, photo: photo.uri, canRetry: true } : a));
        await recognize(id, abort);
      })();
    },
    [recognize],
  );

  const retryAnalysis = useCallback(() => {
    const a = analysis;
    if (!a) return;
    if (!prepared.current) return; // photo itself failed: she retakes it from the camera
    run.current?.abort.abort();
    const id = ++runSeq.current;
    const abort = new AbortController();
    run.current = { id, abort };
    setAnalysis({ id, photo: a.photo, status: "working", canRetry: true });
    void recognize(id, abort);
  }, [analysis, recognize]);

  const cancelAnalysis = useCallback(() => {
    run.current?.abort.abort();
    run.current = null;
    setAnalysis(null);
  }, []);

  const draftFromAnalysis = useCallback(() => {
    run.current?.abort.abort();
    run.current = null;
    setDraft({ id: newId("d"), photo: prepared.current?.uri, dishName: "", items: [], dirty: false });
    setAnalysis(null);
  }, []);

  const startManual = useCallback(() => {
    setDraft({ id: newId("d"), dishName: "", items: [], dirty: false });
  }, []);

  // ---- editing
  const openMeal = useCallback((id: string) => {
    const m = dataRef.current.meals.find((x) => x.id === id);
    if (!m) return false;
    setToast(null);
    setDraft({
      id: newId("d"),
      mealId: m.id,
      photo: m.photo,
      dishName: m.dishName,
      items: m.items.map((it) => ({ ...it })),
      dirty: false,
    });
    return true;
  }, []);

  const updateDraft = useCallback((fn: (d: Draft) => Draft) => {
    setDraft((d) => (d ? { ...fn(d), dirty: true } : d));
  }, []);

  const clearDraft = useCallback((id: string) => setDraft((d) => (d?.id === id ? null : d)), []);

  const logging = useRef(false);
  const logDraft = useCallback(() => {
    const d = draftRef.current;
    if (!d || logging.current) return false;
    if (d.items.some((it) => it.unknown)) return false;
    const items = d.items
      .map((it) => ({ ...it, amount: cleanAmount(it.amount) }))
      .filter((it) => parseAmount(it.amount) > 0);
    if (!items.length) return false;
    logging.current = true;
    setTimeout(() => (logging.current = false), 800);

    const kcal = fmt(mealKcal(items));
    const meals = dataRef.current.meals;
    const before = d.mealId ? meals.find((m) => m.id === d.mealId) : undefined;

    if (before) {
      const after: Meal = { ...before, items, dishName: d.dishName || listNames(items) };
      setData((s) => ({ ...s, meals: s.meals.map((m) => (m.id === before.id ? after : m)) }));
      showToast(`Збережено: ${kcal}\u00A0ккал`, {
        label: "Скасувати",
        run: () => setData((s) => ({ ...s, meals: s.meals.map((m) => (m.id === before.id ? before : m)) })),
      });
    } else {
      const now = new Date();
      const meal: Meal = {
        id: newId("m"),
        date: todayISO(now),
        time: timeHM(now),
        dishName: d.dishName || listNames(items),
        photo: d.photo,
        items,
        createdAt: now.getTime(),
      };
      // What she corrected in this meal is remembered (and forgotten again by Скасувати).
      const learnedBefore = dataRef.current.learned;
      setData((s) => ({ ...s, meals: [...s.meals, meal], learned: learnFromMeal(s.learned, items) }));
      showToast(`Записано: ${kcal}\u00A0ккал`, {
        label: "Скасувати",
        run: () => setData((s) => ({ ...s, meals: s.meals.filter((m) => m.id !== meal.id), learned: learnedBefore })),
      });
    }
    setDraft(null);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    return true;
  }, [showToast]);

  const deleteDraftMeal = useCallback(() => {
    const d = draftRef.current;
    const meals = dataRef.current.meals;
    const index = d?.mealId ? meals.findIndex((m) => m.id === d.mealId) : -1;
    if (index < 0) return;
    const meal = meals[index];
    setData((s) => ({ ...s, meals: s.meals.filter((m) => m.id !== meal.id) }));
    setDraft(null);
    showToast("Запис видалено", {
      label: "Повернути",
      run: () =>
        setData((s) => {
          if (s.meals.some((m) => m.id === meal.id)) return s;
          const next = [...s.meals];
          next.splice(Math.min(index, next.length), 0, meal);
          return { ...s, meals: next };
        }),
    });
  }, [showToast]);

  const dismissToast = useCallback(() => setToast(null), []);



  const setNorm = useCallback((n: number) => {
    setData((s) => ({ ...s, settings: { ...s.settings, norm: n } }));
  }, []);

  const addCustomFood = useCallback((name: string, kcal100: number) => {
    const food: Food = { id: newId("f"), name, kcal100, custom: true };
    setData((s) => ({ ...s, customFoods: [food, ...s.customFoods] }));
    return food;
  }, []);

  const value: Store = {
    hydrated,
    loadFailed,
    retryLoad: () => void load(),
    resumedDraft,
    ackResumedDraft,
    meals: data.meals,
    settings: data.settings,
    foods,
    matcher,
    recentFoodIds,
    draft,
    analysis,
    toast,
    startAnalysis,
    retryAnalysis,
    cancelAnalysis,
    draftFromAnalysis,
    startManual,
    openMeal,
    updateDraft,
    clearDraft,
    logDraft,
    deleteDraftMeal,
    dismissToast,
    setNorm,
    addCustomFood,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}

/** Today's date, refreshed when the app comes back to the foreground and every minute. */
export function useToday(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow((prev) => (todayISO(prev) === todayISO() ? prev : new Date()));
    const sub = AppState.addEventListener("change", (s) => s === "active" && tick());
    const timer = setInterval(tick, 60_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);
  return now;
}
