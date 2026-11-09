"use client";

import { useEffect, useRef, useState } from "react";
import { MOOD_ZONES } from "@/lib/market-mood/mood-index";

interface MarketMoodGaugeProps {
  /** 0..100, or null while unavailable (needle parks at the middle, greyed). */
  readonly value: number | null;
  readonly className?: string;
}

const WIDTH = 320;
const HEIGHT = 182;
const CX = WIDTH / 2;
const CY = 160;
const RADIUS = 128;
const STROKE = 20;
const GAP_DEG = 1.2;
const TICKS = [0, 25, 45, 55, 75, 100];
const NEEDLE_MS = 1_000;

function point(score: number, radius: number): { x: number; y: number } {
  const angle = Math.PI * (1 - score / 100);
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) };
}

function arc(from: number, to: number): string {
  const gap = (GAP_DEG / 180) * 100;
  const start = point(from === 0 ? from : from + gap / 2, RADIUS);
  const end = point(to === 100 ? to : to - gap / 2, RADIUS);
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 0 1 ${end.x} ${end.y}`;
}

export default function MarketMoodGauge({ value, className }: MarketMoodGaugeProps) {
  // Swing from the previous reading (0 on first paint) to the new one, so a
  // refresh that changes the score visibly moves the needle.
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);
  useEffect(() => {
    const from = shownRef.current;
    const to = Math.min(100, Math.max(0, value ?? 50));
    const settle = (): void => {
      shownRef.current = to;
      setShown(to);
    };
    const started = performance.now();
    let frame = 0;
    const step = (time: number): void => {
      const t = Math.min(1, (time - started) / NEEDLE_MS);
      const eased = 1 - (1 - t) ** 3;
      const next = from + (to - from) * eased;
      shownRef.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    // Background tabs get no animation frames; the timer still lands the
    // needle on the reading instead of leaving it at the old value.
    const settleTimer = window.setTimeout(() => {
      cancelAnimationFrame(frame);
      settle();
    }, NEEDLE_MS + 50);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
    };
  }, [value]);

  const needleLength = RADIUS - STROKE / 2 - 14;
  const tip = point(shown, needleLength);
  const angle = Math.PI * (1 - shown / 100);
  const baseOffset = { x: 4.5 * Math.sin(angle), y: 4.5 * Math.cos(angle) };

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={className}
      role="img"
      aria-label={
        value === null
          ? "Market Mood Index unavailable"
          : `Market Mood Index gauge at ${value.toFixed(1)} out of 100`
      }
    >
      <path
        d={`M ${CX - RADIUS} ${CY} A ${RADIUS} ${RADIUS} 0 0 1 ${CX + RADIUS} ${CY}`}
        fill="none"
        className="stroke-muted"
        strokeWidth={STROKE + 8}
        strokeLinecap="round"
      />
      {MOOD_ZONES.map((zone) => (
        <path
          key={zone.key}
          d={arc(zone.from, zone.to)}
          fill="none"
          stroke={zone.color}
          strokeWidth={STROKE}
          strokeLinecap="butt"
          opacity={value === null ? 0.35 : 1}
        />
      ))}

      {TICKS.map((tick) => {
        const inner = point(tick, RADIUS - STROKE / 2 - 4);
        const outer = point(tick, RADIUS - STROKE / 2 - 10);
        const label = point(tick, RADIUS - STROKE / 2 - 20);
        return (
          <g key={tick}>
            <line
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              className="stroke-muted-foreground/60"
              strokeWidth={1.5}
            />
            <text
              x={label.x}
              y={label.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 9, fontWeight: 600 }}
            >
              {tick}
            </text>
          </g>
        );
      })}

      <path
        d={`M ${CX - baseOffset.x} ${CY - baseOffset.y} L ${tip.x} ${tip.y} L ${CX + baseOffset.x} ${CY + baseOffset.y} Z`}
        className={value === null ? "fill-muted-foreground/50" : "fill-foreground"}
      />
      <circle cx={CX} cy={CY} r={9} className="fill-foreground" />
      <circle cx={CX} cy={CY} r={3.5} className="fill-card" />
    </svg>
  );
}
