import apiClient, { isRecord, isSuccessfulApiResponse } from "@/lib/api-client";

/**
 * The terminal keeps everything in localStorage for instant loads and offline
 * use, and mirrors it to the user's account so drawings, layouts, favourite
 * tools and templates follow them to other devices. Each key has a sidecar
 * timestamp: whichever side changed last wins when the two disagree.
 */
export const SYNC_KEYS = {
  settings: "chart:terminal:settings:v1",
  layouts: "chart:terminal:layouts:v1",
  templates: "chart:terminal:indicator-templates:v1",
  indicators: "chart:terminal:indicators",
  favorites: "chart:terminal:favorites:v1",
} as const;

export type SyncKey = keyof typeof SYNC_KEYS;

const SIDECAR_PREFIX = "chart:terminal:sync:";
const PUSH_DELAY_MS = 1_500;
const PULL_TIMEOUT_MS = 4_000;

export interface ServerEntry {
  readonly key: string;
  readonly payload: unknown;
  readonly updatedAt: string;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readSidecar(serverKey: string): string | null {
  return storage()?.getItem(SIDECAR_PREFIX + serverKey) ?? null;
}

function writeSidecar(serverKey: string, iso: string): void {
  try {
    storage()?.setItem(SIDECAR_PREFIX + serverKey, iso);
  } catch {
    // The timestamp is advisory; losing it only means the server copy wins once.
  }
}

export function drawingsServerKey(symbol: string): string {
  return `drawings:${symbol.toUpperCase()}`;
}

export async function fetchServerEntries(
  keys: readonly string[],
): Promise<ServerEntry[] | null> {
  try {
    const query =
      keys.length > 0 ? `?keys=${encodeURIComponent(keys.join(","))}` : "";
    const response = await apiClient.get<unknown>(`/api/chart-state${query}`, {
      timeout: PULL_TIMEOUT_MS,
    });
    const data = isSuccessfulApiResponse(response.data)
      ? response.data.data
      : null;
    if (!isRecord(data) || !Array.isArray(data.items)) return null;
    return data.items.filter(
      (item): item is ServerEntry =>
        isRecord(item) &&
        typeof item.key === "string" &&
        typeof item.updatedAt === "string" &&
        "payload" in item,
    );
  } catch {
    return null;
  }
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const pending = new Map<string, unknown>();
/** What the account is known to hold for each key, so identical saves are skipped. */
const known = new Map<string, string>();

/** Records that this browser now matches the account for a key. */
export function markSynced(
  serverKey: string,
  updatedAt: string,
  payload: unknown,
): void {
  writeSidecar(serverKey, updatedAt);
  try {
    known.set(serverKey, JSON.stringify(payload));
  } catch {
    // Unserialisable payloads are never pushed anyway.
  }
}

async function send(serverKey: string, payload: unknown): Promise<void> {
  try {
    const response = await apiClient.put<unknown>("/api/chart-state", {
      key: serverKey,
      payload,
    });
    // From now on this browser matches the account as of the server's clock,
    // so the next load does not mistake its own save for a newer remote one.
    const data = isSuccessfulApiResponse(response.data)
      ? response.data.data
      : null;
    const item = isRecord(data) && isRecord(data.item) ? data.item : null;
    if (item && typeof item.updatedAt === "string") {
      writeSidecar(serverKey, item.updatedAt);
    }
  } catch {
    // Offline or signed out: the local copy stays and the next change retries.
  }
}

/** Records a local change and mirrors it to the account shortly after. */
export function queuePush(serverKey: string, payload: unknown): void {
  let serialised: string;
  try {
    serialised = JSON.stringify(payload);
  } catch {
    return;
  }
  if (known.get(serverKey) === serialised) return;
  known.set(serverKey, serialised);
  writeSidecar(serverKey, new Date().toISOString());
  pending.set(serverKey, payload);
  const existing = timers.get(serverKey);
  if (existing) clearTimeout(existing);
  timers.set(
    serverKey,
    setTimeout(() => {
      timers.delete(serverKey);
      const value = pending.get(serverKey);
      pending.delete(serverKey);
      if (value !== undefined) void send(serverKey, value);
    }, PUSH_DELAY_MS),
  );
}

export async function removeFromServer(serverKey: string): Promise<void> {
  known.delete(serverKey);
  pending.delete(serverKey);
  const timer = timers.get(serverKey);
  if (timer) clearTimeout(timer);
  timers.delete(serverKey);
  try {
    await apiClient.delete("/api/chart-state", { data: { key: serverKey } });
  } catch {
    // Same as above: best effort.
  }
}

/** Sends anything still waiting, for when the tab is closed or hidden. */
export function flushPending(): void {
  for (const [serverKey, timer] of timers) {
    clearTimeout(timer);
    const value = pending.get(serverKey);
    if (value !== undefined) void send(serverKey, value);
  }
  timers.clear();
  pending.clear();
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPending();
  });
  window.addEventListener("pagehide", flushPending);
}

/**
 * Pulls the account's saved terminal state into localStorage before the
 * terminal first reads it. Resolves quietly when offline.
 */
export async function pullAccountState(): Promise<void> {
  const entries = await fetchServerEntries([]);
  const store = storage();
  if (!entries || !store) return;

  const byServerKey = new Map(entries.map((entry) => [entry.key, entry]));
  for (const [name, localKey] of Object.entries(SYNC_KEYS)) {
    const entry = byServerKey.get(name);
    const sidecar = readSidecar(name);
    const localRaw = store.getItem(localKey);
    if (entry && (!sidecar || entry.updatedAt > sidecar)) {
      try {
        store.setItem(localKey, JSON.stringify(entry.payload));
        markSynced(name, entry.updatedAt, entry.payload);
      } catch {
        // Storage full or blocked; the terminal will use defaults.
      }
    } else if (entry) {
      // This browser is as new as the account: remember its content so an
      // unchanged save on load does not rewrite the account copy.
      markSynced(name, sidecar ?? entry.updatedAt, entry.payload);
    } else if (!entry && localRaw) {
      // First run after this feature shipped: adopt what the browser already has.
      try {
        queuePush(name, JSON.parse(localRaw));
      } catch {
        // Corrupt local value; leave it alone.
      }
    }
  }
}

export interface DrawingsPull {
  readonly drawings: unknown;
  readonly updatedAt: string;
}

/** The account's drawings for a symbol if they are newer than this browser's copy. */
export async function pullDrawings(
  symbol: string,
): Promise<DrawingsPull | "none" | null> {
  const serverKey = drawingsServerKey(symbol);
  const entries = await fetchServerEntries([serverKey]);
  if (!entries) return null;
  const entry = entries.find((item) => item.key === serverKey);
  if (!entry) return "none";
  const sidecar = readSidecar(serverKey);
  if (sidecar && entry.updatedAt <= sidecar) {
    markSynced(serverKey, sidecar, entry.payload);
    return "none";
  }
  // The caller marks it synced once the drawings are actually applied.
  return { drawings: entry.payload, updatedAt: entry.updatedAt };
}
