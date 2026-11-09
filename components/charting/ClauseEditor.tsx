"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { getMeasure, TIMEFRAME_LABELS, timeframeText } from "@/lib/screener/catalog";
import { OP_LABELS, formatNumber, measureName } from "@/lib/screener/format";
import {
  ARITH_OPS,
  SOURCE_FIELDS,
  TIMEFRAME_UNITS,
  type Arg,
  type ArithOp,
  type Clause,
  type CompareOp,
  type Expr,
  type MeasureTerm,
  type SourceField,
  type Term,
  type TimeframeUnit,
} from "@/lib/screener/scan-types";
import { cn } from "@/lib/utils";
import { MeasurePicker } from "./MeasurePicker";
import { MenuItem, MenuLabel, Popover } from "./Popover";

/** Scan-wide actions a deeply nested chip can trigger. */
export const ScanActionsContext = createContext<{
  switchAllTimeframes: (timeframe: TimeframeUnit, offset: number) => void;
}>({ switchAllTimeframes: () => undefined });

/* ------------------------------------------------------------------ inputs */

function NumberInput({
  value,
  onChange,
  className,
}: {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? formatNumber(value);
  return (
    <input
      value={shown}
      inputMode="decimal"
      size={Math.max(1, shown.length)}
      onFocus={(event) => event.target.select()}
      onChange={(event) => {
        setDraft(event.target.value);
        const next = Number(event.target.value);
        if (event.target.value.trim() !== "" && Number.isFinite(next)) onChange(next);
      }}
      onBlur={() => setDraft(null)}
      className={cn(
        "rounded-md border border-transparent bg-warning/10 px-1 py-0.5 text-center font-mono text-xs font-bold text-warning outline-none hover:border-warning/30 focus:border-warning/30 focus:bg-card",
        className,
      )}
    />
  );
}

/* --------------------------------------------------------------- timeframe */

function TimeframeMenu({
  term,
  onChange,
}: {
  readonly term: MeasureTerm;
  readonly onChange: (timeframe: TimeframeUnit, offset: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const actions = useContext(ScanActionsContext);
  const [custom, setCustom] = useState<Record<TimeframeUnit, string>>({
    day: "5",
    week: "5",
    month: "5",
    quarter: "5",
    year: "5",
  });
  const pick = (timeframe: TimeframeUnit, offset: number): void => {
    onChange(timeframe, offset);
    setOpen(false);
  };
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      className="max-h-[380px] w-[230px] overflow-y-auto"
      trigger={
        <button
          type="button"
          aria-label={`Timeframe: ${timeframeText(term.timeframe, term.offset)}`}
          onClick={() => setOpen((value) => !value)}
          className="rounded-md px-1 py-0.5 text-xs font-semibold text-info hover:bg-info/10"
        >
          {timeframeText(term.timeframe, term.offset)}
        </button>
      }
    >
      {TIMEFRAME_UNITS.map((unit) => (
        <div key={unit}>
          <MenuLabel>{TIMEFRAME_LABELS[unit].now} candles</MenuLabel>
          {[0, 1, 2, 3].map((offset) => (
            <div key={offset} className="group flex items-center">
              <MenuItem
                active={term.timeframe === unit && term.offset === offset}
                onSelect={() => pick(unit, offset)}
              >
                {timeframeText(unit, offset)}
              </MenuItem>
              <button
                type="button"
                onClick={() => {
                  actions.switchAllTimeframes(unit, offset);
                  setOpen(false);
                }}
                className="invisible shrink-0 rounded px-1.5 py-1 text-[10px] font-bold text-primary hover:bg-primary/10 group-hover:visible"
              >
                Switch all
              </button>
            </div>
          ))}
          <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            <input
              value={custom[unit]}
              onChange={(event) => setCustom({ ...custom, [unit]: event.target.value })}
              className="w-12 rounded border border-border px-1 py-0.5 text-center font-mono"
            />
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => {
                const offset = Math.max(0, Math.min(500, Math.round(Number(custom[unit]) || 0)));
                pick(unit, offset);
              }}
            >
              {TIMEFRAME_LABELS[unit].plural} ago
            </button>
          </div>
        </div>
      ))}
    </Popover>
  );
}

/* -------------------------------------------------------------------- args */

function ArgEditor({
  arg,
  onChange,
  timeframe,
}: {
  readonly arg: Arg;
  readonly onChange: (arg: Arg) => void;
  readonly timeframe: TimeframeUnit;
}) {
  switch (arg.kind) {
    case "number":
      return <NumberInput value={arg.value} onChange={(value) => onChange({ kind: "number", value })} />;
    case "source":
      return (
        <select
          value={arg.value}
          onChange={(event) => onChange({ kind: "source", value: event.target.value as SourceField })}
          className="rounded-md bg-muted px-1 py-0.5 text-xs font-semibold text-foreground outline-none"
        >
          {SOURCE_FIELDS.map((field) => (
            <option key={field} value={field}>
              {field}
            </option>
          ))}
        </select>
      );
    case "expr":
      return (
        <ExprEditor
          expr={arg.expr}
          onChange={(expr) => onChange({ kind: "expr", expr })}
          timeframe={timeframe}
        />
      );
    case "filter":
      return (
        <span className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-dashed border-primary/25 bg-primary/5 px-1.5 py-0.5">
          <ClauseEditor clause={arg.clause} onChange={(clause) => onChange({ kind: "filter", clause })} />
        </span>
      );
  }
}

/* -------------------------------------------------------------------- term */

function TermChip({
  term,
  onChange,
  onRemove,
  allowText,
}: {
  readonly term: Term;
  readonly onChange: (term: Term) => void;
  readonly onRemove?: () => void;
  readonly allowText?: boolean;
}) {
  const [swapOpen, setSwapOpen] = useState(false);

  const remove = onRemove ? (
    <button
      type="button"
      aria-label="Remove term"
      onClick={onRemove}
      className="invisible rounded p-0.5 text-muted-foreground/60 hover:text-error group-hover/term:visible"
    >
      <X className="h-3 w-3" />
    </button>
  ) : null;

  if (term.kind === "number") {
    return (
      <span className="group/term inline-flex items-center">
        <NumberInput value={term.value} onChange={(value) => onChange({ kind: "number", value })} />
        {remove}
      </span>
    );
  }

  if (term.kind === "text") {
    return (
      <span className="group/term inline-flex items-center">
        <input
          value={term.value}
          size={Math.max(4, term.value.length)}
          onChange={(event) => onChange({ kind: "text", value: event.target.value })}
          className="rounded-md bg-success/10 px-1.5 py-0.5 text-xs font-bold text-success outline-none focus:ring-1 focus:ring-success"
        />
        {remove}
      </span>
    );
  }

  const def = getMeasure(term.measure);
  const isFunction = def?.category === "Math functions";
  const showTimeframe = def?.timeframed && !isFunction;

  return (
    <span className="group/term inline-flex flex-wrap items-center gap-0.5">
      {showTimeframe && (
        <TimeframeMenu term={term} onChange={(timeframe, offset) => onChange({ ...term, timeframe, offset })} />
      )}
      <Popover
        open={swapOpen}
        onClose={() => setSwapOpen(false)}
        trigger={
          <button
            type="button"
            aria-label={`Change ${def?.label ?? term.measure}`}
            onClick={() => setSwapOpen((value) => !value)}
            className="rounded-md px-1 py-0.5 text-xs font-bold text-foreground hover:bg-muted"
          >
            {measureName(term) || "Bracket"}
          </button>
        }
      >
        <MeasurePicker
          timeframe={term.timeframe}
          allowText={allowText}
          onPick={(choice) => {
            if (choice.kind === "term") onChange(choice.term);
            setSwapOpen(false);
          }}
        />
      </Popover>
      {term.args.length > 0 && (
        <span className="inline-flex flex-wrap items-center gap-0.5 text-xs text-muted-foreground">
          (
          {term.args.map((arg, index) => (
            <span key={index} className="inline-flex items-center gap-0.5">
              {index > 0 && <span className="text-muted-foreground/60">,</span>}
              <ArgEditor
                arg={arg}
                timeframe={term.timeframe}
                onChange={(next) => {
                  const args = [...term.args];
                  args[index] = next;
                  onChange({ ...term, args });
                }}
              />
            </span>
          ))}
          )
        </span>
      )}
      {remove}
    </span>
  );
}

/* -------------------------------------------------------------------- expr */

function ArithMenu({ op, onChange }: { readonly op: ArithOp; readonly onChange: (op: ArithOp) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      className="min-w-[60px]"
      trigger={
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-md px-1.5 py-0.5 font-mono text-xs font-bold text-purple hover:bg-purple/10"
        >
          {op === "*" ? "×" : op === "/" ? "÷" : op}
        </button>
      }
    >
      {ARITH_OPS.map((candidate) => (
        <MenuItem
          key={candidate}
          active={candidate === op}
          onSelect={() => {
            onChange(candidate);
            setOpen(false);
          }}
        >
          {candidate}
        </MenuItem>
      ))}
    </Popover>
  );
}

export function ExprEditor({
  expr,
  onChange,
  timeframe = "day",
  allowText,
  trailing,
}: {
  readonly expr: Expr;
  readonly onChange: (expr: Expr) => void;
  readonly timeframe?: TimeframeUnit;
  readonly allowText?: boolean;
  readonly trailing?: ReactNode;
}) {
  const [adding, setAdding] = useState<ArithOp | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const lastTimeframe =
    [...expr.terms].reverse().find((term): term is MeasureTerm => term.kind === "measure")?.timeframe ?? timeframe;

  return (
    <span className="inline-flex flex-wrap items-center gap-0.5">
      {expr.terms.map((term, index) => (
        <span key={index} className="inline-flex items-center gap-0.5">
          {index > 0 && (
            <ArithMenu
              op={expr.ops[index - 1] ?? "+"}
              onChange={(op) => {
                const ops = [...expr.ops];
                ops[index - 1] = op;
                onChange({ ...expr, ops });
              }}
            />
          )}
          <TermChip
            term={term}
            allowText={allowText}
            onChange={(next) => {
              const terms = [...expr.terms];
              terms[index] = next;
              onChange({ ...expr, terms });
            }}
            onRemove={
              expr.terms.length > 1
                ? () => {
                    const terms = expr.terms.filter((_, position) => position !== index);
                    const ops = expr.ops.filter((_, position) => position !== Math.max(0, index - 1));
                    onChange({ terms, ops });
                  }
                : undefined
            }
          />
        </span>
      ))}
      {trailing}
      {expr.terms.length > 0 && (
        <Popover
          open={menuOpen || adding !== null}
          onClose={() => {
            setMenuOpen(false);
            setAdding(null);
          }}
          trigger={
            <button
              type="button"
              aria-label="Add arithmetic"
              onClick={() => setMenuOpen((value) => !value)}
              className="rounded-md p-0.5 text-muted-foreground/60 hover:bg-purple/10 hover:text-purple"
            >
              <Plus className="h-3 w-3" />
            </button>
          }
        >
          {adding === null ? (
            <>
              <MenuLabel>Arithmetic</MenuLabel>
              <div className="flex gap-1 px-1.5 pb-1.5">
                {ARITH_OPS.map((op) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => {
                      setAdding(op);
                      setMenuOpen(false);
                    }}
                    className="h-7 w-8 rounded-md bg-purple/10 font-mono text-sm font-bold text-purple hover:bg-purple/10"
                  >
                    {op}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <MeasurePicker
              timeframe={lastTimeframe}
              onPick={(choice) => {
                if (choice.kind === "term") {
                  onChange({ terms: [...expr.terms, choice.term], ops: [...expr.ops, adding] });
                }
                setAdding(null);
              }}
            />
          )}
        </Popover>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ clause */

const COMPARISON_GROUP: readonly CompareOp[] = ["=", "!=", ">", ">=", "<", "<="];
const CROSS_GROUP: readonly CompareOp[] = ["crossed-above", "crossed-below"];

function exprIsText(expr: Expr): boolean {
  const first = expr.terms[0];
  return !!first && first.kind === "measure" && getMeasure(first.measure)?.output === "text";
}

function exprIsBoolean(expr: Expr): boolean {
  const first = expr.terms[0];
  return expr.terms.length === 1 && !!first && first.kind === "measure" && getMeasure(first.measure)?.output === "boolean";
}

export function ClauseEditor({
  clause,
  onChange,
}: {
  readonly clause: Clause;
  readonly onChange: (clause: Clause) => void;
}) {
  const [opOpen, setOpOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const textual = exprIsText(clause.left);
  const boolean = exprIsBoolean(clause.left);
  const leftTimeframe =
    clause.left.terms.find((term): term is MeasureTerm => term.kind === "measure")?.timeframe ?? "day";

  const setOp = (op: CompareOp | null): void => {
    setOpOpen(false);
    if (op === null) {
      onChange({ ...clause, op: null, right: null });
      return;
    }
    onChange({ ...clause, op });
    if (!clause.right || clause.right.terms.length === 0) setRightOpen(true);
  };

  const opButtonLabel = clause.op
    ? OP_LABELS[clause.op]
    : boolean
      ? "is present"
      : "Select a operation";

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <ExprEditor
        expr={clause.left}
        onChange={(left) => onChange({ ...clause, left })}
        timeframe={leftTimeframe}
      />
      <Popover
        open={opOpen}
        onClose={() => setOpOpen(false)}
        className="w-[210px]"
        trigger={
          <button
            type="button"
            onClick={() => setOpOpen((value) => !value)}
            className={cn(
              "rounded-md px-1.5 py-0.5 text-xs font-bold",
              clause.op
                ? clause.op.startsWith("crossed")
                  ? "text-primary hover:bg-primary/10"
                  : "text-success hover:bg-success/10"
                : boolean
                  ? "text-muted-foreground hover:bg-muted"
                  : "border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary",
            )}
          >
            {opButtonLabel}
          </button>
        }
      >
        <MenuLabel>Operations</MenuLabel>
        <MenuItem onSelect={() => setOp(null)}>Remove all on right</MenuItem>
        <MenuLabel>Comparison operations</MenuLabel>
        {COMPARISON_GROUP.filter((op) => !textual || op === "=" || op === "!=").map((op) => (
          <MenuItem key={op} active={clause.op === op} onSelect={() => setOp(op)}>
            {OP_LABELS[op]}
          </MenuItem>
        ))}
        {!textual && (
          <>
            <MenuLabel>Cross operations</MenuLabel>
            {CROSS_GROUP.map((op) => (
              <MenuItem key={op} active={clause.op === op} onSelect={() => setOp(op)}>
                {OP_LABELS[op]}
              </MenuItem>
            ))}
          </>
        )}
      </Popover>
      {clause.op && (
        clause.right && clause.right.terms.length > 0 ? (
          <ExprEditor
            expr={clause.right}
            onChange={(right) => onChange({ ...clause, right: right.terms.length ? right : null })}
            timeframe={leftTimeframe}
            allowText={textual}
          />
        ) : (
          <Popover
            open={rightOpen}
            onClose={() => setRightOpen(false)}
            trigger={
              <button
                type="button"
                onClick={() => setRightOpen((value) => !value)}
                className="rounded-md border border-dashed border-border px-1.5 py-0.5 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary"
              >
                Select an indicator/formula
              </button>
            }
          >
            <MeasurePicker
              timeframe={leftTimeframe}
              allowText={textual}
              placeholder={textual ? "Type a value, e.g. Banks" : "Indicator, field or a number"}
              onPick={(choice) => {
                if (choice.kind === "term") onChange({ ...clause, right: { terms: [choice.term], ops: [] } });
                setRightOpen(false);
              }}
            />
          </Popover>
        )
      )}
    </span>
  );
}
