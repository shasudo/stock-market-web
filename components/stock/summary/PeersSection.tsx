"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import apiClient, { isSuccessfulApiResponse } from "@/lib/api-client";
import { fmtCr, fmtMult, fmtPct, median } from "./summary-format";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

interface PeerRow {
  readonly symbol: string;
  readonly name: string;
  readonly isSelf: boolean;
  readonly cmp: number | null;
  readonly pe: number | null;
  readonly mcap: number | null;
  readonly divYield: number | null;
  readonly roce: number | null;
  readonly qtrProfit: number | null;
  readonly qtrProfitVar: number | null;
  readonly qtrSales: number | null;
  readonly qtrSalesVar: number | null;
}

interface PeersPayload {
  readonly sector: string | null;
  readonly industry: string | null;
  readonly peers: readonly PeerRow[];
}

function asPeerRow(value: unknown): PeerRow | null {
  if (!isRecord(value) || typeof value.symbol !== "string") return null;
  const n = (key: string): number | null => {
    const v = value[key];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  return {
    symbol: value.symbol,
    name: typeof value.name === "string" ? value.name : value.symbol,
    isSelf: value.isSelf === true,
    cmp: n("cmp"),
    pe: n("pe"),
    mcap: n("mcap"),
    divYield: n("divYield"),
    roce: n("roce"),
    qtrProfit: n("qtrProfit"),
    qtrProfitVar: n("qtrProfitVar"),
    qtrSales: n("qtrSales"),
    qtrSalesVar: n("qtrSalesVar"),
  };
}

export function PeersSection({ symbol }: { symbol: string }) {
  const [payload, setPayload] = useState<PeersPayload | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const load = async (): Promise<void> => {
      try {
        const response = await apiClient.get<unknown>(
          `/api/stocks/${encodeURIComponent(symbol)}/peers`,
          { signal: controller.signal },
        );
        const data = isSuccessfulApiResponse(response.data)
          ? response.data.data
          : null;
        if (!active || !isRecord(data) || !Array.isArray(data.peers)) {
          if (active) setError(true);
          return;
        }
        setPayload({
          sector: typeof data.sector === "string" ? data.sector : null,
          industry: typeof data.industry === "string" ? data.industry : null,
          peers: data.peers
            .map(asPeerRow)
            .filter((row): row is PeerRow => row !== null),
        });
      } catch (err: unknown) {
        if (!active) return;
        if (err instanceof Error && err.name === "AbortError") return;
        setError(true);
      }
    };
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [symbol]);

  return (
    <section
      id="peers"
      className="scroll-mt-24 rounded-2xl border border-border/90 bg-card p-4 shadow-xs md:p-5"
    >
      <div className="mb-1 flex items-baseline gap-2 flex-wrap">
        <h2 className="text-sm font-extrabold text-foreground">
          Peer comparison
        </h2>
      </div>
      {payload && (payload.sector || payload.industry) ? (
        <p className="mb-3 text-[11px] text-muted-foreground">
          {[payload.sector, payload.industry].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      {error ? (
        <p className="py-6 text-center text-xs text-error">
          Could not load peers right now.
        </p>
      ) : !payload ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          Loading peers…
        </p>
      ) : payload.peers.length <= 1 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          No other listed peers in this sector yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-border">
                {[
                  "S.No.",
                  "Company",
                  "CMP Rs.",
                  "P/E",
                  "Mar Cap Rs.Cr.",
                  "Div Yld %",
                  "NP Qtr Rs.Cr.",
                  "Qtr Profit Var %",
                  "Sales Qtr Rs.Cr.",
                  "Qtr Sales Var %",
                  "ROCE %",
                ].map((h, i) => (
                  <th
                    key={h}
                    className={`whitespace-nowrap px-2 py-2 font-semibold text-muted-foreground ${i <= 1 ? "text-left" : "text-right"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payload.peers.map((peer, i) => (
                <tr
                  key={peer.symbol}
                  className={`border-b border-border hover:bg-muted ${peer.isSelf ? "bg-primary/10 font-semibold" : ""}`}
                >
                  <td className="px-2 py-2 text-muted-foreground">{i + 1}.</td>
                  <td className="max-w-[180px] truncate px-2 py-2 text-foreground">
                    {peer.isSelf ? (
                      peer.name
                    ) : (
                      <Link
                        href={`/stock/${encodeURIComponent(peer.symbol)}`}
                        className="text-primary hover:text-primary/80 hover:underline"
                      >
                        {peer.name}
                      </Link>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {peer.cmp === null
                      ? "—"
                      : peer.cmp.toLocaleString("en-IN", {
                          maximumFractionDigits: 2,
                        })}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {fmtMult(peer.pe)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {fmtCr(peer.mcap)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {peer.divYield === null ? "—" : fmtPct(peer.divYield)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {fmtCr(peer.qtrProfit)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {peer.qtrProfitVar === null
                      ? "—"
                      : fmtPct(peer.qtrProfitVar)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {fmtCr(peer.qtrSales)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {peer.qtrSalesVar === null ? "—" : fmtPct(peer.qtrSalesVar)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {peer.roce === null ? "—" : fmtPct(peer.roce)}
                  </td>
                </tr>
              ))}
              <tr className="bg-muted font-semibold">
                <td className="px-2 py-2 text-muted-foreground" />
                <td className="px-2 py-2 text-foreground">Median</td>
                <td />
                <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                  {fmtMult(median(payload.peers.map((p) => p.pe)))}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                  {fmtCr(median(payload.peers.map((p) => p.mcap)))}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                  {(() => {
                    const m = median(payload.peers.map((p) => p.divYield));
                    return m === null ? "—" : fmtPct(m);
                  })()}
                </td>
                <td />
                <td />
                <td />
                <td />
                <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                  {(() => {
                    const m = median(payload.peers.map((p) => p.roce));
                    return m === null ? "—" : fmtPct(m);
                  })()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
