"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Bell, Pencil, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  ALERT_OPERATORS,
  MESSAGE_PLACEHOLDERS,
  addLocalAlert,
  alertOperatorLabel,
  clearAlertTriggerLog,
  createAlert,
  defaultAlertMessage,
  deleteAlert,
  deleteAlertMeta,
  describeAlert,
  expiryPresetDate,
  getAlertMeta,
  getAxiosErrorMessage,
  isAlertExpired,
  isAlertPaused,
  isChannelOperator,
  isLocalOnlyRule,
  legacyConditionFor,
  operatorDirection,
  readAlertTriggerLog,
  removeLocalAlert,
  ruleTargetLabel,
  saveAlertCondition,
  saveAlertMeta,
  storedAlertDirection,
  type AlertMeta,
  type AlertOperator,
  type AlertRule,
  type AlertSchedule,
  type AlertTrigger,
  type AlertTriggerMode,
  type AttachedKind,
  type ChannelBand,
  type ChartAlert,
  type ExpiryPreset,
} from "./alerts";
import { formatNumber } from "./ui";

export interface FibLevelOption {
  readonly value: number;
  readonly label: string;
  readonly price: number;
}

export interface AlertDraftContext {
  readonly price: number | null;
  readonly drawingId: string | null;
  readonly drawingType: string | null;
  readonly drawingLabel: string | null;
  readonly linePrice: number | null;
  readonly kind: AttachedKind | null;
  readonly band: ChannelBand | null;
  readonly median: number | null;
  readonly fibLevels: readonly FibLevelOption[];
}

export interface AlertEditTarget {
  readonly id: string;
  readonly local: boolean;
}

interface PriceAlertDialogProps {
  readonly symbol: string;
  readonly displayName: string;
  readonly lastPrice: number;
  readonly context: AlertDraftContext;
  readonly alerts: readonly ChartAlert[];
  readonly localAlerts: readonly ChartAlert[];
  readonly drawingIds: readonly string[];
  /** Opens the dialog directly on the edit form for this alert. */
  readonly editTarget: AlertEditTarget | null;
  readonly onClose: () => void;
  readonly onChanged: () => void;
}

type Panel = "create" | "message" | "notify" | "list" | "log";

interface ConditionRow {
  operator: AlertOperator;
  target: string;
}

interface DraftForm {
  kind: "price" | "volume";
  rows: ConditionRow[];
  fibLevel: number;
  trigger: AlertTriggerMode;
  expiry: ExpiryPreset;
  customExpiry: string;
  alertName: string;
  message: string | null;
  notifyToast: boolean;
  playSound: boolean;
  webhookUrl: string;
  schedule: AlertSchedule;
}

interface EditingRef {
  readonly id: string;
  readonly local: boolean;
  readonly symbol: string;
  readonly target: number;
  /** Attachment family of the alert being edited, if any. */
  readonly attachedKind: AttachedKind | null;
  readonly drawingId: string | null;
  readonly drawingLabel: string | null;
  readonly fibLevel: number | null;
  readonly rules: readonly AlertRule[] | null;
}

const PRICE_OPERATORS: readonly AlertOperator[] = [
  "crossing",
  "crossing-up",
  "crossing-down",
  "greater-than",
  "less-than",
  "rising",
  "falling",
  "rising-pct",
  "falling-pct",
];

const VOLUME_OPERATORS: readonly AlertOperator[] = [
  "crossing",
  "crossing-up",
  "crossing-down",
  "greater-than",
  "less-than",
  "volume-above",
];

const ATTACHED_OPERATORS: readonly AlertOperator[] = [
  "crossing",
  "crossing-up",
  "crossing-down",
];

const CHANNEL_OPERATORS: readonly AlertOperator[] = [
  "entering-channel",
  "exiting-channel",
  "inside-channel",
  "outside-channel",
];

const FORK_OPERATORS: readonly AlertOperator[] = [
  "crossing",
  "crossing-up",
  "crossing-down",
  "entering-channel",
  "exiting-channel",
  "inside-channel",
  "outside-channel",
];

const EXPIRY_OPTIONS: readonly { value: ExpiryPreset; label: string }[] = [
  { value: "open", label: "Open-ended" },
  { value: "day", label: "End of day" },
  { value: "week", label: "1 week" },
  { value: "month", label: "1 month" },
  { value: "custom", label: "Custom date" },
];

function expiryLabel(meta: AlertMeta | null, nowMs: number): string | null {
  if (!meta?.expiresAt) return null;
  if (isAlertExpired(meta, nowMs)) return "Expired";
  const date = new Date(meta.expiresAt);
  return `Expires ${date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ${date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
}

function freshDraft(context: AlertDraftContext, lastPrice: number): DraftForm {
  const prefill = context.linePrice ?? context.price ?? lastPrice;
  return {
    kind: "price",
    rows: [
      {
        operator: "crossing",
        target: String(Number(prefill.toFixed(2))),
      },
    ],
    fibLevel: 0.5,
    trigger: "once",
    expiry: "month",
    customExpiry: "",
    alertName: "",
    message: null,
    notifyToast: true,
    playSound: false,
    webhookUrl: "",
    schedule: "always",
  };
}

export default function PriceAlertDialog({
  symbol,
  displayName,
  lastPrice,
  context,
  alerts,
  localAlerts,
  drawingIds,
  editTarget,
  onClose,
  onChanged,
}: PriceAlertDialogProps) {
  const attached = context.drawingId !== null;

  function buildEditState(
    alert: ChartAlert,
    local: boolean,
  ): { draft: DraftForm; editing: EditingRef } {
    const meta = getAlertMeta(alert.tradingSymbol, alert.targetPrice);
    const storedDirection = storedAlertDirection(alert);
    const rules = meta?.rules ?? [
      {
        operator:
          storedDirection === "above"
            ? ("crossing-up" as const)
            : storedDirection === "below"
              ? ("crossing-down" as const)
              : ("crossing" as const),
        target: alert.targetPrice,
      },
    ];
    const seed: DraftForm = {
      kind: meta?.kind ?? "price",
      rows: rules.map((rule) => ({
        operator: rule.operator,
        target: String(rule.target),
      })),
      fibLevel: meta?.fibLevel ?? 0.5,
      trigger: meta?.trigger ?? "once",
      expiry: "month",
      customExpiry: meta?.expiresAt ?? "",
      alertName: "",
      message: meta?.message ?? null,
      notifyToast: meta?.notifyToast ?? true,
      playSound: meta?.playSound ?? false,
      webhookUrl: meta?.webhookUrl ?? "",
      schedule: meta?.schedule ?? "always",
    };
    if (meta?.expiresAt) {
      const at = Date.parse(meta.expiresAt);
      if (!Number.isNaN(at)) {
        const date = new Date(at);
        const pad = (value: number): string => String(value).padStart(2, "0");
        seed.expiry = "custom";
        seed.customExpiry = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
      }
    }
    return {
      draft: seed,
      editing: {
        id: alert.id,
        local,
        symbol: alert.tradingSymbol,
        target: alert.targetPrice,
        attachedKind: meta?.attachedKind ?? null,
        drawingId: meta?.drawingId ?? null,
        drawingLabel: meta?.drawingLabel ?? null,
        fibLevel: meta?.fibLevel ?? null,
        rules,
      },
    };
  }

  /** Panel-initiated edit seed, applied once through lazy state init. */
  function findEditSeed(): {
    draft: DraftForm;
    editing: EditingRef;
  } | null {
    if (!editTarget) return null;
    const pool = editTarget.local ? localAlerts : alerts;
    const found = pool.find((entry) => entry.id === editTarget.id);
    return found ? buildEditState(found, editTarget.local) : null;
  }

  // A panel-initiated edit mounts the dialog with its target, so the seed
  // applies once through lazy init instead of an effect.
  const [draft, setDraft] = useState<DraftForm>(
    () => findEditSeed()?.draft ?? freshDraft(context, lastPrice),
  );
  const [editing, setEditing] = useState<EditingRef | null>(
    () => findEditSeed()?.editing ?? null,
  );
  const [panel, setPanel] = useState<Panel>("create");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [log, setLog] = useState<readonly AlertTrigger[]>(() =>
    typeof window === "undefined" ? [] : readAlertTriggerLog(),
  );

  const patch = (part: Partial<DraftForm>): void =>
    setDraft((current) => ({ ...current, ...part }));

  // When editing an attached alert the form stays in that alert's family,
  // even though the dialog was opened without a drawing context.
  const activeKind = attached ? context.kind : (editing?.attachedKind ?? null);
  const formAttached = activeKind !== null;

  const operatorChoices: readonly AlertOperator[] =
    activeKind === "channel"
      ? CHANNEL_OPERATORS
      : activeKind === "fork"
        ? FORK_OPERATORS
        : formAttached
          ? ATTACHED_OPERATORS
          : draft.kind === "volume"
            ? VOLUME_OPERATORS
            : PRICE_OPERATORS;

  const valid = attached
    ? activeKind === "channel" || activeKind === "fork"
      ? context.band !== null
      : activeKind === "fib"
        ? context.fibLevels.length > 0
        : true
    : editing?.attachedKind
      ? true
      : draft.rows.every((row) => {
          const target = Number(row.target);
          return Number.isFinite(target) && target > 0;
        });

  const resetDraft = (): void => {
    setDraft(freshDraft(context, lastPrice));
    setEditing(null);
  };

  const submit = async (): Promise<void> => {
    if (busy) return;
    let rules: AlertRule[] = [];
    let fibLevel: number | null = null;
    if (!attached && editing?.attachedKind && editing.rules) {
      // Editing an attached alert: keep its drawing linkage and targets,
      // applying only the newly picked operator.
      const operator =
        draft.rows[0]?.operator ?? editing.rules[0]?.operator ?? "crossing";
      rules = editing.rules.map((rule, index) =>
        index === 0 ? { ...rule, operator } : rule,
      );
      fibLevel = editing.fibLevel;
    } else if (attached && context.kind === "fib") {
      const level =
        context.fibLevels.find((entry) => entry.value === draft.fibLevel) ??
        context.fibLevels[0];
      if (!level) {
        toast.error("Pick a Fibonacci level.");
        return;
      }
      rules = [
        {
          operator: draft.rows[0]?.operator ?? "crossing",
          target: level.price,
        },
      ];
      fibLevel = level.value;
    } else if (
      attached &&
      (context.kind === "channel" || context.kind === "fork") &&
      context.band
    ) {
      const mid = (context.band.lower + context.band.upper) / 2;
      rules = [
        {
          operator: draft.rows[0]?.operator ?? "entering-channel",
          target: Number(mid.toFixed(2)),
        },
      ];
    } else if (attached) {
      const target = context.linePrice ?? context.price ?? lastPrice;
      rules = [
        {
          operator: draft.rows[0]?.operator ?? "crossing",
          target: Number(target.toFixed(2)),
        },
      ];
    } else {
      for (const row of draft.rows) {
        const target = Number(row.target);
        if (!Number.isFinite(target) || target <= 0) {
          toast.error("Enter a target above zero for every condition.");
          return;
        }
        rules.push({ operator: row.operator, target });
      }
    }
    if (rules.length === 0) return;
    const primary = rules[0]!;
    const localOnly =
      attached ||
      editing?.local === true ||
      rules.some((rule) => isLocalOnlyRule(rule, draft.kind));
    const expiresAt = expiryPresetDate(
      draft.expiry,
      Date.now(),
      draft.customExpiry || null,
    );
    const message = draft.message?.trim() ? draft.message.trim() : null;
    setBusy(true);
    try {
      if (editing) {
        if (editing.local) removeLocalAlert(editing.id);
        else await deleteAlert(editing.id);
        deleteAlertMeta(editing.symbol, editing.target);
      }
      const meta: AlertMeta = {
        rules,
        kind: draft.kind,
        trigger: draft.trigger,
        expiresAt,
        message,
        notifyToast: draft.notifyToast,
        playSound: draft.playSound,
        webhookUrl: draft.webhookUrl.trim() || null,
        schedule: draft.schedule,
        drawingId: attached ? context.drawingId : (editing?.drawingId ?? null),
        staticTarget: primary.target,
        drawingLabel: attached
          ? context.drawingLabel
          : (editing?.drawingLabel ?? null),
        fibLevel,
        attachedKind: attached ? context.kind : (editing?.attachedKind ?? null),
        createdAt: new Date().toISOString(),
      };
      if (localOnly) {
        const id =
          editing?.local === true
            ? editing.id
            : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        if (editing?.local === true) removeLocalAlert(id);
        addLocalAlert({
          id,
          tradingSymbol: symbol,
          targetPrice: primary.target,
          direction: operatorDirection(primary.operator),
          status: "active",
        });
        saveAlertMeta(symbol, primary.target, meta);
      } else {
        await createAlert({
          tradingSymbol: symbol,
          displayName,
          targetPrice: primary.target,
          lastPrice,
          direction: operatorDirection(primary.operator),
        });
        saveAlertCondition(
          symbol,
          primary.target,
          legacyConditionFor(primary.operator),
        );
        saveAlertMeta(symbol, primary.target, meta);
      }
      toast.success(
        `Alert set: ${symbol} ${alertOperatorLabel(primary.operator)} ${ruleTargetLabel(primary, draft.kind)}`,
      );
      resetDraft();
      onChanged();
      setPanel("list");
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Could not create the alert"));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (alert: ChartAlert, local: boolean): void => {
    const seed = buildEditState(alert, local);
    setDraft(seed.draft);
    setEditing(seed.editing);
    setPanel("create");
  };

  const remove = async (alert: ChartAlert, local: boolean): Promise<void> => {
    try {
      if (local) removeLocalAlert(alert.id);
      else await deleteAlert(alert.id);
      deleteAlertMeta(alert.tradingSymbol, alert.targetPrice);
      toast.success("Alert removed");
      onChanged();
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Could not remove the alert"));
    }
  };

  const primary = draft.rows[0];
  const previewMessage =
    draft.message?.trim() ||
    (primary
      ? isChannelOperator(primary.operator)
        ? defaultAlertMessage(
            symbol,
            alertOperatorLabel(primary.operator),
            (attached ? context.drawingLabel : editing?.drawingLabel) ??
              "Channel",
          )
        : defaultAlertMessage(
            symbol,
            alertOperatorLabel(primary.operator),
            ruleTargetLabel(
              {
                operator: primary.operator,
                target: Number(primary.target) || 0,
              },
              draft.kind,
            ),
          )
      : "");

  const notificationSummary = [
    draft.notifyToast ? "Toasts" : null,
    draft.playSound ? "Sound" : null,
    draft.webhookUrl.trim() ? "Webhook" : null,
    draft.schedule === "market-hours" ? "Market hours" : null,
  ]
    .filter((entry): entry is string => entry !== null)
    .join(", ");

  const combined = useMemo(
    () =>
      [...localAlerts, ...alerts].filter(
        (alert) =>
          filter.trim() === "" ||
          `${alert.tradingSymbol} ${alert.targetPrice}`
            .toLowerCase()
            .includes(filter.trim().toLowerCase()),
      ),
    [localAlerts, alerts, filter],
  );

  const [nowMs] = useState(() => Date.now());

  const targetAdornment = (operator: AlertOperator): string => {
    if (operator === "rising-pct" || operator === "falling-pct") return "%";
    if (draft.kind === "volume" || operator === "volume-above") return "shares";
    return "₹";
  };

  const createForm = (
    <div className="flex flex-col gap-3 px-5 py-4">
      {attached && context.kind === "line" && (
        <p className="rounded-lg bg-muted px-3 py-2 text-[12px] text-muted-foreground">
          Follows your {context.drawingLabel ?? "trend line"} — the target moves
          with the line.
          {context.linePrice !== null &&
            ` Falls back to ₹${formatNumber(context.linePrice)} if the drawing is deleted.`}
        </p>
      )}
      {!attached && editing?.attachedKind && (
        <p className="rounded-lg bg-muted px-3 py-2 text-[12px] text-muted-foreground">
          Follows your {editing.drawingLabel ?? "drawing"} — the target moves
          with it.
          {editing.attachedKind === "fib" &&
            editing.fibLevel !== null &&
            ` Level ${editing.fibLevel}.`}
        </p>
      )}
      {attached && (context.kind === "channel" || context.kind === "fork") && (
        <div className="flex flex-col gap-1.5">
          <div className="rounded-lg bg-muted px-3 py-2 text-[13px] font-medium text-muted-foreground">
            {context.drawingLabel ?? "Channel"}
          </div>
          {context.band && (
            <p className="px-1 text-[12px] text-muted-foreground">
              Band now ₹{formatNumber(context.band.lower)} – ₹
              {formatNumber(context.band.upper)}
              {context.kind === "fork" &&
                context.median !== null &&
                ` · Median ₹${formatNumber(context.median)}`}
            </p>
          )}
        </div>
      )}
      {attached && context.kind === "fib" && (
        <div className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-[13px] text-muted-foreground">
            Level
          </span>
          <select
            aria-label="Fibonacci level"
            value={String(draft.fibLevel)}
            onChange={(event) =>
              patch({ fibLevel: Number(event.target.value) })
            }
            className="min-w-0 flex-1 rounded border border-border bg-card px-2 py-1.5 text-[13px] outline-none focus:border-primary"
          >
            {context.fibLevels.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label} · ₹{formatNumber(entry.price)}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex items-center gap-3">
        <span className="w-24 shrink-0 text-[13px] text-muted-foreground">
          Condition
        </span>
        {formAttached ? (
          <span className="text-[13px] font-semibold text-foreground">
            Price
          </span>
        ) : (
          <select
            aria-label="Alert value"
            value={draft.kind}
            onChange={(event) =>
              patch({
                kind: event.target.value as "price" | "volume",
                rows: [{ operator: "crossing", target: "" }],
              })
            }
            className="rounded border border-border bg-card px-2 py-1.5 text-[13px] outline-none focus:border-primary"
          >
            <option value="price">Price</option>
            <option value="volume">Vol</option>
          </select>
        )}
      </div>
      {draft.rows.map((row, index) => (
        <div key={index} className="flex items-start gap-3">
          <span className="w-24 shrink-0 pt-2 text-[13px] text-muted-foreground">
            {index === 0 ? "" : "And"}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <select
                aria-label={`Condition operator ${index + 1}`}
                value={row.operator}
                onChange={(event) => {
                  const operator = event.target.value as AlertOperator;
                  patch({
                    rows: draft.rows.map((entry, position) =>
                      position === index ? { ...entry, operator } : entry,
                    ),
                  });
                }}
                className="min-w-0 flex-1 rounded border border-border bg-card px-2 py-1.5 text-[13px] outline-none focus:border-primary"
              >
                {operatorChoices.map((id) => (
                  <option key={id} value={id}>
                    {ALERT_OPERATORS.find((entry) => entry.id === id)?.label ??
                      id}
                  </option>
                ))}
              </select>
              {draft.rows.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remove condition ${index + 1}`}
                  onClick={() =>
                    patch({
                      rows: draft.rows.filter(
                        (_, position) => position !== index,
                      ),
                    })
                  }
                  className="rounded p-1 text-muted-foreground hover:text-error"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {!formAttached && (
              <div className="relative">
                <input
                  aria-label={`Condition target ${index + 1}`}
                  inputMode="decimal"
                  value={row.target}
                  onChange={(event) =>
                    patch({
                      rows: draft.rows.map((entry, position) =>
                        position === index
                          ? { ...entry, target: event.target.value }
                          : entry,
                      ),
                    })
                  }
                  placeholder={
                    draft.kind === "volume" ? "Shares traded" : "22,363.35"
                  }
                  className="w-full rounded border border-border px-2 py-1.5 pr-14 text-[13px] outline-none focus:border-primary"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">
                  {targetAdornment(row.operator)}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
      {!formAttached && draft.rows.length < 3 && (
        <div className="flex items-center gap-3">
          <span className="w-24 shrink-0" />
          <button
            type="button"
            onClick={() =>
              patch({
                rows: [
                  ...draft.rows,
                  {
                    operator:
                      draft.kind === "volume" ? "volume-above" : "crossing",
                    target: "",
                  },
                ],
              })
            }
            className="text-[13px] font-semibold text-primary hover:underline"
          >
            + Add condition
          </button>
        </div>
      )}
      <div className="flex items-center gap-3">
        <span className="w-24 shrink-0 text-[13px] text-muted-foreground">
          Trigger
        </span>
        <select
          aria-label="Alert trigger"
          value={draft.trigger}
          onChange={(event) =>
            patch({ trigger: event.target.value as AlertTriggerMode })
          }
          className="rounded border border-border bg-card px-2 py-1.5 text-[13px] outline-none focus:border-primary"
        >
          <option value="once">Once only</option>
          <option value="every">Every time</option>
        </select>
      </div>
      <div className="flex items-center gap-3">
        <span className="w-24 shrink-0 text-[13px] text-muted-foreground">
          Expiration
        </span>
        <select
          aria-label="Alert expiration"
          value={draft.expiry}
          onChange={(event) =>
            patch({ expiry: event.target.value as ExpiryPreset })
          }
          className="rounded border border-border bg-card px-2 py-1.5 text-[13px] outline-none focus:border-primary"
        >
          {EXPIRY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.value === "day" && "End of day"}
              {option.value === "open" && "Open-ended"}
              {option.value === "week" && "1 week"}
              {option.value === "month" && "1 month"}
              {option.value === "custom" && "Custom date"}
            </option>
          ))}
        </select>
        {draft.expiry === "custom" && (
          <input
            aria-label="Custom expiration"
            type="datetime-local"
            value={draft.customExpiry}
            onChange={(event) => patch({ customExpiry: event.target.value })}
            className="rounded border border-border px-2 py-1.5 text-[13px] outline-none focus:border-primary"
          />
        )}
      </div>
      <button
        type="button"
        onClick={() => setPanel("message")}
        className="flex items-center gap-3 text-left"
      >
        <span className="w-24 shrink-0 text-[13px] text-muted-foreground">
          Message
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
          {previewMessage}
        </span>
        <span aria-hidden className="text-muted-foreground">
          ›
        </span>
      </button>
      <button
        type="button"
        onClick={() => setPanel("notify")}
        className="flex items-center gap-3 text-left"
      >
        <span className="w-24 shrink-0 text-[13px] text-muted-foreground">
          Notifications
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
          {notificationSummary || "Off"}
        </span>
        <span aria-hidden className="text-muted-foreground">
          ›
        </span>
      </button>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            resetDraft();
            onClose();
          }}
          className="rounded border border-border px-4 py-1.5 text-[13px] text-foreground hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!valid || busy}
          onClick={() => void submit()}
          className="rounded bg-foreground px-4 py-1.5 text-[13px] font-semibold text-primary-foreground hover:bg-foreground/90 disabled:opacity-40"
        >
          {busy ? "Saving…" : editing ? "Save" : "Create"}
        </button>
      </div>
    </div>
  );

  const messageView = (
    <div className="flex flex-col gap-3 px-5 py-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Back to alert"
          onClick={() => setPanel("create")}
          className="rounded p-1 text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h3 className="text-[15px] font-bold text-foreground">Edit message</h3>
      </div>
      <label htmlFor="alert-name" className="text-[13px] text-muted-foreground">
        Alert name
      </label>
      <input
        id="alert-name"
        value={draft.alertName}
        maxLength={80}
        onChange={(event) => patch({ alertName: event.target.value })}
        placeholder="Optional name for the alerts list"
        className="rounded border border-border px-2 py-1.5 text-[13px] outline-none focus:border-primary"
      />
      <label
        htmlFor="alert-message"
        className="text-[13px] text-muted-foreground"
      >
        Message
      </label>
      <textarea
        id="alert-message"
        value={draft.message ?? previewMessage}
        rows={5}
        onChange={(event) => patch({ message: event.target.value })}
        className="rounded border border-border px-2 py-1.5 font-mono text-[13px] outline-none focus:border-primary"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[12px] text-muted-foreground">
          Add placeholder:
        </span>
        {MESSAGE_PLACEHOLDERS.map((entry) => (
          <button
            key={entry.token}
            type="button"
            title={entry.label}
            onClick={() =>
              patch({
                message: `${draft.message ?? previewMessage}${entry.token}`,
              })
            }
            className="rounded border border-border px-2 py-0.5 font-mono text-[12px] text-primary hover:bg-muted"
          >
            {entry.token}
          </button>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setPanel("create")}
          className="rounded border border-border px-4 py-1.5 text-[13px] text-foreground hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => setPanel("create")}
          className="rounded bg-foreground px-4 py-1.5 text-[13px] font-semibold text-primary-foreground hover:bg-foreground/90"
        >
          Apply
        </button>
      </div>
    </div>
  );

  const notifyView = (
    <div className="flex flex-col gap-3 px-5 py-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Back to alert"
          onClick={() => setPanel("create")}
          className="rounded p-1 text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h3 className="text-[15px] font-bold text-foreground">Notifications</h3>
      </div>
      <label className="flex cursor-pointer items-start gap-2 text-[13px] text-foreground">
        <input
          type="checkbox"
          checked={draft.notifyToast}
          onChange={(event) => patch({ notifyToast: event.target.checked })}
          className="mt-0.5 accent-[#2962FF]"
        />
        <span>
          Show toast notification
          <span className="block text-[12px] text-muted-foreground">
            Displays an onsite notification in the page corner.
          </span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-2 text-[13px] text-foreground">
        <input
          type="checkbox"
          checked={draft.playSound}
          onChange={(event) => patch({ playSound: event.target.checked })}
          className="mt-0.5 accent-[#2962FF]"
        />
        <span>
          Play sound
          <span className="block text-[12px] text-muted-foreground">
            Plays an audio cue when your alert triggers.
          </span>
        </span>
      </label>
      <label className="flex flex-col gap-1 text-[13px] text-foreground">
        Webhook URL
        <input
          value={draft.webhookUrl}
          inputMode="url"
          maxLength={300}
          onChange={(event) => patch({ webhookUrl: event.target.value })}
          placeholder="https://… (POST on trigger)"
          className="rounded border border-border px-2 py-1.5 text-[13px] outline-none focus:border-primary"
        />
        <span className="text-[12px] text-muted-foreground">
          Sends a POST request to your URL when your alert triggers.
        </span>
      </label>
      <label className="flex items-center gap-3 text-[13px] text-foreground">
        Notification schedule
        <select
          value={draft.schedule}
          onChange={(event) =>
            patch({ schedule: event.target.value as AlertSchedule })
          }
          className="rounded border border-border bg-card px-2 py-1.5 text-[13px] outline-none focus:border-primary"
        >
          <option value="always">24/7</option>
          <option value="market-hours">Market hours</option>
        </select>
      </label>
      <p className="text-[12px] text-muted-foreground">
        Notifications are muted outside this schedule.
      </p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setPanel("create")}
          className="rounded border border-border px-4 py-1.5 text-[13px] text-foreground hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => setPanel("create")}
          className="rounded bg-foreground px-4 py-1.5 text-[13px] font-semibold text-primary-foreground hover:bg-foreground/90"
        >
          Apply
        </button>
      </div>
    </div>
  );

  const listView = (
    <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto px-5 py-4">
      <input
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="Search alerts…"
        aria-label="Search alerts"
        className="rounded border border-border px-2 py-1.5 text-[13px] outline-none focus:border-primary"
      />
      {combined.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Bell className="h-10 w-10 text-muted-foreground" />
          <p className="max-w-xs text-[13px] text-muted-foreground">
            Alerts notify you instantly when your conditions are met. Create one
            to get started.
          </p>
          <button
            type="button"
            onClick={() => {
              resetDraft();
              setPanel("create");
            }}
            className="mt-1 rounded bg-foreground px-4 py-1.5 text-[13px] font-semibold text-primary-foreground hover:bg-foreground/90"
          >
            Create alert
          </button>
        </div>
      ) : (
        combined.map((alert) => {
          const local = alert.id.startsWith("local-");
          const meta = getAlertMeta(alert.tradingSymbol, alert.targetPrice);
          const expired = meta !== null && isAlertExpired(meta, nowMs);
          const expiry = expiryLabel(meta, nowMs);
          return (
            <div
              key={alert.id}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
            >
              <span
                aria-hidden
                className={`text-[14px] font-bold ${alert.direction === "above" ? "text-success" : "text-error"}`}
              >
                {alert.direction === "above" ? "▲" : "▼"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-foreground">
                  {alert.tradingSymbol} · {describeAlert(alert)}
                </p>
                <p className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                  {meta?.trigger === "every" && (
                    <span className="rounded bg-muted px-1.5 py-px">
                      Every time
                    </span>
                  )}
                  {meta?.attachedKind && (
                    <span className="rounded bg-muted px-1.5 py-px">
                      {meta.drawingLabel ??
                        (meta.attachedKind === "fib"
                          ? "Fib"
                          : meta.attachedKind === "line"
                            ? "Trend line"
                            : "Channel")}
                    </span>
                  )}
                  {meta?.attachedKind === "fib" && meta.fibLevel !== null && (
                    <span className="rounded bg-muted px-1.5 py-px">
                      Level {meta.fibLevel}
                    </span>
                  )}
                  {meta?.drawingId && !drawingIds.includes(meta.drawingId) && (
                    <span className="rounded bg-error/10 px-1.5 py-px font-semibold text-error">
                      Drawing deleted
                    </span>
                  )}
                  {local && (
                    <span className="rounded bg-muted px-1.5 py-px">
                      This device
                    </span>
                  )}
                  {expiry && (
                    <span
                      className={`rounded px-1.5 py-px ${
                        expired
                          ? "bg-error/10 font-semibold text-error"
                          : "bg-muted"
                      }`}
                    >
                      {expiry}
                    </span>
                  )}
                  {alert.status !== "active" && (
                    <span className="rounded bg-muted px-1.5 py-px">
                      {alert.status}
                    </span>
                  )}
                  {isAlertPaused(alert.id) && (
                    <span className="rounded bg-warning/15 px-1.5 py-px font-semibold text-warning">
                      Paused
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Edit alert ${alert.tradingSymbol}`}
                onClick={() => startEdit(alert, local)}
                className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={`Delete alert ${alert.tradingSymbol}`}
                onClick={() => void remove(alert, local)}
                className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-error"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })
      )}
    </div>
  );

  const logView = (
    <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto px-5 py-4">
      {log.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-muted-foreground">
          No alerts triggered yet! You will see a list here when they do.
        </p>
      ) : (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                clearAlertTriggerLog();
                setLog(readAlertTriggerLog());
              }}
              className="text-[12px] font-semibold text-muted-foreground hover:text-error"
            >
              Clear log
            </button>
          </div>
          {log.map((entry, index) => (
            <div
              key={`${entry.at}-${index}`}
              className="rounded-lg border border-border px-3 py-2 text-[13px]"
            >
              <p className="font-semibold text-foreground">
                {entry.symbol} {entry.condition} ₹{formatNumber(entry.price)}
              </p>
              <p className="text-[12px] text-muted-foreground">
                {new Date(entry.at).toLocaleString()}
              </p>
            </div>
          ))}
        </>
      )}
    </div>
  );

  const total = alerts.length + localAlerts.length;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/30 px-4 pt-[10vh]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Price alerts"
        className="w-full max-w-xl overflow-hidden rounded-xl bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-[15px] font-bold text-foreground">
            {panel === "message"
              ? "Edit message"
              : panel === "notify"
                ? "Notifications"
                : `Create alert on ${displayName}`}
          </h2>
          <button
            type="button"
            aria-label="Close alerts"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {(panel === "create" || panel === "list" || panel === "log") && (
          <div className="flex gap-1 border-b border-border px-5 pt-2">
            {(
              [
                { id: "create", label: "New alert" },
                { id: "list", label: `Alerts (${total})` },
                { id: "log", label: "Trigger log" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPanel(tab.id)}
                className={`border-b-2 px-2 pb-2 text-[13px] font-semibold ${
                  panel === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
        {panel === "create" && createForm}
        {panel === "message" && messageView}
        {panel === "notify" && notifyView}
        {panel === "list" && listView}
        {panel === "log" && logView}
      </div>
    </div>
  );
}
