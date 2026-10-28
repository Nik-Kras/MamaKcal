/**
 * A flight recorder for deaths no error handler can see (ported from RHP). When Android runs
 * out of memory it kills the app's process outright, so nothing is reported at the moment of
 * death. Instead:
 *  - every step worth knowing is appended to a small log on disk, which survives the kill;
 *  - risky work (loading or running the photo model) is wrapped in begin/endRisk;
 *  - on the next start, a session that ended inside a risky step is reported as a crash,
 *    together with its log.
 * Only technical data goes in here: never food names, weights or anything personal.
 */

export interface Crumb {
  t: number; // epoch ms
  s: string; // stage, e.g. "reader.download"
  d?: Record<string, string | number | boolean | null>;
}

export interface Session {
  id: string;
  started: number;
  version: string;
  risk: string | null;
  riskSince: number | null;
  visible: boolean;
}

export type PreviousEnd = "clean" | "crash" | "killed-in-background";

const LOG = "mamakcal-bb-log";
const SESSION = "mamakcal-bb-session";
const INSTALL = "mamakcal-install-id";
const MAX_CRUMBS = 80;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I: easy to read out loud
export function shortId(n: number, random: () => number = Math.random): string {
  let s = "";
  for (let i = 0; i < n; i++) s += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return s;
}

/** How the previous session ended. A risky step still open means the page was killed in it. */
export function classifyPrevious(prev: Session | null): PreviousEnd {
  if (!prev?.risk) return "clean";
  return prev.visible ? "crash" : "killed-in-background";
}

/** The two calls the recorder needs; synchronous, so a step is on disk before the next line runs. */
export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createBlackBox(storage: KeyValue, version: string, now: () => number = Date.now) {
  const read = <T>(key: string, fallback: T): T => {
    try {
      const v = storage.getItem(key);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  };
  const write = (key: string, value: unknown) => {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or blocked: diagnostics must never break the app */
    }
  };

  let session: Session | null = null;
  const save = () => session && write(SESSION, session);

  return {
    installId(): string {
      let id = storage.getItem(INSTALL);
      if (!id) {
        id = shortId(4);
        storage.setItem(INSTALL, id);
      }
      return id;
    },

    /** Starts a new session and hands back how the previous one ended, with its log. */
    start(): { previous: Session | null; previousLog: Crumb[]; end: PreviousEnd } {
      const previous = read<Session | null>(SESSION, null);
      const previousLog = read<Crumb[]>(LOG, []);
      session = { id: shortId(4), started: now(), version, risk: null, riskSince: null, visible: true };
      save();
      write(LOG, []);
      return { previous, previousLog, end: classifyPrevious(previous) };
    },

    get session(): Session | null {
      return session;
    },

    record(s: string, d?: Crumb["d"]) {
      const log = read<Crumb[]>(LOG, []);
      log.push(d ? { t: now(), s, d } : { t: now(), s });
      write(LOG, log.slice(-MAX_CRUMBS));
    },

    log(): Crumb[] {
      return read<Crumb[]>(LOG, []);
    },

    beginRisk(name: string) {
      if (!session) return;
      session.risk = name;
      session.riskSince = now();
      save();
    },

    endRisk() {
      if (!session) return;
      session.risk = null;
      session.riskSince = null;
      save();
    },

    setVisible(visible: boolean) {
      if (!session || session.visible === visible) return;
      session.visible = visible;
      save();
    },
  };
}

export type BlackBox = ReturnType<typeof createBlackBox>;
