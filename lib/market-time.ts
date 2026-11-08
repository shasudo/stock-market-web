/** IST market-session state for the top strip. NSE/BSE hours 09:15–15:30 IST. */

export type SessionState = "PRE-OPEN" | "LIVE" | "CLOSED";

const OPEN_MIN = 9 * 60 + 15;
const CLOSE_MIN = 15 * 60 + 30;

export function istParts(now: Date): { minutes: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    weekday: "short",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { minutes: Number(get("hour")) * 60 + Number(get("minute")), weekday };
}

export function sessionState(now: Date): SessionState {
  const { minutes, weekday } = istParts(now);
  if (weekday === 0 || weekday === 6) return "CLOSED";
  if (minutes < OPEN_MIN) return "PRE-OPEN";
  if (minutes <= CLOSE_MIN) return "LIVE";
  return "CLOSED";
}

export function istClockLabel(now: Date): string {
  return now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
}
