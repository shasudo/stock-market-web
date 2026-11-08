import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  sub?: string;
  render: (row: T) => ReactNode;
}

/** The one table of the terminal. Sticky frosted header, compact rows,
 *  right-aligned tabular numerals, horizontal scroll with sticky first
 *  column on small screens, skeleton that mirrors row geometry. */
export function DataTable<T extends object>({
  columns,
  rows,
  rowKey,
  empty,
  loading,
  stickyFirst = false,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  empty: ReactNode;
  loading?: boolean;
  stickyFirst?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-[13px]">
        <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur">
          <tr className="border-b border-line">
            {columns.map((col, i) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  "whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted",
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center",
                  col.align !== "right" && col.align !== "center" && "text-left",
                  stickyFirst && i === 0 && "sticky left-0 z-10 bg-surface/95",
                )}
              >
                {col.header}
                {col.sub != null && (
                  <span className="tnum block text-[10px] font-medium normal-case tracking-normal text-faint">
                    {col.sub}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading === true &&
            Array.from({ length: 12 }, (_, i) => (
              <tr key={`skeleton-${i}`} className="border-b border-line" aria-hidden>
                {columns.map((col, j) => (
                  <td key={col.key} className="px-3 py-2">
                    <div
                      className="skeleton h-4 rounded-sm"
                      style={{ width: j === 0 ? 120 : 64, marginLeft: col.align === "right" ? "auto" : 0 }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          {loading !== true &&
            rows.map((row, index) => (
              <tr
                key={rowKey(row, index)}
                className="border-b border-line transition-colors last:border-0 hover:bg-accent/[0.04]"
              >
                {columns.map((col, i) => (
                  <td
                    key={col.key}
                    className={cn(
                      "whitespace-nowrap px-3 py-2",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                      col.align !== "right" && col.align !== "center" && "text-left",
                      stickyFirst && i === 0 && "sticky left-0 z-10 bg-surface",
                    )}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          {loading !== true && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length}>{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Shared empty state: one action, never a bare box. */
export function EmptyState({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="text-sm font-medium text-muted">{title}</p>
      {action}
    </div>
  );
}
