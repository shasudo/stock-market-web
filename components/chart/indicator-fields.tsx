"use client";

import { useState } from "react";

import {
  type LineStyle,
  LINE_STYLES,
  LINE_WIDTHS,
} from "@/lib/technical/indicator-schema";
import { cn } from "@/lib/utils";

const CONTROL_CLASSNAME =
  "h-9 rounded-lg border border-border bg-card px-2.5 text-[14px] text-foreground focus:border-primary focus:outline-none disabled:bg-muted disabled:text-muted-foreground/70";

export function FieldRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_200px] items-center gap-4 py-1.5">
      <label htmlFor={htmlFor} className="text-[14px] text-foreground">
        {label}
      </label>
      <div className="flex items-center justify-end gap-2">{children}</div>
    </div>
  );
}

/**
 * Numbers are edited as free text so a partially typed value (empty, "-", "1.")
 * is not clobbered mid-keystroke; the value is coerced when the field commits.
 */
export function NumberField({
  id,
  value,
  step,
  minimum,
  maximum,
  onCommit,
}: {
  id: string;
  value: number;
  step?: number;
  minimum: number;
  maximum: number;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [committedValue, setCommittedValue] = useState(value);

  if (value !== committedValue) {
    setCommittedValue(value);
    setDraft(String(value));
  }

  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      className={cn(CONTROL_CLASSNAME, "w-full")}
      value={draft}
      step={step}
      min={minimum}
      max={maximum}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onCommit(draft);
      }}
    />
  );
}

export function SelectField({
  id,
  value,
  options,
  onChange,
  className,
}: {
  id?: string;
  value: string;
  options: readonly { readonly value: string; readonly label: string }[];
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <select
      id={id}
      className={cn(CONTROL_CLASSNAME, "w-full", className)}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function CheckboxField({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-2 text-[14px] text-foreground"
    >
      <input
        id={id}
        type="checkbox"
        className="h-4 w-4 shrink-0 cursor-pointer rounded accent-[#131722]"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

/** TradingView-style colour swatch opening the native picker. */
export function ColorField({
  value,
  onChange,
  disabled,
  title,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <span
      title={title}
      aria-label={title}
      className={cn(
        "relative inline-flex h-9 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-card",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <span
        aria-hidden
        className="h-5 w-8 rounded"
        style={{ backgroundColor: value }}
      />
      <input
        type="color"
        aria-label={title}
        disabled={disabled}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </span>
  );
}

export function LineWidthField({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (widths: number) => void;
  disabled?: boolean;
}) {
  return (
    <select
      aria-label="Line width"
      disabled={disabled}
      className={cn(CONTROL_CLASSNAME, "w-16")}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      {LINE_WIDTHS.map((width) => (
        <option key={width} value={width}>
          {width}px
        </option>
      ))}
    </select>
  );
}

export function LineStyleField({
  value,
  onChange,
  disabled,
}: {
  value: LineStyle;
  onChange: (value: LineStyle) => void;
  disabled?: boolean;
}) {
  return (
    <select
      aria-label="Line style"
      disabled={disabled}
      className={cn(CONTROL_CLASSNAME, "w-24")}
      value={value}
      onChange={(event) => onChange(event.target.value as LineStyle)}
    >
      {LINE_STYLES.map((style) => (
        <option key={style} value={style}>
          {style}
        </option>
      ))}
    </select>
  );
}

export function OpacityField({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (opacity: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="range"
        aria-label="Opacity"
        disabled={disabled}
        className="h-1 w-20 accent-[#131722] disabled:opacity-40"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
        {value}%
      </span>
    </div>
  );
}
