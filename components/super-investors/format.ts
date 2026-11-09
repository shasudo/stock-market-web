import type { HoldingChange } from "@/lib/super-investors/client";

const CRORE = 10_000_000;

/** ₹ value in crores: 2 decimals under ₹100 Cr, whole crores above. */
export function formatCrores(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const crores = value / CRORE;
  const abs = Math.abs(crores);
  const digits = abs >= 100 ? 0 : abs >= 1 ? 1 : 2;
  return `₹${crores.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })} Cr`;
}

export function formatSignedCrores(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const text = formatCrores(Math.abs(value));
  return `${value >= 0 ? "+" : "−"}${text}`;
}

export function formatPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatShares(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString("en-IN");
}

export function formatPercent(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatSignedPercent(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export function formatTime(iso: string | number | null): string {
  if (iso === null) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
}

export const CHANGE_LABELS: Readonly<Record<HoldingChange, string>> = {
  new: "New",
  increased: "Increased",
  decreased: "Decreased",
  unchanged: "Unchanged",
  exited: "Exited / <1%",
};

export function changeBadgeClass(change: HoldingChange | null): string {
  switch (change) {
    case "new":
      return "bg-success/10 text-success border-success/30";
    case "increased":
      return "bg-primary/10 text-primary border-primary/30";
    case "decreased":
      return "bg-warning/10 text-warning border-warning/30";
    case "exited":
      return "bg-error/10 text-error border-error/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function toneClass(value: number | null): string {
  if (value === null || value === 0 || !Number.isFinite(value))
    return "text-muted-foreground";
  return value > 0 ? "text-success" : "text-error";
}

const AVATAR_COLORS = [
  "#4B7B4B",
  "#C0554E",
  "#6E4FA3",
  "#2F8F72",
  "#5A6B8C",
  "#8A8354",
  "#4F4FA3",
  "#C0704E",
  "#B0632B",
  "#3E7CA6",
];

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => /[A-Za-z0-9]/.test(word))
    .slice(0, 2)
    .map((word) => word.replace(/[^A-Za-z0-9]/g, "")[0] ?? "")
    .join("")
    .toUpperCase();
}
