"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ExternalLink,
  Globe,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient, { isSuccessfulApiResponse } from "@/lib/api-client";
import { StockActionsMenu } from "@/components/common";
import { usePersistedSettings } from "@/lib/hooks/usePersistedSettings";
import { isMarketOpen } from "@/lib/market-hours";
import { useWatchlistStore } from "@/store/useWatchlistStore";
import {
  DEFAULT_QUICK_RATIOS,
  QUICK_RATIO_CATALOG,
  QUICK_RATIO_IDS,
  QUICK_RATIO_TABS,
  normalizeQuickRatioSelection,
  type QuickRatioDef,
  type QuickRatioTabId,
  type QuickRatioUnit,
} from "@/lib/fundamentals/quick-ratios";

const QUICK_RATIOS_SCOPE = "quick-ratios";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function formatQuickRatioValue(
  unit: QuickRatioUnit,
  value: number | null,
): string {
  if (value === null) return "—";
  if (unit === "percent") return `${value.toFixed(2)} %`;
  if (unit === "currency") {
    const abs = Math.abs(value);
    if (abs >= 1e7) return `₹${(value / 1e7).toFixed(2)} Cr.`;
    if (abs >= 1e5) return `₹${(value / 1e5).toFixed(2)} Lakh`;
    return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  }
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

interface QuickRatiosPayload {
  readonly selected: string[];
}

const defaultQuickRatios: QuickRatiosPayload = {
  selected: [...DEFAULT_QUICK_RATIOS],
};

function normalizeQuickRatiosPayload(raw: unknown): QuickRatiosPayload {
  const selected =
    isRecord(raw) && "selected" in raw
      ? normalizeQuickRatioSelection(raw.selected)
      : [...DEFAULT_QUICK_RATIOS];
  return { selected };
}

function useQuickRatioSelection() {
  const { settings, updateSettings } = usePersistedSettings<QuickRatiosPayload>(
    {
      scope: QUICK_RATIOS_SCOPE,
      defaultSettings: defaultQuickRatios,
      normalize: normalizeQuickRatiosPayload,
    },
  );
  return {
    selected: settings.selected,
    saveSelection: (selected: string[]) => updateSettings({ selected }),
  };
}

interface StockListing {
  readonly exchange: string;
  readonly tradingSymbol: string;
  readonly securityId: number;
}

interface QuickRatiosSummary {
  readonly values: Record<string, number | null>;
  readonly description: string | null;
  readonly website: string | null;
  readonly listings: readonly StockListing[];
  readonly isFno: boolean;
  readonly keyPoints: readonly string[];
}

const summaryText = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

async function fetchQuickRatioValues(
  symbol: string,
  signal: AbortSignal,
): Promise<QuickRatiosSummary> {
  const response = await apiClient.get<unknown>(
    `/api/stocks/${encodeURIComponent(symbol)}/quick-ratios`,
    { signal },
  );
  const data = isSuccessfulApiResponse(response.data)
    ? response.data.data
    : null;
  if (!isRecord(data) || !isRecord(data.values)) {
    throw new Error("Unexpected quick-ratios response.");
  }
  const values: Record<string, number | null> = {};
  for (const [id, value] of Object.entries(data.values)) {
    values[id] =
      typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  const profile = isRecord(data.profile) ? data.profile : null;
  const listings = Array.isArray(data.listings)
    ? data.listings.filter(
        (entry): entry is StockListing =>
          isRecord(entry) &&
          typeof entry.exchange === "string" &&
          typeof entry.tradingSymbol === "string" &&
          typeof entry.securityId === "number",
      )
    : [];
  return {
    values,
    description: profile ? summaryText(profile.description) : null,
    website: profile ? summaryText(profile.website) : null,
    listings,
    isFno: data.isFno === true,
    keyPoints: Array.isArray(data.keyPoints)
      ? data.keyPoints.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [],
  };
}

function RatioTile({
  def,
  value,
}: {
  def: QuickRatioDef;
  value: number | null;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5">
      <span className="text-xs text-muted-foreground">{def.label}</span>
      <span className="text-sm font-bold text-foreground whitespace-nowrap">
        {formatQuickRatioValue(def.unit, value)}
      </span>
    </div>
  );
}

function ManageRatiosDialog({
  open,
  initialSelection,
  onSave,
  onClose,
}: {
  open: boolean;
  initialSelection: readonly string[];
  onSave: (selected: string[]) => void;
  onClose: () => void;
}) {
  // The parent mounts this dialog fresh on every open (keyed by the saved
  // selection), so initializers below always start from current data.
  const [activeTab, setActiveTab] = useState<QuickRatioTabId>("most-used");
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState<string[]>([...initialSelection]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  const toggle = (id: string) => {
    setDraft((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    );
  };

  const query = filter.trim().toLowerCase();
  const forTab = (column: "recent" | "preceding" | "historical") =>
    QUICK_RATIO_IDS.map((id) => QUICK_RATIO_CATALOG[id])
      .filter(
        (def) =>
          def.tabs.includes(activeTab) &&
          def.column === column &&
          (query === "" || def.label.toLowerCase().includes(query)),
      )
      .sort((a, b) => a.label.localeCompare(b.label));

  if (!open) return null;
  const columns = [
    { id: "recent", label: "Recent" },
    { id: "preceding", label: "Preceding" },
    { id: "historical", label: "Historical" },
  ] as const;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mt-8 w-full max-w-5xl rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <button
            type="button"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90"
          >
            Save quick_ratios
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:border-slate-400"
          >
            Cancel
          </button>
          <span className="ml-auto text-xs text-muted-foreground">
            {draft.length} selected
          </span>
        </div>

        <div className="grid md:grid-cols-[240px_1fr]">
          <div className="border-b border-border p-4 md:border-b-0 md:border-r">
            <p className="mb-2 text-xs font-bold text-muted-foreground">
              Filter Ratios
            </p>
            <div className="relative">
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="eg. return on capital"
                className="h-9 w-full rounded-lg border border-border px-3 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Search className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div className="p-4">
            <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-border p-1">
              {QUICK_RATIO_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activeTab === tab.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="grid gap-6 sm:grid-cols-3">
              {columns.map((column) => {
                const defs = forTab(column.id);
                return (
                  <div key={column.id}>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {column.label}
                    </p>
                    {defs.length === 0 ? (
                      <p className="text-xs text-muted-foreground">—</p>
                    ) : (
                      <div className="space-y-1.5">
                        {defs.map((def) => (
                          <label
                            key={def.id}
                            className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <input
                              type="checkbox"
                              checked={draft.includes(def.id)}
                              onChange={() => toggle(def.id)}
                              className="mt-0.5 h-3.5 w-3.5 accent-indigo-600"
                            />
                            <span>{def.label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddRatioInput({
  selected,
  onAdd,
}: {
  selected: readonly string[];
  onAdd: (id: string) => void;
}) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const query = input.trim().toLowerCase();
  const matches =
    query.length === 0
      ? []
      : QUICK_RATIO_IDS.map((id) => QUICK_RATIO_CATALOG[id])
          .filter(
            (def) =>
              !selected.includes(def.id) &&
              def.label.toLowerCase().includes(query),
          )
          .slice(0, 8);

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="eg. Promoter holding"
        aria-label="Add ratio to table"
        className="h-10 w-full rounded-lg border border-border px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring md:max-w-sm"
      />
      {open && query.length > 0 && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg md:max-w-sm">
          {matches.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No matches.
            </p>
          ) : (
            matches.map((def) => (
              <button
                key={def.id}
                type="button"
                onClick={() => {
                  onAdd(def.id);
                  setInput("");
                  setOpen(false);
                }}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                {def.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function useQuickRatiosSummary(symbol: string) {
  const [summary, setSummary] = useState<QuickRatiosSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const load = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const next = await fetchQuickRatioValues(symbol, controller.signal);
        if (active) {
          setSummary(next);
          setLoading(false);
        }
      } catch (fetchError: unknown) {
        if (!active) return;
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          return;
        }
        setError("Could not load ratios right now.");
        setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [symbol]);

  return { summary, loading, error };
}

function hostnameOf(website: string): string {
  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return website;
  }
}

export function SummaryLinks({ summary }: { summary: QuickRatiosSummary }) {
  const { website, listings, isFno } = summary;
  if (website === null && listings.length === 0 && !isFno) return null;
  return (
    <div className="flex items-center gap-3 flex-wrap text-xs">
      {website && (
        <a
          href={website}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-primary hover:text-primary/80"
        >
          <Globe className="h-3.5 w-3.5" />
          {hostnameOf(website)}
        </a>
      )}
      {listings.map((listing) => (
        <span
          key={`${listing.exchange}-${listing.securityId}`}
          className="inline-flex items-center gap-1 font-semibold text-muted-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          {listing.exchange === "BSE"
            ? `BSE: ${listing.securityId}`
            : `${listing.exchange}: ${listing.tradingSymbol}`}
        </span>
      ))}
      {isFno && (
        <span className="inline-flex items-center gap-1 font-semibold text-muted-foreground">
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          F&amp;O
        </span>
      )}
    </div>
  );
}

export function SummarySidePanel({ summary }: { summary: QuickRatiosSummary }) {
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [pointsExpanded, setPointsExpanded] = useState(false);
  const { description, keyPoints } = summary;
  const visiblePoints = pointsExpanded ? keyPoints : keyPoints.slice(0, 3);

  return (
    <div>
      {description && (
        <div className="mb-4">
          <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-foreground">
            About
          </h3>
          <p
            className={`text-xs leading-6 text-muted-foreground ${aboutExpanded ? "" : "line-clamp-3"}`}
          >
            {description}
          </p>
          <button
            type="button"
            onClick={() => setAboutExpanded((open) => !open)}
            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            {aboutExpanded ? "Show less" : "Read more"}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${aboutExpanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      )}

      {keyPoints.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground">
            Key points
          </h3>
          <ul className="space-y-1.5">
            {visiblePoints.map((point) => (
              <li
                key={point}
                className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"
              >
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground"
                />
                {point}
              </li>
            ))}
          </ul>
          {keyPoints.length > 3 && (
            <button
              type="button"
              onClick={() => setPointsExpanded((open) => !open)}
              className="mt-2 text-xs font-bold uppercase tracking-wider text-primary hover:text-primary/80"
            >
              {pointsExpanded ? "Show less" : "Read more >"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export interface StockSummaryQuote {
  readonly displayName: string;
  readonly lastPrice: number;
  readonly pctChange: number;
  readonly syncedAt: string;
  readonly sector: string | null;
  readonly industry: string | null;
}

/**
 * Screenshot-style stock summary: header (avatar, name, price, export,
 * follow), listing links, then the ratios grid beside About / Key Points.
 */
export function StockSummarySection({
  symbol,
  quote,
  onNoteAdded,
}: {
  symbol: string;
  quote: StockSummaryQuote;
  onNoteAdded?: () => void;
}) {
  const { selected, saveSelection } = useQuickRatioSelection();
  const { summary, loading, error } = useQuickRatiosSummary(symbol);
  const [managerOpen, setManagerOpen] = useState(false);
  const values = summary?.values ?? null;

  const isFollowed = useWatchlistStore((state) =>
    state.isWatched(symbol, "normal"),
  );
  const watchlistAdd = useWatchlistStore((state) => state.add);
  const watchlistRemoveAll = useWatchlistStore(
    (state) => state.removeAllForSymbol,
  );
  const ensureWatchlistLoaded = useWatchlistStore(
    (state) => state.ensureLoaded,
  );

  useEffect(() => {
    void ensureWatchlistLoaded();
  }, [ensureWatchlistLoaded]);

  const tiles = useMemo(
    () =>
      selected
        .map((id) => QUICK_RATIO_CATALOG[id])
        .filter((def): def is QuickRatioDef => def !== undefined),
    [selected],
  );

  const toggleFollow = async (): Promise<void> => {
    try {
      if (isFollowed) {
        await watchlistRemoveAll(symbol, "normal");
        toast.success(`${symbol} unfollowed`);
      } else {
        await watchlistAdd({
          tradingSymbol: symbol,
          sector: quote.sector ?? undefined,
          industry: quote.industry ?? undefined,
          ltp: quote.lastPrice,
          category: "swing",
          listType: "normal",
        });
        toast.success(`${symbol} added to watchlist`);
      }
    } catch {
      toast.error("Could not update follow right now.");
    }
  };

  const exportExcel = (): void => {
    const header = [
      `Company,${csvCell(quote.displayName)}`,
      `Symbol,${symbol}`,
      "",
      "Ratio,Value",
    ];
    const lines = tiles.map((def) =>
      [
        csvCell(def.label),
        csvCell(formatQuickRatioValue(def.unit, values?.[def.id] ?? null)),
      ].join(","),
    );
    downloadTextFile(`${symbol}_ratios.csv`, [...header, ...lines].join("\n"));
    toast.success("Ratios exported to Excel (CSV)");
  };

  const positive = quote.pctChange >= 0;
  const priceDate = new Date(quote.syncedAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });

  return (
    <div>
      <div className="rounded-2xl border border-border/90 bg-card p-4 shadow-xs md:p-5">
        <div className="flex items-start gap-3 flex-wrap">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xl font-bold text-warning"
          >
            {(quote.displayName || symbol).charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-extrabold text-foreground md:text-2xl">
                {quote.displayName}
              </h1>
              <span className="text-lg font-extrabold text-foreground">
                ₹{quote.lastPrice.toLocaleString("en-IN")}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-xs font-bold ${positive ? "text-lime-600" : "text-error"}`}
              >
                <span aria-hidden="true">{positive ? "▲" : "▼"}</span>
                {positive ? "+" : ""}
                {quote.pctChange.toFixed(2)}%
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {priceDate} - {isMarketOpen() ? "live price" : "close price"}
            </p>
            {summary && (
              <div className="mt-2">
                <SummaryLinks summary={summary} />
              </div>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={exportExcel}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:border-slate-400 hover:text-foreground"
            >
              <DownloadIcon />
              Export to Excel
            </button>
            <button
              type="button"
              onClick={() => void toggleFollow()}
              className={`inline-flex h-9 items-center gap-1 rounded-lg px-4 text-[11px] font-bold uppercase tracking-wider text-white transition-colors ${isFollowed ? "bg-muted-foreground hover:bg-muted-foreground" : "bg-primary hover:bg-primary/90"}`}
            >
              {isFollowed ? "Following" : "+ Follow"}
            </button>
            <StockActionsMenu
              stock={{
                symbol,
                name: quote.displayName,
                ltp: quote.lastPrice,
                sector: quote.sector ?? undefined,
                industry: quote.industry ?? undefined,
              }}
              onActionComplete={(action) => {
                if (action === "note") onNoteAdded?.();
              }}
              className="border border-border hover:bg-muted"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-border/90 bg-card p-4 shadow-xs md:p-5">
          {loading ? (
            <p className="py-10 text-center text-xs text-muted-foreground">
              Loading ratios...
            </p>
          ) : error ? (
            <p className="py-10 text-center text-xs text-error">{error}</p>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3">
                {tiles.map((def, index) => (
                  <div
                    key={def.id}
                    className={
                      Math.floor(index / 3) % 2 === 1
                        ? "rounded-lg bg-muted"
                        : ""
                    }
                  >
                    <RatioTile def={def} value={values?.[def.id] ?? null} />
                  </div>
                ))}
              </div>

              <p className="mb-1 mt-4 text-xs font-bold text-foreground">
                Add ratio to table
              </p>
              <div className="flex items-end justify-between gap-3 flex-wrap">
                <AddRatioInput
                  selected={selected}
                  onAdd={(id) => saveSelection([...selected, id])}
                />
                <button
                  type="button"
                  onClick={() => setManagerOpen(true)}
                  className="inline-flex h-9 items-center gap-1.5 px-2 text-xs font-bold uppercase tracking-wider text-primary hover:text-primary/80"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit ratios
                </button>
              </div>
            </>
          )}
        </div>

        <div>{summary && <SummarySidePanel summary={summary} />}</div>
      </div>

      {managerOpen && (
        <ManageRatiosDialog
          key={`${symbol}:${selected.join(",")}`}
          open
          initialSelection={selected}
          onSave={saveSelection}
          onClose={() => setManagerOpen(false)}
        />
      )}
    </div>
  );
}

const csvCell = (value: string): string =>
  /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

function downloadTextFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      className="h-3.5 w-3.5"
    >
      <path
        d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
