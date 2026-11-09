"use client";

import {
  Braces,
  Eye,
  EyeOff,
  MoreHorizontal,
  Settings,
  Trash2,
} from "lucide-react";

import { getIndicatorDefinition } from "@/lib/technical/indicator-catalog";
import {
  type IndicatorInstance,
  type IndicatorSeriesMap,
  formatIndicatorTitle,
  formatIndicatorValue,
  resolvePrecision,
  producesValues,
} from "@/lib/technical/indicator-schema";
import { cn } from "@/lib/utils";

export interface IndicatorLegendProps {
  readonly instances: readonly IndicatorInstance[];
  /** Computed series per instance id; omit to render titles without readouts. */
  readonly series?: Readonly<Record<string, IndicatorSeriesMap>>;
  /** Bar the readout reflects, normally the hovered bar or the last one. */
  readonly activeIndex?: number;
  readonly onToggleHidden: (instanceId: string) => void;
  readonly onOpenSettings: (instanceId: string) => void;
  readonly onShowSource: (instanceId: string) => void;
  readonly onOpenMenu: (instanceId: string, x: number, y: number) => void;
  readonly onRemove: (instanceId: string) => void;
  /** Hides the per-pane action buttons (Pane setting). */
  readonly hideActions?: boolean;
}

export default function IndicatorLegend({
  instances,
  series,
  activeIndex,
  onToggleHidden,
  onOpenSettings,
  onShowSource,
  onOpenMenu,
  onRemove,
  hideActions = false,
}: IndicatorLegendProps) {
  if (instances.length === 0) return null;

  return (
    <div className="flex w-fit flex-col gap-0.5">
      {instances.map((instance) => {
        const definition = getIndicatorDefinition(instance.definitionId);
        if (!definition) return null;

        const precision = resolvePrecision(definition, instance);
        const instanceSeries = series?.[instance.instanceId];
        const readouts =
          instance.valuesInStatus === false
            ? []
            : definition.plots
                .filter(
                  (plot) =>
                    instance.plotStyles[plot.id]?.visible &&
                    producesValues(instanceSeries?.[plot.id]),
                )
                .map((plot) => {
                  const values = instanceSeries?.[plot.id];
                  const index =
                    activeIndex ?? (values ? values.length - 1 : -1);
                  return {
                    plotId: plot.id,
                    color: instance.plotStyles[plot.id].color,
                    value:
                      values && index >= 0 ? (values[index] ?? null) : null,
                  };
                });

        return (
          <div
            key={instance.instanceId}
            className={cn(
              "group flex items-center gap-2 rounded border border-primary bg-popover/95 px-1.5 py-0.5 text-xs hover:border-primary",
              instance.hidden && "opacity-50",
            )}
          >
            <span className="whitespace-nowrap font-medium text-foreground">
              {formatIndicatorTitle(
                definition,
                instance,
                instance.inputsInStatus,
              )}
            </span>

            {instanceSeries && readouts.length > 0 && (
              <span className="flex items-center gap-1.5 tabular-nums">
                {readouts.map((readout) => (
                  <span key={readout.plotId} style={{ color: readout.color }}>
                    {formatIndicatorValue(readout.value, precision)}
                  </span>
                ))}
              </span>
            )}

            {!hideActions && (
              <span className="ml-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <LegendButton
                  label={instance.hidden ? "Show indicator" : "Hide indicator"}
                  onClick={() => onToggleHidden(instance.instanceId)}
                >
                  {instance.hidden ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </LegendButton>
                <LegendButton
                  label="Indicator settings"
                  onClick={() => onOpenSettings(instance.instanceId)}
                >
                  <Settings className="h-3.5 w-3.5" />
                </LegendButton>
                <LegendButton
                  label="Source code"
                  onClick={() => onShowSource(instance.instanceId)}
                >
                  <Braces className="h-3.5 w-3.5" />
                </LegendButton>
                <LegendButton
                  label="Remove indicator"
                  onClick={() => onRemove(instance.instanceId)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </LegendButton>
                <LegendButton
                  label="More actions"
                  onClick={(event) =>
                    onOpenMenu(
                      instance.instanceId,
                      event.clientX,
                      event.clientY,
                    )
                  }
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </LegendButton>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LegendButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
    >
      {children}
    </button>
  );
}
