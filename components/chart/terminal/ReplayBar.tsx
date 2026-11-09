"use client";

import { Pause, Play, SkipForward, X } from "lucide-react";
import { ToolbarButton } from "./ui";

export const REPLAY_SPEEDS: readonly { label: string; ms: number }[] = [
  { label: "1x", ms: 1000 },
  { label: "3x", ms: 330 },
  { label: "10x", ms: 100 },
];

interface ReplayBarProps {
  readonly mode: "select" | "ready";
  readonly playing: boolean;
  readonly speedIndex: number;
  readonly atEnd: boolean;
  readonly position: string;
  readonly onTogglePlay: () => void;
  readonly onStep: () => void;
  readonly onSpeed: (index: number) => void;
  readonly onExit: () => void;
}

export default function ReplayBar({
  mode,
  playing,
  speedIndex,
  atEnd,
  position,
  onTogglePlay,
  onStep,
  onSpeed,
  onExit,
}: ReplayBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Bar replay"
      className="pointer-events-auto flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 shadow-[0_4px_16px_rgba(0,0,0,0.14)]"
    >
      <span className="px-2 text-[12px] font-semibold text-foreground">
        Replay
      </span>
      {mode === "select" ? (
        <span className="px-2 text-[12px] text-muted-foreground">
          Click a bar on the chart to start from there
        </span>
      ) : (
        <>
          <ToolbarButton
            label={playing ? "Pause" : "Play"}
            onClick={onTogglePlay}
            disabled={atEnd}
          >
            {playing ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </ToolbarButton>
          <ToolbarButton
            label="Step forward one bar"
            onClick={onStep}
            disabled={atEnd}
          >
            <SkipForward className="h-4 w-4" />
          </ToolbarButton>
          <div className="mx-1 flex overflow-hidden rounded-md border border-border">
            {REPLAY_SPEEDS.map((speed, index) => (
              <button
                key={speed.label}
                type="button"
                aria-pressed={speedIndex === index}
                onClick={() => onSpeed(index)}
                className={`px-2 py-1 text-[12px] font-semibold ${
                  speedIndex === index
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                {speed.label}
              </button>
            ))}
          </div>
          <span className="px-2 font-mono text-[12px] text-muted-foreground">
            {position}
          </span>
        </>
      )}
      <ToolbarButton label="Exit replay" onClick={onExit}>
        <X className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}
