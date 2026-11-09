"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Info, X } from "lucide-react";

import { requireIndicatorDefinition } from "@/lib/technical/indicator-catalog";
import {
  type IndicatorDefinition,
  type IndicatorInputField,
  type IndicatorInstance,
  type LineStyle,
  type VisibilityTimeframe,
  CANDLE_SOURCE_LABELS,
  LINE_STYLES,
  LINE_WIDTHS,
  VISIBILITY_TIMEFRAMES,
  createDefaultInstance,
  withFillStyle,
  withInputValue,
  withLevelStyle,
  withLevelValue,
  withPlotStyle,
  withPrecision,
  withStatusFlags,
  withVisibility,
  withVisibilityRange,
  withWaitForClose,
} from "@/lib/technical/indicator-schema";
import { cn } from "@/lib/utils";

import {
  CheckboxField,
  ColorField,
  FieldRow,
  NumberField,
  OpacityField,
  SelectField,
} from "./indicator-fields";

const TABS = [
  { id: "inputs", label: "Inputs" },
  { id: "style", label: "Style" },
  { id: "visibility", label: "Visibility" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const PRECISION_OPTIONS = [
  { value: "", label: "Default" },
  ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((value) => ({
    value: String(value),
    label: String(value),
  })),
];

/** Full possible span per unit, for positioning the range track. */
const VISIBILITY_SCALE: Readonly<Record<VisibilityTimeframe, number>> = {
  ticks: 1,
  seconds: 59,
  minutes: 59,
  hours: 24,
  days: 366,
  weeks: 52,
  months: 12,
};

const TIMEFRAME_LABELS: Readonly<Record<VisibilityTimeframe, string>> = {
  ticks: "Ticks",
  seconds: "Seconds",
  minutes: "Minutes",
  hours: "Hours",
  days: "Days",
  weeks: "Weeks",
  months: "Months",
};

export interface IndicatorSettingsDialogProps {
  /**
   * The instance being edited. Callers render this dialog conditionally and
   * key it by `instanceId` so each edit session starts from a fresh draft.
   */
  readonly instance: IndicatorInstance;
  readonly initialTab?: TabId;
  readonly onApply: (instance: IndicatorInstance) => void;
  readonly onClose: () => void;
  readonly onSaveAsDefault?: (instance: IndicatorInstance) => void;
  readonly onClearDefault?: (definitionId: string) => void;
}

/**
 * Renders whatever properties the indicator declares in the catalog: nothing
 * about a specific indicator is hard-coded here, so adding a definition is
 * enough to make it fully configurable.
 */
export default function IndicatorSettingsDialog({
  instance,
  initialTab = "inputs",
  onApply,
  onClose,
  onSaveAsDefault,
  onClearDefault,
}: IndicatorSettingsDialogProps) {
  const [draft, setDraft] = useState<IndicatorInstance>(instance);
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [defaultsOpen, setDefaultsOpen] = useState(false);

  const definition = useMemo(
    () => requireIndicatorDefinition(draft.definitionId),
    [draft.definitionId],
  );

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [onClose]);

  const visibleTabs = TABS.filter(
    (tab) => tab.id !== "inputs" || definition.inputs.length > 0,
  );

  const handleDefaultsAction = (action: string) => {
    setDefaultsOpen(false);
    if (action === "reset") {
      setDraft(createDefaultInstance(definition, draft.instanceId));
      return;
    }
    if (action === "save") {
      onSaveAsDefault?.(draft);
      return;
    }
    if (action === "clear") {
      onClearDefault?.(definition.id);
    }
  };

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
        aria-label={`${definition.name} settings`}
        className="flex max-h-[85vh] w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 pb-1 pt-4">
          <h2 className="text-[20px] font-bold text-foreground">
            {definition.name}
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
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "-mb-px border-b-[3px] pb-1.5 pt-2 text-[15px]",
                activeTab === tab.id
                  ? "border-foreground font-bold text-foreground"
                  : "border-transparent text-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="mx-5 border-b border-border" />

        <div className="min-h-[180px] flex-1 overflow-y-auto px-5 py-3">
          {activeTab === "inputs" && (
            <InputsTab
              definition={definition}
              draft={draft}
              onChange={setDraft}
            />
          )}
          {activeTab === "style" && (
            <StyleTab
              definition={definition}
              draft={draft}
              onChange={setDraft}
            />
          )}
          {activeTab === "visibility" && (
            <VisibilityTab draft={draft} onChange={setDraft} />
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setDefaultsOpen((open) => !open)}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3.5 text-[14px] text-foreground hover:bg-muted"
            >
              Defaults
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
            {defaultsOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onMouseDown={() => setDefaultsOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute bottom-10 left-0 z-20 min-w-44 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-[0_8px_30px_rgba(0,0,0,0.14)]"
                >
                  <DefaultsItem
                    label="Reset settings"
                    onClick={() => handleDefaultsAction("reset")}
                  />
                  {onSaveAsDefault && (
                    <DefaultsItem
                      label="Save as default"
                      onClick={() => handleDefaultsAction("save")}
                    />
                  )}
                  {onClearDefault && (
                    <DefaultsItem
                      label="Clear saved default"
                      onClick={() => handleDefaultsAction("clear")}
                    />
                  )}
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg border border-foreground px-5 text-[14px] text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(draft);
                onClose();
              }}
              className="h-9 rounded-lg bg-foreground px-5 text-[14px] font-semibold text-primary-foreground hover:bg-foreground/90"
            >
              Ok
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DefaultsItem({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="block w-full px-4 py-2 text-left text-[14px] text-foreground hover:bg-muted"
    >
      {label}
    </button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground first:pt-0">
      {children}
    </p>
  );
}

function InputsTab({
  definition,
  draft,
  onChange,
}: {
  definition: IndicatorDefinition;
  draft: IndicatorInstance;
  onChange: (instance: IndicatorInstance) => void;
}) {
  const groups = useMemo(() => {
    const ordered: { name: string | null; fields: IndicatorInputField[] }[] =
      [];
    for (const field of definition.inputs) {
      const name = field.group ?? null;
      const group = ordered.find((entry) => entry.name === name);
      if (group) group.fields.push(field);
      else ordered.push({ name, fields: [field] });
    }
    return ordered;
  }, [definition]);

  return (
    <div>
      {groups.map((group) => (
        <div key={group.name ?? "general"}>
          {group.name && <SectionTitle>{group.name}</SectionTitle>}
          {group.fields.map((field) => (
            <div key={field.id} className="py-0.5">
              {field.kind === "boolean" ? (
                <div className="flex items-center gap-2 py-1.5">
                  <CheckboxField
                    id={`${draft.instanceId}-${field.id}`}
                    label={field.label}
                    checked={draft.inputs[field.id] === true}
                    onChange={(value) =>
                      onChange(withInputValue(definition, draft, field.id, value))
                    }
                  />
                  {field.help && (
                    <span title={field.help} aria-label={field.help}>
                      <Info className="h-4 w-4 text-muted-foreground/70" />
                    </span>
                  )}
                </div>
              ) : (
                <FieldRow
                  label={field.label}
                  htmlFor={`${draft.instanceId}-${field.id}`}
                >
                  {field.help && (
                    <span title={field.help} aria-label={field.help}>
                      <Info className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                    </span>
                  )}
                  <InputControl
                    field={field}
                    instance={draft}
                    onChange={(value) =>
                      onChange(withInputValue(definition, draft, field.id, value))
                    }
                  />
                </FieldRow>
              )}
            </div>
          ))}
        </div>
      ))}

      <SectionTitle>Calculation</SectionTitle>
      <FieldRow label="Timeframe" htmlFor={`${draft.instanceId}-timeframe`}>
        <SelectField
          id={`${draft.instanceId}-timeframe`}
          value="chart"
          options={[{ value: "chart", label: "Chart" }]}
          onChange={() => undefined}
        />
        <span title="Indicators calculate from the chart data">
          <Info className="h-4 w-4 shrink-0 text-muted-foreground/70" />
        </span>
      </FieldRow>
      <div className="flex items-center gap-2 py-1.5">
        <CheckboxField
          id={`${draft.instanceId}-wait-close`}
          label="Wait for timeframe closes"
          checked={draft.waitForClose}
          onChange={(waitForClose) => onChange(withWaitForClose(draft, waitForClose))}
        />
      </div>
    </div>
  );
}

function InputControl({
  field,
  instance,
  onChange,
}: {
  field: IndicatorInputField;
  instance: IndicatorInstance;
  onChange: (value: unknown) => void;
}) {
  const controlId = `${instance.instanceId}-${field.id}`;
  const value = instance.inputs[field.id];

  switch (field.kind) {
    case "number":
      return (
        <NumberField
          id={controlId}
          value={typeof value === "number" ? value : field.defaultValue}
          step={field.step}
          minimum={field.minimum}
          maximum={field.maximum}
          onCommit={onChange}
        />
      );
    case "source":
      return (
        <SelectField
          id={controlId}
          value={String(value)}
          options={field.allowed.map((source) => ({
            value: source,
            label: CANDLE_SOURCE_LABELS[source],
          }))}
          onChange={onChange}
        />
      );
    case "select":
      return (
        <SelectField
          id={controlId}
          value={String(value)}
          options={field.options}
          onChange={onChange}
        />
      );
    case "boolean":
      return (
        <CheckboxField
          id={controlId}
          checked={value === true}
          onChange={onChange}
        />
      );
  }
}

function StyleTab({
  definition,
  draft,
  onChange,
}: {
  definition: IndicatorDefinition;
  draft: IndicatorInstance;
  onChange: (instance: IndicatorInstance) => void;
}) {
  return (
    <div className="space-y-2">
      <section className="space-y-0.5">
        {definition.plots.map((plot) => {
          const style = draft.plotStyles[plot.id];
          const usesDirectionColors = plot.colorMode !== "fixed";
          return (
            <div
              key={plot.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-1"
            >
              <CheckboxField
                id={`${draft.instanceId}-plot-${plot.id}`}
                label={plot.label}
                checked={style.visible}
                onChange={(visible) =>
                  onChange(withPlotStyle(draft, plot.id, { visible }))
                }
              />
              <div className="flex items-center gap-2">
                {usesDirectionColors ? (
                  <>
                    <ColorField
                      title={plot.colorMode === "sign" ? "Positive" : "Up"}
                      disabled={!style.visible}
                      value={style.upColor}
                      onChange={(upColor) =>
                        onChange(withPlotStyle(draft, plot.id, { upColor }))
                      }
                    />
                    <ColorField
                      title={plot.colorMode === "sign" ? "Negative" : "Down"}
                      disabled={!style.visible}
                      value={style.downColor}
                      onChange={(downColor) =>
                        onChange(withPlotStyle(draft, plot.id, { downColor }))
                      }
                    />
                  </>
                ) : (
                  <ColorField
                    title="Colour"
                    disabled={!style.visible}
                    value={style.color}
                    onChange={(color) =>
                      onChange(withPlotStyle(draft, plot.id, { color }))
                    }
                  />
                )}
                {plot.kind === "line" ? (
                  <LinePreviewButton
                    disabled={!style.visible}
                    color={
                      usesDirectionColors ? style.upColor : style.color
                    }
                    lineWidth={style.lineWidth}
                    lineStyle={style.lineStyle}
                    onChange={(patch) =>
                      onChange(withPlotStyle(draft, plot.id, patch))
                    }
                  />
                ) : (
                  <OpacityField
                    disabled={!style.visible}
                    value={style.opacity}
                    onChange={(opacity) =>
                      onChange(withPlotStyle(draft, plot.id, { opacity }))
                    }
                  />
                )}
              </div>
            </div>
          );
        })}
      </section>

      {definition.levels.length > 0 && (
        <section className="space-y-0.5">
          {definition.levels.map((levelDefinition) => {
            const style = draft.levelStyles[levelDefinition.id];
            return (
              <div
                key={levelDefinition.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-1"
              >
                <CheckboxField
                  id={`${draft.instanceId}-level-${levelDefinition.id}`}
                  label={levelDefinition.label}
                  checked={style.visible}
                  onChange={(visible) =>
                    onChange(
                      withLevelStyle(draft, levelDefinition.id, { visible }),
                    )
                  }
                />
                <div className="flex items-center gap-2">
                  <ColorField
                    title="Colour"
                    disabled={!style.visible}
                    value={style.color}
                    onChange={(color) =>
                      onChange(
                        withLevelStyle(draft, levelDefinition.id, { color }),
                      )
                    }
                  />
                  <LinePreviewButton
                    disabled={!style.visible}
                    color={style.color}
                    lineWidth={style.lineWidth}
                    lineStyle={style.lineStyle}
                    onChange={(patch) =>
                      onChange(withLevelStyle(draft, levelDefinition.id, patch))
                    }
                  />
                  {levelDefinition.editable && (
                    <div className="w-[72px]">
                      <NumberField
                        id={`${draft.instanceId}-level-value-${levelDefinition.id}`}
                        value={draft.levelValues[levelDefinition.id]}
                        minimum={levelDefinition.minimum}
                        maximum={levelDefinition.maximum}
                        onCommit={(value) =>
                          onChange(
                            withLevelValue(
                              definition,
                              draft,
                              levelDefinition.id,
                              value,
                            ),
                          )
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {definition.fills.length > 0 && (
        <section className="space-y-0.5">
          {definition.fills.map((fillDefinition) => {
            const style = draft.fillStyles[fillDefinition.id];
            return (
              <div
                key={fillDefinition.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-1"
              >
                <CheckboxField
                  id={`${draft.instanceId}-fill-${fillDefinition.id}`}
                  label={fillDefinition.label}
                  checked={style.visible}
                  onChange={(visible) =>
                    onChange(
                      withFillStyle(draft, fillDefinition.id, { visible }),
                    )
                  }
                />
                <div className="flex items-center gap-2">
                  <ColorField
                    title="Colour"
                    disabled={!style.visible}
                    value={style.color}
                    onChange={(color) =>
                      onChange(
                        withFillStyle(draft, fillDefinition.id, { color }),
                      )
                    }
                  />
                  <OpacityField
                    disabled={!style.visible}
                    value={style.opacity}
                    onChange={(opacity) =>
                      onChange(
                        withFillStyle(draft, fillDefinition.id, { opacity }),
                      )
                    }
                  />
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section>
        <SectionTitle>Output values</SectionTitle>
        <FieldRow label="Precision" htmlFor={`${draft.instanceId}-precision`}>
          <SelectField
            id={`${draft.instanceId}-precision`}
            value={draft.precision === null ? "" : String(draft.precision)}
            options={PRECISION_OPTIONS}
            onChange={(value) =>
              onChange(withPrecision(draft, value === "" ? null : Number(value)))
            }
          />
        </FieldRow>
        <div className="py-1">
          <CheckboxField
            id={`${draft.instanceId}-labels-scale`}
            label="Labels on price scale"
            checked={draft.labelsOnScale}
            onChange={(labelsOnScale) =>
              onChange(withStatusFlags(draft, { labelsOnScale }))
            }
          />
        </div>
        <div className="py-1">
          <CheckboxField
            id={`${draft.instanceId}-values-status`}
            label="Values in status line"
            checked={draft.valuesInStatus}
            onChange={(valuesInStatus) =>
              onChange(withStatusFlags(draft, { valuesInStatus }))
            }
          />
        </div>
      </section>

      <section>
        <SectionTitle>Input values</SectionTitle>
        <div className="py-1">
          <CheckboxField
            id={`${draft.instanceId}-inputs-status`}
            label="Inputs in status line"
            checked={draft.inputsInStatus}
            onChange={(inputsInStatus) =>
              onChange(withStatusFlags(draft, { inputsInStatus }))
            }
          />
        </div>
      </section>
    </div>
  );
}

/** Line sample button opening width + style choices, like TradingView. */
function LinePreviewButton({
  disabled,
  color,
  lineWidth,
  lineStyle,
  onChange,
}: {
  disabled?: boolean;
  color: string;
  lineWidth: number;
  lineStyle: LineStyle;
  onChange: (patch: { lineWidth?: number; lineStyle?: LineStyle }) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        title="Line style"
        aria-label="Line style"
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-14 items-center justify-center rounded-lg border border-border bg-card hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
      >
        <LineSample color={color} lineWidth={lineWidth} lineStyle={lineStyle} />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onMouseDown={() => setOpen(false)}
          />
          <div className="absolute right-0 top-10 z-20 w-36 rounded-lg border border-border bg-card p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.14)]">
            {LINE_WIDTHS.map((width) => (
              <button
                key={width}
                type="button"
                onClick={() => {
                  onChange({ lineWidth: width });
                }}
                className="flex w-full items-center gap-1 rounded px-2 py-1.5 hover:bg-muted"
              >
                <LineSample
                  color={color}
                  lineWidth={width}
                  lineStyle={lineStyle}
                />
                {width === lineWidth && (
                  <Check className="ml-auto h-3.5 w-3.5 text-primary" />
                )}
              </button>
            ))}
            <div className="my-1 border-t border-border" />
            {LINE_STYLES.map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => {
                  onChange({ lineStyle: style });
                  setOpen(false);
                }}
                className="flex w-full items-center gap-1 rounded px-2 py-1.5 hover:bg-muted"
              >
                <LineSample
                  color={color}
                  lineWidth={lineWidth}
                  lineStyle={style}
                />
                {style === lineStyle && (
                  <Check className="ml-auto h-3.5 w-3.5 text-primary" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LineSample({
  color,
  lineWidth,
  lineStyle,
}: {
  color: string;
  lineWidth: number;
  lineStyle: LineStyle;
}) {
  return (
    <svg width="40" height="10" aria-hidden>
      <line
        x1="2"
        y1="5"
        x2="38"
        y2="5"
        stroke={color}
        strokeWidth={Math.min(4, Math.max(1, lineWidth))}
        strokeDasharray={
          lineStyle === "dashed"
            ? "5 3"
            : lineStyle === "dotted"
              ? "2 2"
              : undefined
        }
        strokeLinecap="round"
      />
    </svg>
  );
}

function VisibilityTab({
  draft,
  onChange,
}: {
  draft: IndicatorInstance;
  onChange: (instance: IndicatorInstance) => void;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-3 py-1.5">
        <div className="w-24 shrink-0">
          <CheckboxField
            id={`${draft.instanceId}-visibility-ticks`}
            label="Ticks"
            checked={draft.visibility.ticks.enabled}
            onChange={(enabled) =>
              onChange(withVisibility(draft, "ticks", enabled))
            }
          />
        </div>
      </div>
      {(VISIBILITY_TIMEFRAMES.filter((unit) => unit !== "ticks") as Exclude<
        VisibilityTimeframe,
        "ticks"
      >[]).map((unit) => {
        const rule = draft.visibility[unit];
        const scale = VISIBILITY_SCALE[unit];
        const left = Math.max(0, Math.min(100, (rule.min / scale) * 100));
        const width = Math.max(
          0,
          Math.min(100 - left, ((rule.max - rule.min) / scale) * 100),
        );
        return (
          <div key={unit} className="flex items-center gap-3 py-1.5">
            <div className="w-24 shrink-0">
              <CheckboxField
                id={`${draft.instanceId}-visibility-${unit}`}
                label={TIMEFRAME_LABELS[unit]}
                checked={rule.enabled}
                onChange={(enabled) =>
                  onChange(withVisibility(draft, unit, enabled))
                }
              />
            </div>
            <div className="w-[72px] shrink-0">
              <NumberField
                id={`${draft.instanceId}-visibility-${unit}-min`}
                value={rule.min}
                minimum={1}
                maximum={scale}
                onCommit={(value) =>
                  onChange(
                    withVisibilityRange(draft, unit, Number(value), rule.max),
                  )
                }
              />
            </div>
            <div
              className="relative h-1.5 min-w-16 flex-1 rounded-full bg-border"
              aria-hidden
            >
              <div
                className="absolute top-0 h-1.5 rounded-full bg-foreground"
                style={{ left: `${left}%`, width: `${width}%` }}
              />
              <div
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-foreground shadow"
                style={{ left: `${left}%` }}
              />
              <div
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-foreground shadow"
                style={{ left: `${left + width}%` }}
              />
            </div>
            <div className="w-[72px] shrink-0">
              <NumberField
                id={`${draft.instanceId}-visibility-${unit}-max`}
                value={rule.max}
                minimum={1}
                maximum={scale}
                onCommit={(value) =>
                  onChange(
                    withVisibilityRange(draft, unit, rule.min, Number(value)),
                  )
                }
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
