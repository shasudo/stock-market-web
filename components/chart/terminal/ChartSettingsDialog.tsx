"use client";

import { useState } from "react";
import { X } from "lucide-react";

import {
  ALERT_SOUNDS,
  DATE_FORMATS,
  DEFAULT_DISPLAY_SETTINGS,
  TIMEZONES,
  deleteDisplayTemplate,
  loadDisplayTemplates,
  saveDisplayTemplate,
  type AlertSoundName,
  type ButtonVisibility,
  type ChartDisplaySettings,
  type DisplayTemplate,
  type HighLowMode,
  type HoursFormat,
  type LastValueMode,
  type PriceScaleMode,
  type ScalePlacement,
  type TitleMode,
} from "@/lib/chart/display-settings";
import {
  CheckboxField,
  ColorField,
  FieldRow,
  LineStyleField,
  NumberField,
  OpacityField,
  SelectField,
} from "../indicator-fields";

const SECTIONS = [
  { id: "symbol", label: "Symbol" },
  { id: "status", label: "Status line" },
  { id: "scales", label: "Scales and lines" },
  { id: "canvas", label: "Canvas" },
  { id: "trading", label: "Trading" },
  { id: "alerts", label: "Alerts" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export interface ChartSettingsDialogProps {
  readonly initial: ChartDisplaySettings;
  readonly onApply: (settings: ChartDisplaySettings) => void;
  readonly onClose: () => void;
}

function toInt(
  raw: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="pb-1 pt-3 text-[12px] font-semibold text-muted-foreground">
      {children}
    </p>
  );
}

function DualColor({
  id,
  label,
  enabled,
  onEnabled,
  up,
  down,
  onUp,
  onDown,
}: {
  id: string;
  label: string;
  enabled?: boolean;
  onEnabled?: (value: boolean) => void;
  up: string;
  down: string;
  onUp: (value: string) => void;
  onDown: (value: string) => void;
}) {
  return (
    <FieldRow label={label} htmlFor={onEnabled ? `${id}-toggle` : undefined}>
      {onEnabled !== undefined && (
        <CheckboxField
          id={`${id}-toggle`}
          checked={enabled ?? true}
          onChange={onEnabled}
        />
      )}
      <ColorField value={up} onChange={onUp} title={`${label} up`} />
      <ColorField value={down} onChange={onDown} title={`${label} down`} />
    </FieldRow>
  );
}

function SymbolSection({
  draft,
  patch,
}: {
  draft: ChartDisplaySettings;
  patch: (part: Partial<ChartDisplaySettings>) => void;
}) {
  return (
    <div>
      <GroupTitle>Candles</GroupTitle>
      <div className="py-1.5">
        <CheckboxField
          id="cs-prev-close"
          label="Color bars based on previous close"
          checked={draft.colorByPrevClose}
          onChange={(colorByPrevClose) => patch({ colorByPrevClose })}
        />
      </div>
      <DualColor
        id="cs-body"
        label="Body"
        up={draft.bodyUp}
        down={draft.bodyDown}
        onUp={(bodyUp) => patch({ bodyUp })}
        onDown={(bodyDown) => patch({ bodyDown })}
      />
      <DualColor
        id="cs-border"
        label="Borders"
        enabled={draft.showBorder}
        onEnabled={(showBorder) => patch({ showBorder })}
        up={draft.borderUp}
        down={draft.borderDown}
        onUp={(borderUp) => patch({ borderUp })}
        onDown={(borderDown) => patch({ borderDown })}
      />
      <DualColor
        id="cs-wick"
        label="Wick"
        enabled={draft.showWick}
        onEnabled={(showWick) => patch({ showWick })}
        up={draft.wickUp}
        down={draft.wickDown}
        onUp={(wickUp) => patch({ wickUp })}
        onDown={(wickDown) => patch({ wickDown })}
      />
      <GroupTitle>Data modification</GroupTitle>
      <FieldRow label="Precision" htmlFor="cs-precision">
        <SelectField
          id="cs-precision"
          value={String(draft.precision)}
          options={[0, 1, 2, 3, 4, 5, 6, 7, 8].map((value) => ({
            value: String(value),
            label: String(value),
          }))}
          onChange={(value) =>
            patch({ precision: toInt(value, draft.precision, 0, 8) })
          }
        />
      </FieldRow>
      <FieldRow label="Timezone" htmlFor="cs-timezone">
        <SelectField
          id="cs-timezone"
          value={draft.timezone}
          options={TIMEZONES}
          onChange={(timezone) => patch({ timezone })}
        />
      </FieldRow>
    </div>
  );
}

function StatusSection({
  draft,
  patch,
}: {
  draft: ChartDisplaySettings;
  patch: (part: Partial<ChartDisplaySettings>) => void;
}) {
  return (
    <div>
      <GroupTitle>Instrument</GroupTitle>
      <div className="flex flex-col gap-1 py-1">
        <CheckboxField
          id="sl-logo"
          label="Logo"
          checked={draft.showLogo}
          onChange={(showLogo) => patch({ showLogo })}
        />
        <FieldRow label="Title" htmlFor="sl-title">
          <SelectField
            id="sl-title"
            value={draft.titleMode}
            options={[
              { value: "name", label: "Name" },
              { value: "symbol", label: "Symbol" },
            ]}
            onChange={(value) => patch({ titleMode: value as TitleMode })}
          />
        </FieldRow>
        <CheckboxField
          id="sl-values"
          label="Chart values"
          checked={draft.showChartValues}
          onChange={(showChartValues) => patch({ showChartValues })}
        />
        <CheckboxField
          id="sl-bar-change"
          label="Bar change values"
          checked={draft.showBarChange}
          onChange={(showBarChange) => patch({ showBarChange })}
        />
        <CheckboxField
          id="sl-volume"
          label="Volume"
          checked={draft.showStatusVolume}
          onChange={(showStatusVolume) => patch({ showStatusVolume })}
        />
        <CheckboxField
          id="sl-day-change"
          label="Last day change values"
          checked={draft.showDayChange}
          onChange={(showDayChange) => patch({ showDayChange })}
        />
        <CheckboxField
          id="sl-buysell"
          label="Buy/sell buttons"
          checked={draft.showBuySell}
          onChange={(showBuySell) => patch({ showBuySell })}
        />
        <p className="-mt-1 pl-6 text-[12px] text-muted-foreground">
          Displays buy and sell buttons directly on the chart
        </p>
        <FieldRow label="Background" htmlFor="sl-opacity">
          <span id="sl-opacity">
            <OpacityField
              value={draft.statusOpacity}
              onChange={(statusOpacity) => patch({ statusOpacity })}
            />
          </span>
        </FieldRow>
      </div>
    </div>
  );
}

const VISIBILITY_OPTIONS: readonly {
  readonly value: ButtonVisibility;
  readonly label: string;
}[] = [
  { value: "always", label: "Always visible" },
  { value: "hover", label: "Visible on mouse over" },
  { value: "hidden", label: "Hidden" },
];

function ScalesSection({
  draft,
  patch,
}: {
  draft: ChartDisplaySettings;
  patch: (part: Partial<ChartDisplaySettings>) => void;
}) {
  return (
    <div>
      <GroupTitle>Price scale</GroupTitle>
      <div className="flex flex-col gap-1 py-1">
        <CheckboxField
          id="sc-currency"
          label="Currency and unit (₹ suffix on the price axis)"
          checked={draft.showCurrency}
          onChange={(showCurrency) => patch({ showCurrency })}
        />
        <FieldRow label="Scale modes (A and L)" htmlFor="sc-modes">
          <SelectField
            id="sc-modes"
            value={draft.scaleButtons}
            options={VISIBILITY_OPTIONS}
            onChange={(value) =>
              patch({ scaleButtons: value as ButtonVisibility })
            }
          />
        </FieldRow>
        <FieldRow label="Scales placement" htmlFor="sc-placement">
          <SelectField
            id="sc-placement"
            value={draft.scalePlacement}
            options={[
              { value: "right", label: "Right" },
              { value: "left", label: "Left" },
            ]}
            onChange={(value) =>
              patch({ scalePlacement: value as ScalePlacement })
            }
          />
        </FieldRow>
        <FieldRow label="Scale mode" htmlFor="sc-psmode">
          <SelectField
            id="sc-psmode"
            value={draft.priceScaleMode}
            options={[
              { value: "regular", label: "Regular" },
              { value: "percent", label: "Percent" },
              { value: "indexed", label: "Indexed to 100" },
              { value: "log", label: "Logarithmic" },
            ]}
            onChange={(value) =>
              patch({ priceScaleMode: value as PriceScaleMode })
            }
          />
        </FieldRow>
        <CheckboxField
          id="sc-autoscale"
          label="Auto scale (fit data to screen)"
          checked={draft.priceAutoScale}
          onChange={(priceAutoScale) => patch({ priceAutoScale })}
        />
        <CheckboxField
          id="sc-invert"
          label="Invert scale"
          checked={draft.invertScale}
          onChange={(invertScale) => patch({ invertScale })}
        />
        <CheckboxField
          id="sc-priceonly"
          label="Scale price chart only"
          checked={draft.scalePriceOnly}
          onChange={(scalePriceOnly) => patch({ scalePriceOnly })}
        />
        <CheckboxField
          id="sc-ratiolock"
          label="Lock price to bar ratio"
          checked={draft.lockPriceBarRatio}
          onChange={(lockPriceBarRatio) =>
            patch(
              lockPriceBarRatio
                ? {
                    lockPriceBarRatio,
                    priceAutoScale: false,
                    pricePerBar: 0,
                  }
                : { lockPriceBarRatio },
            )
          }
        />
      </div>
      <GroupTitle>Price labels and lines</GroupTitle>
      <div className="flex flex-col gap-1 py-1">
        <CheckboxField
          id="sc-countdown"
          label="Countdown to bar close"
          checked={draft.showCountdown}
          onChange={(showCountdown) => patch({ showCountdown })}
        />
        <FieldRow label="Symbol last value" htmlFor="sc-last">
          <SelectField
            id="sc-last"
            value={draft.lastValue}
            options={[
              { value: "value-line", label: "Value, line" },
              { value: "value", label: "Value" },
              { value: "line", label: "Line" },
              { value: "hidden", label: "Hidden" },
            ]}
            onChange={(value) => patch({ lastValue: value as LastValueMode })}
          />
        </FieldRow>
        <FieldRow label="High and low" htmlFor="sc-highlow">
          <SelectField
            id="sc-highlow"
            value={draft.highLow}
            options={[
              { value: "hidden", label: "Hidden" },
              { value: "value-line", label: "Value, line" },
            ]}
            onChange={(value) => patch({ highLow: value as HighLowMode })}
          />
        </FieldRow>
      </div>
      <GroupTitle>Time scale</GroupTitle>
      <div className="flex flex-col gap-1 py-1">
        <CheckboxField
          id="sc-dow"
          label="Day of week on labels"
          checked={draft.showDayOfWeek}
          onChange={(showDayOfWeek) => patch({ showDayOfWeek })}
        />
        <FieldRow label="Date format" htmlFor="sc-date">
          <SelectField
            id="sc-date"
            value={draft.dateFormat}
            options={DATE_FORMATS}
            onChange={(dateFormat) => patch({ dateFormat })}
          />
        </FieldRow>
        <FieldRow label="Time hours format" htmlFor="sc-hours">
          <SelectField
            id="sc-hours"
            value={draft.hoursFormat}
            options={[
              { value: "24", label: "24-hours" },
              { value: "12", label: "12-hours" },
            ]}
            onChange={(value) => patch({ hoursFormat: value as HoursFormat })}
          />
        </FieldRow>
        <CheckboxField
          id="sc-edge"
          label="Save chart left edge position when changing interval"
          checked={draft.keepLeftEdge}
          onChange={(keepLeftEdge) => patch({ keepLeftEdge })}
        />
      </div>
    </div>
  );
}

function CanvasSection({
  draft,
  patch,
}: {
  draft: ChartDisplaySettings;
  patch: (part: Partial<ChartDisplaySettings>) => void;
}) {
  return (
    <div>
      <GroupTitle>Chart basic styles</GroupTitle>
      <FieldRow label="Background" htmlFor="cv-bg">
        <SelectField
          id="cv-bg"
          value="solid"
          options={[{ value: "solid", label: "Solid" }]}
          onChange={() => undefined}
        />
        <ColorField
          value={draft.canvasBackground}
          onChange={(canvasBackground) => patch({ canvasBackground })}
          title="Chart background"
        />
      </FieldRow>
      <div className="flex flex-col gap-1 py-1">
        <CheckboxField
          id="cv-vert"
          label="Vertical grid lines"
          checked={draft.showVertGrid}
          onChange={(showVertGrid) => patch({ showVertGrid })}
        />
        <CheckboxField
          id="cv-horz"
          label="Horizontal grid lines"
          checked={draft.showHorzGrid}
          onChange={(showHorzGrid) => patch({ showHorzGrid })}
        />
      </div>
      <FieldRow label="Crosshair" htmlFor="cv-cross">
        <ColorField
          value={draft.crosshairColor}
          onChange={(crosshairColor) => patch({ crosshairColor })}
          title="Crosshair color"
        />
        <span id="cv-cross">
          <LineStyleField
            value={draft.crosshairStyle}
            onChange={(crosshairStyle) => patch({ crosshairStyle })}
          />
        </span>
      </FieldRow>
      <FieldRow label="Watermark" htmlFor="cv-wm">
        <CheckboxField
          id="cv-wm"
          checked={draft.watermark}
          onChange={(watermark) => patch({ watermark })}
        />
        <ColorField
          value={draft.watermarkColor}
          onChange={(watermarkColor) => patch({ watermarkColor })}
          title="Watermark color"
        />
      </FieldRow>
      <GroupTitle>Scales</GroupTitle>
      <FieldRow label="Text" htmlFor="cv-text">
        <ColorField
          value={draft.axisTextColor}
          onChange={(axisTextColor) => patch({ axisTextColor })}
          title="Axis text color"
        />
        <SelectField
          id="cv-text"
          value={String(draft.axisFontSize)}
          options={[9, 10, 11, 12, 13, 14, 16, 18, 20].map((value) => ({
            value: String(value),
            label: String(value),
          }))}
          onChange={(value) =>
            patch({
              axisFontSize: toInt(value, draft.axisFontSize, 9, 20),
            })
          }
        />
      </FieldRow>
      <FieldRow label="Lines" htmlFor="cv-lines">
        <span id="cv-lines">
          <ColorField
            value={draft.axisLineColor}
            onChange={(axisLineColor) => patch({ axisLineColor })}
            title="Axis line color"
          />
        </span>
      </FieldRow>
      <GroupTitle>Buttons</GroupTitle>
      <FieldRow label="Navigation" htmlFor="cv-nav">
        <SelectField
          id="cv-nav"
          value={draft.navButtons}
          options={VISIBILITY_OPTIONS}
          onChange={(value) => patch({ navButtons: value as ButtonVisibility })}
        />
      </FieldRow>
      <FieldRow label="Pane" htmlFor="cv-pane">
        <CheckboxField
          id="cv-pane"
          label="Indicator legend buttons"
          checked={draft.paneButtons}
          onChange={(paneButtons) => patch({ paneButtons })}
        />
      </FieldRow>
      <GroupTitle>Margins</GroupTitle>
      <FieldRow label="Top %" htmlFor="cv-top">
        <NumberField
          id="cv-top"
          value={draft.marginTop}
          minimum={0}
          maximum={40}
          onCommit={(raw) =>
            patch({ marginTop: toInt(raw, draft.marginTop, 0, 40) })
          }
        />
      </FieldRow>
      <FieldRow label="Bottom %" htmlFor="cv-bottom">
        <NumberField
          id="cv-bottom"
          value={draft.marginBottom}
          minimum={0}
          maximum={60}
          onCommit={(raw) =>
            patch({ marginBottom: toInt(raw, draft.marginBottom, 0, 60) })
          }
        />
      </FieldRow>
      <FieldRow label="Right bars" htmlFor="cv-right">
        <NumberField
          id="cv-right"
          value={draft.marginRightBars}
          minimum={0}
          maximum={30}
          onCommit={(raw) =>
            patch({
              marginRightBars: toInt(raw, draft.marginRightBars, 0, 30),
            })
          }
        />
      </FieldRow>
    </div>
  );
}

function TradingSection({
  draft,
  patch,
}: {
  draft: ChartDisplaySettings;
  patch: (part: Partial<ChartDisplaySettings>) => void;
}) {
  return (
    <div>
      <GroupTitle>General</GroupTitle>
      <div className="flex flex-col gap-1 py-1">
        <CheckboxField
          id="tr-buysell"
          label="Buy/sell buttons"
          checked={draft.showBuySell}
          onChange={(showBuySell) => patch({ showBuySell })}
        />
        <p className="-mt-1 pl-6 text-[12px] text-muted-foreground">
          Displays buy and sell buttons directly on the chart
        </p>
        <CheckboxField
          id="tr-positions"
          label="Positions and orders"
          checked={draft.showPositions}
          onChange={(showPositions) => patch({ showPositions })}
        />
        <CheckboxField
          id="tr-sound"
          label="Execution sound"
          checked={draft.executionSound}
          onChange={(executionSound) => patch({ executionSound })}
        />
        <FieldRow label="Sound" htmlFor="tr-sound-name">
          <SelectField
            id="tr-sound-name"
            value={draft.soundName}
            options={ALERT_SOUNDS.map((entry) => ({
              value: entry.value,
              label: entry.label,
            }))}
            onChange={(value) => patch({ soundName: value as AlertSoundName })}
          />
        </FieldRow>
      </div>
    </div>
  );
}

function AlertsSection({
  draft,
  patch,
}: {
  draft: ChartDisplaySettings;
  patch: (part: Partial<ChartDisplaySettings>) => void;
}) {
  return (
    <div>
      <GroupTitle>Chart line visibility</GroupTitle>
      <div className="flex flex-col gap-1 py-1">
        <div className="flex items-center gap-2">
          <CheckboxField
            id="al-lines"
            label="Alert lines"
            checked={draft.showAlertLines}
            onChange={(showAlertLines) => patch({ showAlertLines })}
          />
          <ColorField
            value={draft.alertLineColor}
            onChange={(alertLineColor) => patch({ alertLineColor })}
            title="Alert line color"
          />
        </div>
        <CheckboxField
          id="al-active"
          label="Only active alerts"
          checked={draft.onlyActiveAlerts}
          onChange={(onlyActiveAlerts) => patch({ onlyActiveAlerts })}
        />
      </div>
      <GroupTitle>Notifications</GroupTitle>
      <FieldRow label="Alert volume" htmlFor="al-volume">
        <span id="al-volume">
          <OpacityField
            value={draft.alertVolume}
            onChange={(alertVolume) => patch({ alertVolume })}
          />
        </span>
      </FieldRow>
      <div className="py-1.5">
        <CheckboxField
          id="al-toasts"
          label="Automatically hide toasts"
          checked={draft.autoHideToasts}
          onChange={(autoHideToasts) => patch({ autoHideToasts })}
        />
      </div>
    </div>
  );
}

export default function ChartSettingsDialog({
  initial,
  onApply,
  onClose,
}: ChartSettingsDialogProps) {
  const [section, setSection] = useState<SectionId>("symbol");
  const [draft, setDraft] = useState<ChartDisplaySettings>(initial);
  const [templates, setTemplates] = useState<DisplayTemplate[]>(() =>
    loadDisplayTemplates(),
  );
  const [templateName, setTemplateName] = useState("");
  const [templateOpen, setTemplateOpen] = useState(false);

  const patch = (part: Partial<ChartDisplaySettings>): void =>
    setDraft((current) => ({ ...current, ...part }));

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/30 px-4 pt-[8vh]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Chart settings"
        className="flex max-h-[84vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-[16px] font-bold text-foreground">Settings</h2>
          <button
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1">
          <nav
            aria-label="Settings sections"
            className="w-44 shrink-0 border-r border-border p-2"
          >
            {SECTIONS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSection(entry.id)}
                aria-current={section === entry.id}
                className={`block w-full rounded px-3 py-2 text-left text-[13px] ${
                  section === entry.id
                    ? "bg-muted font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {entry.label}
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
            {section === "symbol" && (
              <SymbolSection draft={draft} patch={patch} />
            )}
            {section === "status" && (
              <StatusSection draft={draft} patch={patch} />
            )}
            {section === "scales" && (
              <ScalesSection draft={draft} patch={patch} />
            )}
            {section === "canvas" && (
              <CanvasSection draft={draft} patch={patch} />
            )}
            {section === "trading" && (
              <TradingSection draft={draft} patch={patch} />
            )}
            {section === "alerts" && (
              <AlertsSection draft={draft} patch={patch} />
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setTemplateOpen((open) => !open)}
              className="rounded border border-border px-3 py-1.5 text-[13px] text-foreground hover:bg-muted"
            >
              Template
            </button>
            {templateOpen && (
              <div className="absolute bottom-full left-0 z-10 mb-1 w-64 rounded-lg border border-border bg-card p-1 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setDraft(DEFAULT_DISPLAY_SETTINGS);
                    setTemplateOpen(false);
                  }}
                  className="block w-full rounded px-3 py-1.5 text-left text-[13px] hover:bg-muted"
                >
                  Apply defaults
                </button>
                {templates.map((entry) => (
                  <div
                    key={entry.name}
                    className="flex items-center hover:bg-muted"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(entry.settings);
                        setTemplateOpen(false);
                      }}
                      className="flex-1 truncate rounded px-3 py-1.5 text-left text-[13px]"
                    >
                      {entry.name}
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete template ${entry.name}`}
                      onClick={() =>
                        setTemplates(deleteDisplayTemplate(entry.name))
                      }
                      className="mr-2 rounded p-1 text-muted-foreground hover:text-error"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <form
                  className="flex items-center gap-1.5 border-t border-border p-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const name = templateName.trim();
                    if (!name) return;
                    setTemplates(saveDisplayTemplate(name, draft));
                    setTemplateName("");
                    setTemplateOpen(false);
                  }}
                >
                  <input
                    value={templateName}
                    maxLength={40}
                    onChange={(event) => setTemplateName(event.target.value)}
                    placeholder="Save as…"
                    aria-label="Template name"
                    className="min-w-0 flex-1 rounded border border-border px-2 py-1 text-[13px] outline-none focus:border-primary"
                  />
                  <button
                    type="submit"
                    disabled={!templateName.trim()}
                    className="rounded bg-primary px-2.5 py-1 text-[12px] font-semibold text-primary-foreground disabled:opacity-40"
                  >
                    Save
                  </button>
                </form>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-border px-4 py-1.5 text-[13px] text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onApply(draft)}
              className="rounded bg-foreground px-4 py-1.5 text-[13px] font-semibold text-primary-foreground hover:bg-foreground/90"
            >
              Ok
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
