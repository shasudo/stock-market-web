"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  LineChart,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { exprText } from "@/lib/screener/format";
import type { ScanResultRow } from "@/lib/screener/runner";
import { newId, type ResultColumn } from "@/lib/screener/scan-types";
import { cn } from "@/lib/utils";
import { ExprEditor } from "./ClauseEditor";
import { MeasurePicker } from "./MeasurePicker";
import { Popover } from "./Popover";

export interface TableSettings {
  readonly copyScope: "all" | "page";
  readonly newTab: boolean;
  readonly chartPreview: boolean;
  readonly autoRefresh: boolean;
  readonly linkTo: "chart" | "stock";
}

export const DEFAULT_TABLE_SETTINGS: TableSettings = {
  copyScope: "all",
  newTab: true,
  chartPreview: true,
  autoRefresh: false,
  linkTo: "chart",
};

interface ResultsTableProps {
  readonly rows: readonly ScanResultRow[];
  readonly columns: readonly ResultColumn[];
  readonly onColumnsChange: (columns: ResultColumn[]) => void;
  readonly settings: TableSettings;
  readonly onSettingsChange: (settings: TableSettings) => void;
  readonly scanName: string;
  readonly loading: boolean;
}

type SortKey = "name" | "symbol" | "close" | "pctChange" | "volume" | `col:${string}`;

const PER_PAGE_OPTIONS = [20, 50, 100, 250];

function formatPrice(value: number | null): string {
  if (value === null) return "–";
  return value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function formatVolume(value: number | null): string {
  if (value === null) return "–";
  return Math.round(value).toLocaleString("en-IN");
}

function formatCell(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "–";
  if (typeof value === "string") return value;
  const abs = Math.abs(value);
  return value.toLocaleString("en-IN", { maximumFractionDigits: abs >= 100 ? 2 : abs >= 1 ? 2 : 4 });
}

function Sparkline({ values }: { readonly values: readonly number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 220;
  const height = 80;
  const path = values
    .map((value, index) => `${index === 0 ? "M" : "L"}${(index / (values.length - 1)) * width},${height - ((value - min) / span) * height}`)
    .join(" ");
  const up = values[values.length - 1]! >= values[0]!;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-20 w-[220px]">
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className={up ? "text-success" : "text-error"}
      />
    </svg>
  );
}

function download(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function xmlEscape(value: string): string {
  return value.replace(/[<>&"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[char]!);
}

function ColumnEditor({
  columns,
  onChange,
}: {
  readonly columns: readonly ResultColumn[];
  readonly onChange: (columns: ResultColumn[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const update = (index: number, column: ResultColumn): void => {
    const next = [...columns];
    next[index] = column;
    onChange(next);
  };
  const move = (index: number, direction: -1 | 1): void => {
    const target = index + direction;
    if (target < 0 || target >= columns.length) return;
    const next = [...columns];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };
  return (
    <div className="border-b border-border bg-muted/70 px-3 py-3">
      <div className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">Result columns</div>
      <p className="text-xs text-muted-foreground">
        Add, remove, and reorder result columns. The table refreshes when you run the scan.
      </p>
      <div className="mt-2 space-y-1.5">
        <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold text-muted-foreground">
          Always shown: Stock name · Symbol · Close · % Change · Volume
        </div>
        {columns.map((column, index) => (
          <div key={column.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-card px-2 py-1.5 ring-1 ring-border">
            <ExprEditor
              expr={column.expr}
              onChange={(expr) => update(index, { ...column, expr, label: column.label || exprText(expr) })}
            />
            <span className="text-[10px] font-bold uppercase text-muted-foreground">as</span>
            <input
              value={column.label}
              onChange={(event) => update(index, { ...column, label: event.target.value })}
              className="w-40 rounded-md border border-border px-2 py-0.5 text-xs font-bold uppercase text-foreground"
            />
            <div className="ml-auto flex items-center">
              <button type="button" aria-label="Move column left" onClick={() => move(index, -1)} className="rounded p-1 text-muted-foreground hover:bg-muted">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" aria-label="Move column right" onClick={() => move(index, 1)} className="rounded p-1 text-muted-foreground hover:bg-muted">
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Remove column"
                onClick={() => onChange(columns.filter((_, position) => position !== index))}
                className="rounded p-1 text-muted-foreground hover:bg-error/10 hover:text-error"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        <Popover
          open={adding}
          onClose={() => setAdding(false)}
          trigger={
            <button
              type="button"
              onClick={() => setAdding((value) => !value)}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" /> Add column
            </button>
          }
        >
          <MeasurePicker
            allowText={false}
            onPick={(choice) => {
              if (choice.kind === "term") {
                const expr = { terms: [choice.term], ops: [] };
                onChange([...columns, { id: newId("col"), label: exprText(expr).toUpperCase().slice(0, 40), expr }]);
              }
              setAdding(false);
            }}
          />
        </Popover>
      </div>
    </div>
  );
}

function Toggle({ on, onChange, label }: { readonly on: boolean; readonly onChange: (on: boolean) => void; readonly label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1.5 text-xs font-semibold text-foreground">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={cn("relative h-5 w-9 rounded-full transition-colors", on ? "bg-primary" : "bg-muted-foreground/30")}
      >
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-card shadow transition-all", on ? "left-[18px]" : "left-0.5")} />
      </button>
    </label>
  );
}

export function ResultsTable({
  rows,
  columns,
  onColumnsChange,
  settings,
  onSettingsChange,
  scanName,
  loading,
}: ResultsTableProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "pctChange", dir: "desc" });
  const [pageState, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [editingColumns, setEditingColumns] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preview, setPreview] = useState<{ row: ScanResultRow; x: number; y: number } | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const base = needle
      ? rows.filter((row) => row.symbol.toLowerCase().includes(needle) || row.name.toLowerCase().includes(needle))
      : rows;
    const value = (row: ScanResultRow): number | string | null => {
      if (sort.key.startsWith("col:")) return row.columns[sort.key.slice(4)] ?? null;
      return row[sort.key as "name"] ?? null;
    };
    return [...base].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      if (left === null) return 1;
      if (right === null) return -1;
      const order = typeof left === "string" || typeof right === "string"
        ? String(left).localeCompare(String(right))
        : left - right;
      return sort.dir === "asc" ? order : -order;
    });
  }, [rows, query, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  // New results or a narrower search can leave the old page out of range.
  const page = Math.min(pageState, pages);
  const current = filtered.slice((page - 1) * perPage, page * perPage);

  const header = (key: SortKey, label: string, align: "left" | "right" = "left") => {
    const active = sort.key === key;
    return (
      <th className={cn("whitespace-nowrap px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground", align === "right" && "text-right")}>
        <button
          type="button"
          aria-label={`Sort table by ${label}`}
          onClick={() => setSort({ key, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
          className={cn("inline-flex items-center gap-1 hover:text-primary", align === "right" && "flex-row-reverse")}
        >
          {label}
          {active ? (
            sort.dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
          ) : (
            <ChevronsUpDown className="h-3 w-3 text-muted-foreground/60" />
          )}
        </button>
      </th>
    );
  };

  const exportRows = settings.copyScope === "page" ? current : filtered;
  const headers = ["Sr.", "Stock Name", "Symbol", "Close", "% Change", "Volume", ...columns.map((column) => column.label)];
  const tableData = (list: readonly ScanResultRow[]): (string | number)[][] =>
    list.map((row, index) => [
      index + 1,
      row.name,
      row.symbol,
      row.close ?? "",
      row.pctChange ?? "",
      row.volume ?? "",
      ...columns.map((column) => row.columns[column.id] ?? ""),
    ]);

  const copySymbols = async (): Promise<void> => {
    const text = exportRows.map((row) => row.symbol).join(",");
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied ${exportRows.length} symbols`);
    } catch {
      toast.error("Clipboard is not available here.");
    }
  };

  const exportCsv = (): void => {
    const lines = [headers, ...tableData(filtered)].map((line) =>
      line.map((cell) => (typeof cell === "string" && /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : String(cell))).join(","),
    );
    download(`${scanName || "scan"}-results.csv`, lines.join("\n"), "text/csv;charset=utf-8");
  };

  const exportExcel = (): void => {
    const cell = (value: string | number): string =>
      typeof value === "number"
        ? `<Cell><Data ss:Type="Number">${value}</Data></Cell>`
        : `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
    const xmlRows = [headers, ...tableData(filtered)].map((line) => `<Row>${line.map(cell).join("")}</Row>`).join("");
    const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Results"><Table>${xmlRows}</Table></Worksheet></Workbook>`;
    download(`${scanName || "scan"}-results.xls`, xml, "application/vnd.ms-excel");
  };

  const linkFor = (row: ScanResultRow): string =>
    settings.linkTo === "chart" ? `/chart/${encodeURIComponent(row.symbol)}` : `/stock/${encodeURIComponent(row.symbol)}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-2.5">
        <button
          type="button"
          onClick={() => setEditingColumns((value) => !value)}
          className={cn(
            "rounded-lg px-2.5 py-1.5 text-xs font-bold",
            editingColumns ? "bg-primary/80 text-primary-foreground" : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          {editingColumns ? "Hide column editor" : "Customize columns"}
        </button>
        {[
          ["Copy", copySymbols],
          ["CSV", exportCsv],
          ["Excel", exportExcel],
        ].map(([label, action]) => (
          <button
            key={label as string}
            type="button"
            disabled={rows.length === 0}
            onClick={action as () => void}
            className="rounded-lg bg-muted px-2.5 py-1.5 text-xs font-bold text-foreground hover:bg-border disabled:opacity-40"
          >
            {label as string}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2 py-1">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search stocks"
              className="w-32 bg-transparent text-xs font-semibold outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Popover
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            align="right"
            className="w-[250px] p-3"
            trigger={
              <button
                type="button"
                aria-label="Settings Dropdown"
                onClick={() => setSettingsOpen((value) => !value)}
                className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-bold text-foreground hover:bg-border"
              >
                Settings <ChevronDown className="h-3 w-3" />
              </button>
            }
          >
            <div className="flex items-center justify-between py-1.5 text-xs font-semibold text-foreground">
              Copy symbols
              <div className="flex rounded-md bg-muted p-0.5">
                {(["all", "page"] as const).map((scope) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => onSettingsChange({ ...settings, copyScope: scope })}
                    className={cn("rounded px-2 py-0.5 capitalize", settings.copyScope === scope ? "bg-card shadow-xs" : "text-muted-foreground")}
                  >
                    {scope}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between py-1.5 text-xs font-semibold text-foreground">
              Symbol links open
              <div className="flex rounded-md bg-muted p-0.5">
                {(["chart", "stock"] as const).map((target) => (
                  <button
                    key={target}
                    type="button"
                    onClick={() => onSettingsChange({ ...settings, linkTo: target })}
                    className={cn("rounded px-2 py-0.5 capitalize", settings.linkTo === target ? "bg-card shadow-xs" : "text-muted-foreground")}
                  >
                    {target}
                  </button>
                ))}
              </div>
            </div>
            <Toggle label="Open in new tab" on={settings.newTab} onChange={(newTab) => onSettingsChange({ ...settings, newTab })} />
            <Toggle
              label="Show chart preview"
              on={settings.chartPreview}
              onChange={(chartPreview) => onSettingsChange({ ...settings, chartPreview })}
            />
            <Toggle
              label="Auto refresh (1 min)"
              on={settings.autoRefresh}
              onChange={(autoRefresh) => onSettingsChange({ ...settings, autoRefresh })}
            />
          </Popover>
        </div>
      </div>

      {editingColumns && <ColumnEditor columns={columns} onChange={onColumnsChange} />}

      <div className={cn("w-full overflow-x-auto", loading && "opacity-60")}>
        <table className="w-full border-collapse text-left text-xs">
          <thead className="border-b border-border bg-muted/90">
            <tr>
              <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sr.</th>
              {header("name", "Stock Name")}
              {header("symbol", "Symbol")}
              <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Links</th>
              {header("close", "Close", "right")}
              {header("pctChange", "% Chg", "right")}
              {header("volume", "Volume", "right")}
              {columns.map((column) => (
                <Fragment key={column.id}>{header(`col:${column.id}`, column.label || exprText(column.expr), "right")}</Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {current.map((row, index) => (
              <tr key={`${row.exchange}:${row.symbol}`} className="odd:bg-muted/60 hover:bg-primary/5">
                <td className="px-3 py-2 font-mono text-muted-foreground">{(page - 1) * perPage + index + 1}</td>
                <td className="max-w-[260px] truncate px-3 py-2 font-semibold text-foreground" title={row.name}>
                  {row.name}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={linkFor(row)}
                    target={settings.newTab ? "_blank" : undefined}
                    onMouseEnter={(event) =>
                      settings.chartPreview && setPreview({ row, x: event.clientX, y: event.clientY })
                    }
                    onMouseLeave={() => setPreview(null)}
                    className="font-bold text-primary hover:underline"
                  >
                    {row.symbol}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold">
                    <Link href={`/chart/${encodeURIComponent(row.symbol)}`} target={settings.newTab ? "_blank" : undefined} className="inline-flex items-center gap-0.5 text-info hover:underline">
                      <LineChart className="h-3 w-3" /> Chart
                    </Link>
                    <Link href={`/stock/${encodeURIComponent(row.symbol)}`} target={settings.newTab ? "_blank" : undefined} className="text-muted-foreground hover:underline">
                      Info
                    </Link>
                  </div>
                </td>
                <td className="px-3 py-2 text-right font-mono font-semibold text-foreground">{formatPrice(row.close)}</td>
                <td
                  className={cn(
                    "px-3 py-2 text-right font-mono font-bold",
                    (row.pctChange ?? 0) > 0 ? "text-success" : (row.pctChange ?? 0) < 0 ? "text-error" : "text-muted-foreground",
                  )}
                >
                  {row.pctChange === null ? "–" : `${row.pctChange > 0 ? "+" : ""}${row.pctChange.toFixed(2)}%`}
                </td>
                <td className="px-3 py-2 text-right font-mono text-muted-foreground">{formatVolume(row.volume)}</td>
                {columns.map((column) => (
                  <td key={column.id} className="px-3 py-2 text-right font-mono text-foreground">
                    {formatCell(row.columns[column.id])}
                  </td>
                ))}
              </tr>
            ))}
            {current.length === 0 && (
              <tr>
                <td colSpan={7 + columns.length} className="px-3 py-10 text-center text-sm font-medium text-muted-foreground">
                  {loading ? "Scanning…" : "No stocks present"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border px-3 py-2.5 text-xs font-semibold text-muted-foreground">
        <label className="flex items-center gap-1.5">
          Page #
          <input
            type="number"
            min={1}
            max={pages}
            value={page}
            onChange={(event) => setPage(Math.min(pages, Math.max(1, Number(event.target.value) || 1)))}
            className="w-14 rounded-md border border-border px-1.5 py-0.5 font-mono"
          />
        </label>
        <span className="text-muted-foreground">
          {filtered.length} stocks
          {filtered.length > 0 && ` (${(page - 1) * perPage + 1} to ${Math.min(page * perPage, filtered.length)})`}
        </span>
        <label className="flex items-center gap-1.5">
          Per Page
          <select
            value={perPage}
            onChange={(event) => {
              setPerPage(Number(event.target.value));
              setPage(1);
            }}
            className="rounded-md border border-border px-1.5 py-0.5"
          >
            {PER_PAGE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="inline-flex items-center rounded-md px-2 py-1 hover:bg-muted disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Previous
          </button>
          {Array.from({ length: pages }, (_, index) => index + 1)
            .filter((number) => number === 1 || number === pages || Math.abs(number - page) <= 1)
            .map((number, index, list) => (
              <span key={number} className="flex items-center">
                {index > 0 && number - list[index - 1]! > 1 && <span className="px-1 text-muted-foreground/60">…</span>}
                <button
                  type="button"
                  onClick={() => setPage(number)}
                  className={cn(
                    "min-w-7 rounded-md px-2 py-1 font-mono",
                    number === page ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  {number}
                </button>
              </span>
            ))}
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
            className="inline-flex items-center rounded-md px-2 py-1 hover:bg-muted disabled:opacity-40"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {preview && (
        <div
          className="pointer-events-none fixed z-[70] rounded-xl border border-border bg-card p-2 shadow-xl"
          style={{ left: Math.min(preview.x + 16, window.innerWidth - 250), top: preview.y + 12 }}
        >
          <div className="flex items-baseline justify-between gap-3 px-1">
            <span className="text-xs font-extrabold text-foreground">{preview.row.symbol}</span>
            <span className="text-[10px] font-semibold text-muted-foreground">last {preview.row.spark.length} sessions</span>
          </div>
          <Sparkline values={preview.row.spark} />
        </div>
      )}
    </div>
  );
}
