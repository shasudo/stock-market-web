"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Gauge, Info, RefreshCw } from "lucide-react";
import MarketMoodGauge from "@/components/MarketMoodGauge";
import { PageShell } from "@/components/common/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import {
  MOOD_ZONES,
  moodZoneFor,
  type MoodFactorScore,
  type MoodZone,
} from "@/lib/market-mood/mood-index";
import {
  fetchMoodIndex,
  getMoodIndexClientErrorMessage,
  isMoodIndexRequestAborted,
  type MoodIndexSnapshot,
} from "@/lib/market-mood/mood-index-client";
import type { MoodHistoryPoint } from "@/lib/market-mood/mood-index-client";

const REFRESH_INTERVAL_MS = 60_000;
const CARD =
  "rounded-2xl border border-border/80 bg-card shadow-[0_2px_12px_rgba(0,0,0,0.04)]";

/** Dark text on the light zone colors (yellow, lime), white on the rest. */
function onZone(zone: MoodZone): string {
  return zone.key === "neutral" || zone.key === "greed" ? "#1C1917" : "#FFFFFF";
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function ZonePill({ zone, size = "md" }: { zone: MoodZone; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold ${
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-sm"
      }`}
      style={{ backgroundColor: zone.color, color: onZone(zone) }}
    >
      {zone.name}
    </span>
  );
}

function FactorRow({ factor }: { factor: MoodFactorScore }) {
  const available = factor.score !== null;
  const zone = available ? moodZoneFor(factor.score as number) : null;
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">{factor.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{factor.detail}</p>
        </div>
        {available && zone ? (
          <div className="flex items-center gap-2">
            <span className="text-xl font-extrabold tabular-nums text-foreground">
              {(factor.score as number).toFixed(0)}
            </span>
            <ZonePill zone={zone} size="sm" />
          </div>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            Unavailable · not counted
          </span>
        )}
      </div>
      <div className="relative mt-2.5 h-2 rounded-full bg-muted overflow-hidden">
        {available && zone ? (
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
            style={{ width: `${factor.score}%`, backgroundColor: zone.color }}
          />
        ) : null}
        <div className="absolute inset-y-0 left-1/2 w-px bg-border" aria-hidden />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {factor.description}
      </p>
    </li>
  );
}

function TrendChart({ history }: { history: readonly MoodHistoryPoint[] }) {
  const width = 640;
  const height = 200;
  const padX = 28;
  const padY = 12;
  const axisSpace = 20;
  const plotBottom = height - axisSpace;
  const dateLabels = [...new Set([0, Math.floor((history.length - 1) / 2), history.length - 1])]
    .filter((index) => index >= 0 && history[index]);
  const x = (index: number): number =>
    history.length <= 1
      ? width / 2
      : padX + (index / (history.length - 1)) * (width - padX * 2);
  const y = (score: number): number =>
    padY + (1 - score / 100) * (plotBottom - padY);
  const line = history
    .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point.score)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Market Mood Index trend">
      {MOOD_ZONES.map((zone) => (
        <rect
          key={zone.key}
          x={padX}
          width={width - padX * 2}
          y={y(zone.to)}
          height={y(zone.from) - y(zone.to)}
          fill={zone.color}
          opacity={0.1}
        />
      ))}
      {[0, 25, 50, 75, 100].map((tick) => (
        <text
          key={tick}
          x={padX - 6}
          y={y(tick)}
          textAnchor="end"
          dominantBaseline="middle"
          className="fill-muted-foreground"
          style={{ fontSize: 10 }}
        >
          {tick}
        </text>
      ))}
      {dateLabels.map((index) => (
        <text
          key={`date-${index}`}
          x={x(index)}
          y={height - 4}
          textAnchor={index === 0 ? "start" : index === history.length - 1 ? "end" : "middle"}
          className="fill-muted-foreground"
          style={{ fontSize: 10 }}
        >
          {formatDate(history[index]!.date)}
        </text>
      ))}
      {history.length > 1 ? (
        <path d={line} fill="none" className="stroke-foreground" strokeWidth={2} strokeLinejoin="round" />
      ) : null}
      {history.map((point, index) => (
        <circle
          key={point.date}
          cx={x(index)}
          cy={y(point.score)}
          r={history.length > 40 ? 2 : 3.5}
          fill={moodZoneFor(point.score).color}
          className="stroke-card"
          strokeWidth={1.5}
        >
          <title>{`${formatDate(point.date)}: ${point.score.toFixed(1)} (${moodZoneFor(point.score).name})`}</title>
        </circle>
      ))}
    </svg>
  );
}

export default function MarketMoodPage() {
  const [snapshot, setSnapshot] = useState<MoodIndexSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    const load = async (): Promise<void> => {
      setLoading(true);
      try {
        const data = await fetchMoodIndex(controller.signal);
        if (!current) return;
        setSnapshot(data);
        setErrorMessage(null);
      } catch (error: unknown) {
        if (!current || isMoodIndexRequestAborted(error)) return;
        setErrorMessage(getMoodIndexClientErrorMessage(error));
      } finally {
        if (current) setLoading(false);
      }
    };
    void load();
    return () => {
      current = false;
      controller.abort();
    };
  }, [refreshVersion]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setRefreshVersion((version) => version + 1);
      }
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const refresh = useCallback(() => setRefreshVersion((version) => version + 1), []);

  const score = snapshot?.score ?? null;
  const zone = score !== null ? moodZoneFor(score) : null;
  const counted = useMemo(
    () => snapshot?.factors.filter((factor) => factor.score !== null).length ?? 0,
    [snapshot],
  );

  return (
    <div className="min-h-screen bg-background">
      <PageShell className="py-6">
        <PageHeader
          title="Market Mood Index"
          description="Live sentiment on the street — breadth, new highs, momentum, volatility, options and FII flows in one 0–100 reading"
          icon={Gauge}
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${errorMessage ? "bg-orange-500" : "bg-emerald-500 animate-pulse"}`} />
              {snapshot ? `Updated ${formatTime(snapshot.generatedAt)}` : loading ? "Loading…" : "Offline"}
            </span>
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </PageHeader>

        {errorMessage ? (
          <p role="alert" className="mb-4 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-700 dark:text-orange-300">
            {errorMessage}
            {snapshot ? " Showing the last loaded reading." : ""}
          </p>
        ) : null}

        {!snapshot && loading ? (
          <div className={`${CARD} flex h-80 items-center justify-center text-sm text-muted-foreground`}>
            Loading Market Mood Index…
          </div>
        ) : snapshot ? (
          <>
            <div className="grid gap-6 lg:grid-cols-5">
              <section className={`${CARD} p-5 sm:p-6 lg:col-span-2 flex flex-col`}>
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Today&apos;s mood
                </h2>
                <div className="mx-auto mt-2 w-full max-w-[380px]">
                  <MarketMoodGauge value={score} className="w-full h-auto" />
                </div>
                <div className="-mt-2 text-center">
                  <p className="text-5xl font-extrabold tabular-nums tracking-tight text-foreground">
                    {score !== null ? score.toFixed(1) : "—"}
                  </p>
                  <div className="mt-2 flex justify-center">
                    {zone ? <ZonePill zone={zone} /> : null}
                  </div>
                  <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    {zone ? zone.description : "Not enough live data to compute the index right now."}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Based on {counted} of {snapshot.factors.length} factors · market data synced {formatTime(snapshot.lastSyncAt)}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2.5">
                  {snapshot.comparisons.map((comparison) => {
                    const past = comparison.score !== null ? moodZoneFor(comparison.score) : null;
                    const delta =
                      comparison.score !== null && score !== null ? score - comparison.score : null;
                    return (
                      <div key={comparison.label} className="rounded-xl border border-border bg-background/60 px-3 py-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {comparison.label}
                        </p>
                        {comparison.score !== null && past ? (
                          <div className="mt-1 flex items-baseline gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: past.color }} />
                            <span className="text-lg font-bold tabular-nums text-foreground">
                              {comparison.score.toFixed(1)}
                            </span>
                            {delta !== null ? (
                              <span className={`text-xs font-semibold tabular-nums ${delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground">Not recorded yet</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className={`${CARD} p-5 sm:p-6 lg:col-span-3`}>
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h2 className="text-base font-extrabold text-foreground">What&apos;s driving the mood</h2>
                  <span className="hidden text-xs text-muted-foreground sm:inline">0 = extreme fear · 100 = extreme greed</span>
                </div>
                <ul className="divide-y divide-border">
                  {snapshot.factors.map((factor) => (
                    <FactorRow key={factor.key} factor={factor} />
                  ))}
                </ul>
              </section>
            </div>

            <section className={`${CARD} mt-6 p-5 sm:p-6`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-extrabold text-foreground">Mood trend</h2>
                <span className="text-xs text-muted-foreground">One reading per trading day</span>
              </div>
              {snapshot.history.length > 1 ? (
                <TrendChart history={snapshot.history} />
              ) : (
                <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  The index is recorded once per trading day
                  {snapshot.history[0] ? ` starting ${formatDate(snapshot.history[0].date)}` : ""}. The trend line
                  and the previous-day, week and month comparisons fill in as trading days pass.
                </div>
              )}
            </section>

            <section className="mt-6">
              <h2 className="mb-3 text-base font-extrabold text-foreground">Zones</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {MOOD_ZONES.map((item) => {
                  const active = zone?.key === item.key;
                  return (
                    <div
                      key={item.key}
                      className={`${CARD} relative overflow-hidden p-4 ${active ? "ring-2 ring-offset-2 ring-offset-background" : ""}`}
                      style={active ? ({ "--tw-ring-color": item.color } as React.CSSProperties) : undefined}
                    >
                      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: item.color }} />
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-extrabold" style={{ color: item.color }}>
                          {item.name}
                        </p>
                        <span className="whitespace-nowrap text-[11px] font-semibold tabular-nums text-muted-foreground">
                          {item.from}–{item.to}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                      {active ? (
                        <span className="mt-2 inline-block rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-background">
                          Now
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className={`${CARD} mt-6 p-5 sm:p-6`}>
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-base font-extrabold text-foreground">How it&apos;s calculated</h2>
              </div>
              <div className="mt-3 grid gap-3 text-sm leading-relaxed text-muted-foreground md:grid-cols-2">
                <p>
                  Each factor is scored from 0 (extreme fear) to 100 (extreme greed) and the index is their
                  simple average. A factor whose live data is missing is shown as unavailable and left out of
                  the average rather than counted as neutral. The index refreshes every minute during the
                  session.
                </p>
                <p>
                  Sources: NSE + BSE advances/declines and 52-week highs/lows from the live quote feed, NIFTY 50
                  daily closes, India VIX, NIFTY nearest-expiry option open interest, and NSE&apos;s FII/DII
                  cash-market data. This is a transparent in-house methodology, not a copy of any third-party
                  index. It is not investment advice.
                </p>
              </div>
            </section>
          </>
        ) : null}
      </PageShell>
    </div>
  );
}
