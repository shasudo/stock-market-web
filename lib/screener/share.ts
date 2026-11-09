/** Scans in links, the clipboard, and this browser's saved-scan list. */
import { parseScan } from "./scan-schema";
import { cloneWithNewIds, type Scan, type ScanNode } from "./scan-types";

export function encodeScan(scan: Scan): string {
  const bytes = new TextEncoder().encode(JSON.stringify(scan));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeScan(encoded: string): Scan | null {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed = parseScan(JSON.parse(new TextDecoder().decode(bytes)));
    return parsed.ok ? parsed.scan : null;
  } catch {
    return null;
  }
}

/** A pasted share link, `?scan=` value, or raw scan JSON. */
export function scanFromPaste(text: string): Scan | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{")) {
    try {
      const parsed = parseScan(JSON.parse(trimmed));
      return parsed.ok ? parsed.scan : null;
    } catch {
      return null;
    }
  }
  const match = /[?&]scan=([A-Za-z0-9_-]+)/.exec(trimmed);
  return decodeScan(match ? match[1]! : trimmed);
}

const CLIPBOARD_PREFIX = "screener-nodes:";

export function nodesToClipboard(nodes: readonly ScanNode[]): string {
  return CLIPBOARD_PREFIX + JSON.stringify(nodes);
}

/** Nodes copied with the copy buttons, given fresh ids for pasting. */
export function nodesFromClipboard(text: string): ScanNode[] | null {
  if (!text.startsWith(CLIPBOARD_PREFIX)) return null;
  try {
    const nodes = JSON.parse(text.slice(CLIPBOARD_PREFIX.length)) as unknown;
    if (!Array.isArray(nodes)) return null;
    const probe = parseScan({
      version: 1,
      name: "",
      segment: "cash",
      root: { kind: "group", id: "probe", enabled: true, mode: "passes", match: "all", items: nodes },
      columns: [],
    });
    return probe.ok ? probe.scan.root.items.map((node) => cloneWithNewIds(node)) : null;
  } catch {
    return null;
  }
}

export interface SavedScan {
  readonly id: string;
  readonly name: string;
  readonly savedAt: string;
  readonly scan: Scan;
}

const SAVED_KEY = "charting.savedScans.v1";

export function loadSavedScans(): SavedScan[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(list)) return [];
    return list.flatMap((entry): SavedScan[] => {
      if (!entry || typeof entry !== "object") return [];
      const candidate = entry as { id?: unknown; name?: unknown; savedAt?: unknown; scan?: unknown };
      const parsed = parseScan(candidate.scan);
      if (!parsed.ok || typeof candidate.name !== "string" || typeof candidate.id !== "string") return [];
      return [{ id: candidate.id, name: candidate.name, savedAt: String(candidate.savedAt ?? ""), scan: parsed.scan }];
    });
  } catch {
    return [];
  }
}

export function storeSavedScans(scans: readonly SavedScan[]): boolean {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(scans));
    return true;
  } catch {
    return false;
  }
}
