/** Calendar days between an ISO date string and today, in local time - not a
 * raw 24h-bucket difference, so "yesterday at 11pm" reads as 1 day, not 0. */
export function daysSince(dateStr: string): number {
  const then = new Date(dateStr);
  const now = new Date();
  const utcThen = Date.UTC(
    then.getUTCFullYear(),
    then.getUTCMonth(),
    then.getUTCDate(),
  );
  const utcNow = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((utcNow - utcThen) / 86_400_000);
}

export function formatMarketCap(value: number): string {
  if (!value || value <= 0) return "-";
  const crores = value / 1e7;
  if (crores >= 100000) {
    return `₹${(crores / 100000).toFixed(2)}L Cr`;
  }
  if (crores >= 1) {
    return `₹${Math.round(crores).toLocaleString("en-IN")} Cr`;
  }

  const lakhs = value / 1e5;
  return `₹${Math.round(lakhs).toLocaleString("en-IN")} L`;
}
