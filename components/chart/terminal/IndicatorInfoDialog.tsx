"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { getIndicatorDefinition } from "@/lib/technical/indicator-catalog";
import {
  type IndicatorInstance,
  CANDLE_SOURCE_LABELS,
} from "@/lib/technical/indicator-schema";
import { cn } from "@/lib/utils";

export interface IndicatorInfoDialogProps {
  readonly instance: IndicatorInstance;
  readonly initialTab?: "about" | "source";
  readonly onClose: () => void;
  readonly onOpenSettings: () => void;
}

/**
 * "About this script..." / "Source code..." dialog: the indicator's real
 * catalog metadata (description, inputs, plots, bands) plus how it computes.
 */
export default function IndicatorInfoDialog({
  instance,
  initialTab = "about",
  onClose,
  onOpenSettings,
}: IndicatorInfoDialogProps) {
  const [tab, setTab] = useState<"about" | "source">(initialTab);
  const definition = getIndicatorDefinition(instance.definitionId);
  if (!definition) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`About ${definition.name}`}
        className="flex max-h-[85vh] w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 pb-1 pt-4">
          <h2 className="text-[20px] font-bold text-foreground">
            {definition.shortName} · {definition.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1.5 text-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-6 px-5">
          {(["about", "source"] as const).map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setTab(entry)}
              className={cn(
                "-mb-px border-b-[3px] pb-1.5 pt-2 text-[15px] capitalize",
                tab === entry
                  ? "border-foreground font-bold text-foreground"
                  : "border-transparent text-foreground hover:text-foreground",
              )}
            >
              {entry === "about" ? "About" : "Source code"}
            </button>
          ))}
        </div>
        <div className="mx-5 border-b border-border" />

        <div className="min-h-[120px] flex-1 overflow-y-auto px-5 py-4 text-[14px] text-foreground">
          {tab === "about" ? (
            <div className="space-y-3">
              <p className="leading-6">{definition.description}</p>
              <dl className="grid grid-cols-[140px_1fr] gap-y-1.5">
                <dt className="text-muted-foreground">Category</dt>
                <dd className="capitalize">{definition.category}</dd>
                <dt className="text-muted-foreground">Pane</dt>
                <dd className="capitalize">
                  {definition.pane === "price" ? "Price" : "Separate"}
                </dd>
                <dt className="text-muted-foreground">Precision</dt>
                <dd>{definition.defaultPrecision} decimals (default)</dd>
                <dt className="text-muted-foreground">Volume feed</dt>
                <dd>{definition.requiresVolume ? "Required" : "Not used"}</dd>
              </dl>
              <div>
                <p className="pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Inputs
                </p>
                <ul className="space-y-1">
                  {definition.inputs.map((field) => (
                    <li key={field.id} className="flex justify-between gap-4">
                      <span>{field.label}</span>
                      <span className="text-muted-foreground">
                        {field.kind === "source"
                          ? CANDLE_SOURCE_LABELS[
                              String(instance.inputs[field.id] ?? field.defaultValue) as keyof typeof CANDLE_SOURCE_LABELS
                            ]
                          : String(
                              instance.inputs[field.id] ?? field.defaultValue,
                            )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="leading-6 text-muted-foreground">
                Built-in compatible reimplementation — computed locally from
                the published formula, free with no plan gates.
              </p>
              <div>
                <p className="pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Plots
                </p>
                <ul className="space-y-1">
                  {definition.plots.map((plot) => (
                    <li key={plot.id} className="flex justify-between gap-4">
                      <span>{plot.label}</span>
                      <span className="capitalize text-muted-foreground">
                        {plot.kind} · {plot.colorMode}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              {definition.levels.length > 0 && (
                <div>
                  <p className="pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Bands
                  </p>
                  <ul className="space-y-1">
                    {definition.levels.map((level) => (
                      <li key={level.id} className="flex justify-between gap-4">
                        <span>{level.label}</span>
                        <span className="text-muted-foreground">
                          {instance.levelValues[level.id] ?? level.defaultValue}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-foreground px-5 text-[14px] text-foreground hover:bg-muted"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenSettings();
              onClose();
            }}
            className="h-9 rounded-lg bg-foreground px-5 text-[14px] font-semibold text-primary-foreground hover:bg-foreground/90"
          >
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}
