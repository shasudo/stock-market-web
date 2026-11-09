"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  BellRing,
  BookOpen,
  FilePlus2,
  FileText,
  History,
  Link2,
  Loader2,
  Play,
  Save,
  Sparkles,
} from "lucide-react";
import apiClient, { getAxiosErrorMessage, isSuccessfulApiResponse } from "@/lib/api-client";
import { getMeasure } from "@/lib/screener/catalog";
import { explainScan, scanText } from "@/lib/screener/format";
import type { BacktestResult, DebugCount, ScanResultRow, ScanRunResult } from "@/lib/screener/runner";
import { appendToGroup, countFilters, duplicateNode, moveNode, removeNode, updateNode } from "@/lib/screener/scan-edit";
import {
  emptyScan,
  newId,
  type Arg,
  type Clause,
  type Expr,
  type Group,
  type ResultColumn,
  type Scan,
  type ScanNode,
  type Term,
  type TimeframeUnit,
} from "@/lib/screener/scan-types";
import {
  decodeScan,
  encodeScan,
  loadSavedScans,
  nodesFromClipboard,
  nodesToClipboard,
  storeSavedScans,
  type SavedScan,
} from "@/lib/screener/share";
import { cn } from "@/lib/utils";
import { BacktestPanel } from "./BacktestPanel";
import { ScanActionsContext } from "./ClauseEditor";
import { FilterGroupView, type GroupActions } from "./FilterGroupView";
import { MagicFilters } from "./MagicFilters";
import { Popover } from "./Popover";
import { DEFAULT_TABLE_SETTINGS, ResultsTable, type TableSettings } from "./ResultsTable";
import { ScanLibrary } from "./ScanLibrary";

const DRAFT_KEY = "charting.draft.v1";
const SETTINGS_KEY = "charting.tableSettings.v1";
const ALERT_INTERVALS = [1, 5, 15, 30];

function readStorage<T>(key: string, parse: (value: unknown) => T | null): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? parse(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or full storage: the page works without it.
  }
}

function mapTimeframes(group: Group, timeframe: TimeframeUnit): Group {
  const term = (value: Term): Term => {
    if (value.kind !== "measure") return value;
    const def = getMeasure(value.measure);
    return {
      ...value,
      timeframe: def?.timeframed && def.category !== "Math functions" ? timeframe : value.timeframe,
      args: value.args.map((arg): Arg => {
        if (arg.kind === "expr") return { kind: "expr", expr: expr(arg.expr) };
        if (arg.kind === "filter") return { kind: "filter", clause: clause(arg.clause) };
        return arg;
      }),
    };
  };
  const expr = (value: Expr): Expr => ({ ...value, terms: value.terms.map(term) });
  const clause = (value: Clause): Clause => ({
    ...value,
    left: expr(value.left),
    right: value.right ? expr(value.right) : null,
  });
  const node = (value: ScanNode): ScanNode =>
    value.kind === "clause" ? clause(value) : { ...value, items: value.items.map(node) };
  return node(group) as Group;
}

async function callScreener<T>(action: "run" | "debug" | "backtest", scan: Scan, sessions?: number): Promise<T> {
  const response = await apiClient.post<unknown>(
    "/api/screener",
    { action, scan, sessions },
    { timeout: 120_000 },
  );
  if (!isSuccessfulApiResponse(response.data)) throw new Error("The screener returned an unexpected response.");
  return response.data.data as T;
}

function initialScan(): Scan {
  if (typeof window === "undefined") return emptyScan();
  const fromUrl = new URLSearchParams(window.location.search).get("scan");
  const shared = fromUrl ? decodeScan(fromUrl) : null;
  if (shared) return shared;
  return readStorage(DRAFT_KEY, (value) => (typeof value === "string" ? decodeScan(value) : null)) ?? emptyScan();
}

function initialSettings(): TableSettings {
  if (typeof window === "undefined") return DEFAULT_TABLE_SETTINGS;
  return (
    readStorage<TableSettings>(SETTINGS_KEY, (value) =>
      value && typeof value === "object" ? { ...DEFAULT_TABLE_SETTINGS, ...(value as Partial<TableSettings>) } : null,
    ) ?? DEFAULT_TABLE_SETTINGS
  );
}

export function ChartinkScreener() {
  // Rendered only on the client: AuthGuard shows a spinner until the auth
  // store hydrates, so reading the URL and storage here is safe.
  const [scan, setScan] = useState<Scan>(initialScan);
  const [result, setResult] = useState<ScanRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [debug, setDebug] = useState<{ root: Group; segment: string; counts: Record<string, DebugCount> } | null>(null);
  const [debugging, setDebugging] = useState(false);
  const [backtest, setBacktest] = useState<BacktestResult | null>(null);
  const [backtestOpen, setBacktestOpen] = useState(false);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [sessions, setSessions] = useState(21);
  const [saved, setSaved] = useState<SavedScan[]>(() => (typeof window === "undefined" ? [] : loadSavedScans()));
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [explainOpen, setExplainOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alert, setAlert] = useState<{ enabled: boolean; minutes: number }>({ enabled: false, minutes: 5 });
  const [settings, setSettings] = useState<TableSettings>(initialSettings);
  const clipboardFallback = useRef<string | null>(null);
  const alertSymbols = useRef<Set<string> | null>(null);
  const scanRef = useRef(scan);

  useEffect(() => {
    scanRef.current = scan;
    writeStorage(DRAFT_KEY, encodeScan(scan));
  }, [scan]);

  useEffect(() => {
    writeStorage(SETTINGS_KEY, settings);
  }, [settings]);

  // A shared link has been loaded into the draft; drop it from the address bar.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("scan")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  // Debug counts describe the exact filters they were computed for.
  const debugCounts = debug && debug.root === scan.root && debug.segment === scan.segment ? debug.counts : null;

  /* ----------------------------------------------------------------- run */

  const run = useCallback(async (target: Scan = scanRef.current, quiet = false): Promise<ScanResultRow[] | null> => {
    setRunning(true);
    setRunError(null);
    try {
      const data = await callScreener<ScanRunResult>("run", target);
      setResult(data);
      if (!quiet) toast.success(`Scan results updated · ${data.rows.length} stocks`);
      return [...data.rows];
    } catch (error) {
      const message = getAxiosErrorMessage(error, error instanceof Error ? error.message : "The scan could not be run.");
      setRunError(message);
      if (!quiet) toast.error(message);
      return null;
    } finally {
      setRunning(false);
    }
  }, []);

  const runDebug = useCallback(async (): Promise<void> => {
    setDebugging(true);
    const target = scanRef.current;
    try {
      const data = await callScreener<{ counts: Record<string, DebugCount> }>("debug", target);
      setDebug({ root: target.root, segment: target.segment, counts: data.counts });
    } catch (error) {
      toast.error(getAxiosErrorMessage(error, "Debug failed."));
    } finally {
      setDebugging(false);
    }
  }, []);

  const runBacktest = useCallback(async (count: number): Promise<void> => {
    setBacktestOpen(true);
    setBacktestLoading(true);
    try {
      setBacktest(await callScreener<BacktestResult>("backtest", scanRef.current, count));
    } catch (error) {
      toast.error(getAxiosErrorMessage(error, "Backtest failed."));
    } finally {
      setBacktestLoading(false);
    }
  }, []);

  /* ------------------------------------------------------- auto refresh */

  useEffect(() => {
    if (!settings.autoRefresh) return;
    const timer = setInterval(() => void run(scanRef.current, true), 60_000);
    return () => clearInterval(timer);
  }, [settings.autoRefresh, run]);

  useEffect(() => {
    if (!alert.enabled) {
      alertSymbols.current = null;
      return;
    }
    const check = async (): Promise<void> => {
      const rows = await run(scanRef.current, true);
      if (!rows) return;
      const symbols = new Set(rows.map((row) => row.symbol));
      const previous = alertSymbols.current;
      alertSymbols.current = symbols;
      if (!previous) return;
      const entered = [...symbols].filter((symbol) => !previous.has(symbol));
      if (entered.length === 0) return;
      const title = `${scanRef.current.name || "Scan"}: ${entered.length} new stock${entered.length === 1 ? "" : "s"}`;
      const body = entered.slice(0, 12).join(", ");
      toast(`${title}\n${body}`, { icon: "🔔", duration: 10_000 });
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(title, { body });
      }
    };
    void check();
    const timer = setInterval(() => void check(), alert.minutes * 60_000);
    return () => clearInterval(timer);
  }, [alert, run]);

  /* --------------------------------------------------------- tree edits */

  const setRoot = useCallback((update: (root: Group) => Group) => {
    setScan((current) => ({ ...current, root: update(current.root) }));
  }, []);

  const copyText = async (text: string, success: string): Promise<void> => {
    clipboardFallback.current = text;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(success);
    } catch {
      toast.success(`${success} (kept in this tab)`);
    }
  };

  const actions: GroupActions = useMemo(
    () => ({
      update: (id, update) => setRoot((root) => updateNode(root, id, update)),
      remove: (id) => setRoot((root) => removeNode(root, id)),
      duplicate: (id) => setRoot((root) => duplicateNode(root, id)),
      move: (id, direction) => setRoot((root) => moveNode(root, id, direction)),
      append: (groupId, nodes) => setRoot((root) => appendToGroup(root, groupId, nodes)),
      copy: (node) => void copyText(nodesToClipboard(node.kind === "group" ? node.items : [node]), "Copied to clipboard"),
      paste: async (groupId) => {
        let text = clipboardFallback.current ?? "";
        try {
          const fromClipboard = await navigator.clipboard.readText();
          if (fromClipboard) text = fromClipboard;
        } catch {
          // Clipboard read needs permission; fall back to what this tab copied.
        }
        const nodes = nodesFromClipboard(text) ?? (text === clipboardFallback.current ? null : nodesFromClipboard(clipboardFallback.current ?? ""));
        if (!nodes || nodes.length === 0) {
          toast.error("Nothing to paste. Copy a filter or group first.");
          return;
        }
        setRoot((root) => appendToGroup(root, groupId, nodes));
        toast.success(`Pasted ${nodes.length} filter${nodes.length === 1 ? "" : "s"}`);
      },
      debug: () => void runDebug(),
      browse: () => setLibraryOpen(true),
    }),
    [setRoot, runDebug],
  );

  const scanActions = useMemo(
    () => ({
      switchAllTimeframes: (timeframe: TimeframeUnit) => setRoot((root) => mapTimeframes(root, timeframe)),
    }),
    [setRoot],
  );

  const loadScan = (next: Scan): void => {
    setScan(next);
    setLibraryOpen(false);
    setBacktest(null);
    void run(next);
  };

  const saveScan = (): void => {
    const name = saveName.trim();
    if (!name) return;
    const named = { ...scan, name };
    const existing = saved.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
    const entry: SavedScan = { id: existing?.id ?? newId("s"), name, savedAt: new Date().toISOString(), scan: named };
    const next = [entry, ...saved.filter((item) => item.id !== entry.id)];
    if (storeSavedScans(next)) {
      setSaved(next);
      setScan(named);
      setSaveOpen(false);
      toast.success(existing ? `Updated “${name}”` : `Saved “${name}”`);
    } else {
      toast.error("This browser blocked saving. Copy the share link instead.");
    }
  };

  const shareLink = (): void => {
    const url = `${window.location.origin}${window.location.pathname}?scan=${encodeScan(scan)}`;
    void copyText(url, "Share link copied");
  };

  const filterCount = countFilters(scan.root);

  return (
    <ScanActionsContext.Provider value={scanActions}>
      <div className="flex w-full flex-col gap-4 px-4 lg:px-8 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-foreground">Stock Screener</h1>
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">
              Build technical and fundamental scans on daily, weekly and monthly candles across NSE and BSE.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted"
            >
              <BookOpen className="h-3.5 w-3.5" /> Scan examples
            </button>
            <button
              type="button"
              onClick={shareLink}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted"
            >
              <Link2 className="h-3.5 w-3.5" /> Share
            </button>
            <button
              type="button"
              onClick={() => {
                setScan(emptyScan(scan.segment));
                setResult(null);
                setBacktest(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted"
            >
              <FilePlus2 className="h-3.5 w-3.5" /> New scan
            </button>
          </div>
        </div>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <input
            value={scan.name}
            onChange={(event) => setScan({ ...scan, name: event.target.value })}
            placeholder="Untitled scan"
            className="mb-3 w-full max-w-md bg-transparent text-sm font-extrabold uppercase tracking-wide text-foreground outline-none placeholder:text-muted-foreground"
          />
          <MagicFilters
            onApply={(clauses, mode) =>
              setRoot((root) => (mode === "replace" ? { ...root, items: clauses } : { ...root, items: [...root.items, ...clauses] }))
            }
          />

          <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3">
            <FilterGroupView
              group={scan.root}
              actions={actions}
              debugCounts={debugCounts}
              segment={scan.segment}
              onSegmentChange={(segment) => setScan({ ...scan, segment })}
            />
            {filterCount === 0 && (
              <p className="mt-2 pl-2 text-xs text-muted-foreground">
                No filters yet — every stock in the segment passes. Add one with <b>+</b>, type a magic filter, or
                browse scan examples.
              </p>
            )}
            {debugging && (
              <p className="mt-2 flex items-center gap-1.5 pl-2 text-xs font-semibold text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking each filter against the segment…
              </p>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void run()}
              disabled={running}
              className="inline-flex items-center gap-1.5 rounded-xl border border-success/30 bg-success/10 px-4 py-2 text-sm font-bold text-success hover:bg-success/20 disabled:opacity-60"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run Scan
            </button>
            <Popover
              open={saveOpen}
              onClose={() => setSaveOpen(false)}
              className="w-[260px] p-3"
              trigger={
                <button
                  type="button"
                  onClick={() => {
                    setSaveName(scan.name);
                    setSaveOpen((value) => !value);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-info/30 bg-info/10 px-4 py-2 text-sm font-bold text-info hover:bg-info/10"
                >
                  <Save className="h-4 w-4" /> Save Scan
                </button>
              }
            >
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Scan name</label>
              <input
                autoFocus
                value={saveName}
                onChange={(event) => setSaveName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && saveScan()}
                className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm outline-none focus:border-ring"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Saved in this browser. Use Share to send it elsewhere.</p>
              <button
                type="button"
                disabled={!saveName.trim()}
                onClick={saveScan}
                className="mt-2 w-full rounded-lg bg-info py-1.5 text-xs font-bold text-primary-foreground hover:bg-info disabled:opacity-40"
              >
                Save
              </button>
            </Popover>
            <button
              type="button"
              onClick={() => void runBacktest(sessions)}
              disabled={backtestLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-purple/30 bg-purple/10 px-4 py-2 text-sm font-bold text-purple hover:bg-purple/10 disabled:opacity-60"
            >
              {backtestLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />} Backtest Results
            </button>
            <Popover
              open={alertOpen}
              onClose={() => setAlertOpen(false)}
              className="w-[280px] p-3"
              trigger={
                <button
                  type="button"
                  onClick={() => setAlertOpen((value) => !value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-bold",
                    alert.enabled
                      ? "border-warning/30 bg-warning/15 text-warning"
                      : "border-warning/30 bg-warning/10 text-warning hover:bg-warning/15",
                  )}
                >
                  <BellRing className="h-4 w-4" /> {alert.enabled ? `Alert on · ${alert.minutes}m` : "Create Alert"}
                </button>
              }
            >
              <div className="text-sm font-extrabold text-foreground">Scan alert</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Re-runs this scan while the page is open and notifies you when new stocks enter the results.
              </p>
              <label className="mt-2 flex items-center justify-between text-xs font-semibold text-foreground">
                Check every
                <select
                  value={alert.minutes}
                  onChange={(event) => setAlert({ ...alert, minutes: Number(event.target.value) })}
                  className="rounded-md border border-border px-2 py-1"
                >
                  {ALERT_INTERVALS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} min
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  const enabled = !alert.enabled;
                  if (enabled && typeof Notification !== "undefined" && Notification.permission === "default") {
                    void Notification.requestPermission();
                  }
                  setAlert({ ...alert, enabled });
                  setAlertOpen(false);
                  toast.success(enabled ? "Alert started" : "Alert stopped");
                }}
                className={cn(
                  "mt-3 w-full rounded-lg py-1.5 text-xs font-bold text-primary-foreground",
                  alert.enabled ? "bg-muted-foreground hover:bg-muted-foreground/90" : "bg-warning hover:bg-warning/90",
                )}
              >
                {alert.enabled ? "Stop alert" : "Start alert"}
              </button>
            </Popover>
            <button
              type="button"
              onClick={() => setExplainOpen((value) => !value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-bold",
                explainOpen ? "border-info/25 bg-info/15 text-info" : "border-info/25 bg-info/10 text-info hover:bg-info/15",
              )}
            >
              <Sparkles className="h-4 w-4" /> Explain
            </button>
            <button
              type="button"
              onClick={() => void copyText(scanText(scan), "Scan copied as text")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold text-muted-foreground hover:bg-muted"
            >
              <FileText className="h-4 w-4" /> Copy as text
            </button>
          </div>

          {explainOpen && (
            <div className="mt-3 rounded-xl border border-info/25 bg-info/10 p-3 text-xs text-foreground">
              {explainScan(scan).map((line, index) => (
                <p key={index} className={cn("whitespace-pre-wrap", index === 0 && "mb-1 font-bold text-foreground")}>
                  {line}
                </p>
              ))}
              <pre className="mt-2 overflow-x-auto rounded-lg bg-card p-2 font-mono text-[11px] text-muted-foreground ring-1 ring-border">
                {scanText(scan)}
              </pre>
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 flex flex-wrap items-baseline gap-2">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-foreground">Stocks</h2>
            {result && (
              <span className="text-xs font-semibold text-muted-foreground">
                {result.rows.length} of {result.scanned.toLocaleString("en-IN")} stocks passed · scanned in{" "}
                {(result.elapsedMs / 1000).toFixed(1)}s{result.asOf ? ` · candles up to ${result.asOf}` : ""}
              </span>
            )}
            {runError && <span className="text-xs font-semibold text-error">{runError}</span>}
          </div>
          <ResultsTable
            rows={result?.rows ?? []}
            columns={scan.columns}
            onColumnsChange={(columns: ResultColumn[]) => setScan({ ...scan, columns })}
            settings={settings}
            onSettingsChange={setSettings}
            scanName={scan.name}
            loading={running}
          />
        </section>

        {backtestOpen && (
          <BacktestPanel
            result={backtest}
            loading={backtestLoading}
            sessions={sessions}
            onSessionsChange={(count) => {
              setSessions(count);
              void runBacktest(count);
            }}
          />
        )}

        {libraryOpen && (
          <ScanLibrary
            saved={saved}
            onLoad={loadScan}
            onDeleteSaved={(id) => {
              const next = saved.filter((entry) => entry.id !== id);
              storeSavedScans(next);
              setSaved(next);
            }}
            onClose={() => setLibraryOpen(false)}
          />
        )}
      </div>
    </ScanActionsContext.Provider>
  );
}
