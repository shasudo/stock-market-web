"use client";

import { apiGet } from "@/lib/api";
import type { LiveMarketResponse } from "@/lib/types";
import { usePoll } from "@/hooks/usePoll";
import { ChangePill, DataStamp } from "../numbers";
import { DataTable, EmptyState } from "../DataTable";
import { cn } from "@/lib/cn";

export type SectorBy = "sector" | "industry";

interface Group {
  name: string;
  count: number;
  adv: number;
  dec: number;
  avg: number | null;
}

/** Sector / industry performance, aggregated from the live table. */
export function SectorView({
  by,
  title,
  blurb,
}: {
  by: SectorBy;
  title: string;
  blurb: string;
}) {
  const nse = usePoll(() => apiGet<LiveMarketResponse>("/market/live?exchange=NSE&filter=all&page=1&pageSize=500"), 30_000);
  const bse = usePoll(() => apiGet<LiveMarketResponse>("/market/live?exchange=BSE&filter=all&page=1&pageSize=500"), 30_000);

  const rows = [...(nse.data?.stocks ?? []), ...(bse.data?.stocks ?? [])];
  const stale = nse.stale || bse.stale;
  const failed = nse.failed && bse.failed;
  const loaded = nse.data != null || bse.data != null;

  const groups = new Map<string, { count: number; adv: number; dec: number; sum: number; n: number }>();
  for (const s of rows) {
    const name = (by === "sector" ? s.sector : s.industry) ?? "Unclassified";
    const g = groups.get(name) ?? { count: 0, adv: 0, dec: 0, sum: 0, n: 0 };
    g.count += 1;
    if ((s.percentChange ?? 0) > 0) g.adv += 1;
    else if ((s.percentChange ?? 0) < 0) g.dec += 1;
    if (s.percentChange != null) {
      g.sum += s.percentChange;
      g.n += 1;
    }
    groups.set(name, g);
  }
  const list: Group[] = [...groups.entries()]
    .map(([name, g]) => ({ name, count: g.count, adv: g.adv, dec: g.dec, avg: g.n > 0 ? g.sum / g.n : null }))
    .sort((a, b) => (b.avg ?? -Infinity) - (a.avg ?? -Infinity));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline gap-2 px-1">
        <h1 className="text-base font-semibold">{title}</h1>
        <p className="text-xs text-muted">{blurb}</p>
        {stale && (
          <span className="ml-auto rounded-full bg-warn-tint px-2 py-0.5 text-[10px] font-semibold text-warn">
            STALE
          </span>
        )}
      </div>
      <section aria-label={title} className="overflow-hidden rounded-md border border-line bg-surface">
        <DataTable
          stickyFirst
          columns={[
            {
              key: "name",
              header: by === "sector" ? "Sector" : "Industry",
              render: (g) => <span className="font-medium">{g.name}</span>,
            },
            {
              key: "avg",
              header: "Avg %",
              align: "right",
              render: (g) => <ChangePill value={g.avg == null ? null : Math.round(g.avg * 100) / 100} />,
            },
            {
              key: "adv",
              header: "Adv",
              align: "right",
              render: (g) => <span className={cn("tnum", g.adv > 0 && "text-up")}>{g.adv}</span>,
            },
            {
              key: "dec",
              header: "Dec",
              align: "right",
              render: (g) => <span className={cn("tnum", g.dec > 0 && "text-down")}>{g.dec}</span>,
            },
            {
              key: "count",
              header: "Stocks",
              align: "right",
              render: (g) => <span className="tnum text-muted">{g.count}</span>,
            },
          ]}
          rows={list}
          rowKey={(g) => g.name}
          loading={!loaded && !failed}
          empty={<EmptyState title="No sector data while the live table is empty." />}
        />
        <DataStamp label={nse.data?.lastSyncAt ?? bse.data?.lastSyncAt ?? null} />
      </section>
    </div>
  );
}
