/** Presentation formatting. Backend values stay raw until this layer. */

const inr0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const num1 = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** ₹1,23,456.78 — null in, "—" out. */
export function inr(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `₹${inr2.format(value)}`;
}

export function int(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return inr0.format(value);
}

/** Signed, one decimal, colored by sign at the call site: +2.4%. */
export function signedPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${num1.format(Math.abs(value))}%`;
}

export function signOf(value: number | null | undefined): 1 | -1 | 0 {
  if (value == null || !Number.isFinite(value)) return 0;
  return value > 0 ? 1 : value < 0 ? -1 : 0;
}

/** Backend sends IST instants; show them short and labeled. */
export function istTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function istDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}
