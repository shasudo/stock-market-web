import axios from "axios";
import { CircuitBreaker, retry } from "@/lib/resilience";
import { logger, serializeError } from "@/lib/logger";

export type FiiDiiSource = "combined" | "nse";

export interface FiiDiiDayFlow {
  readonly tradeDate: Date;
  readonly source: FiiDiiSource;
  readonly fiiBuy: number;
  readonly fiiSell: number;
  readonly fiiNet: number;
  readonly diiBuy: number;
  readonly diiSell: number;
  readonly diiNet: number;
}

interface NseFiiDiiRow {
  readonly category?: unknown;
  readonly date?: unknown;
  readonly buyValue?: unknown;
  readonly sellValue?: unknown;
  readonly netValue?: unknown;
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const REQUEST_TIMEOUT_MS = 15_000;

const ENDPOINTS: Record<FiiDiiSource, string> = {
  combined: "https://www.nseindia.com/api/fiidiiTradeReact",
  nse: "https://www.nseindia.com/api/fiidiiTradeNse",
};

const breaker = new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 60_000 });

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

const DATE_RE = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/;
const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export function parseTradeDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = DATE_RE.exec(value.trim());
  if (!match) return null;
  const [, day, mon, year] = match;
  const month = MONTHS[mon.toLowerCase()];
  if (month === undefined) return null;
  const date = new Date(Date.UTC(Number(year), month, Number(day)));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Pure — turns one NSE JSON payload into a dated flow. No network. */
export function parseFiiDiiPayload(
  payload: unknown,
  source: FiiDiiSource,
): FiiDiiDayFlow | null {
  if (!Array.isArray(payload)) return null;
  let fii: NseFiiDiiRow | null = null;
  let dii: NseFiiDiiRow | null = null;
  for (const row of payload as NseFiiDiiRow[]) {
    if (!row || typeof row !== "object") continue;
    const category =
      typeof row.category === "string" ? row.category.toUpperCase() : "";
    if (category.includes("FII") || category.includes("FPI")) fii = row;
    else if (category.includes("DII")) dii = row;
  }
  if (!fii || !dii) return null;

  const tradeDate = parseTradeDate(fii.date ?? dii.date);
  const fiiBuy = toNumber(fii.buyValue);
  const fiiSell = toNumber(fii.sellValue);
  const fiiNet = toNumber(fii.netValue);
  const diiBuy = toNumber(dii.buyValue);
  const diiSell = toNumber(dii.sellValue);
  const diiNet = toNumber(dii.netValue);
  if (
    tradeDate === null ||
    fiiBuy === null ||
    fiiSell === null ||
    fiiNet === null ||
    diiBuy === null ||
    diiSell === null ||
    diiNet === null
  ) {
    return null;
  }
  return { tradeDate, source, fiiBuy, fiiSell, fiiNet, diiBuy, diiSell, diiNet };
}

async function fetchWithCookies(url: string): Promise<unknown> {
  const directHeaders = {
    "User-Agent": USER_AGENT,
    Accept: "application/json",
    Referer: "https://www.nseindia.com/reports/fii-dii",
  };
  try {
    const direct = await axios.get<unknown>(url, {
      headers: directHeaders,
      timeout: REQUEST_TIMEOUT_MS,
      validateStatus: (status) => status === 200,
    });
    return direct.data;
  } catch (directError) {
    logger.debug("FII/DII direct fetch failed, retrying with cookies", {
      url,
      error: serializeError(directError),
    });
  }

  const home = await axios.get<string>("https://www.nseindia.com", {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    timeout: REQUEST_TIMEOUT_MS,
    responseType: "text",
    validateStatus: (status) => status === 200,
  });
  const cookies = (home.headers["set-cookie"] ?? [])
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean)
    .join("; ");

  const response = await axios.get<unknown>(url, {
    headers: { ...directHeaders, ...(cookies ? { Cookie: cookies } : {}) },
    timeout: REQUEST_TIMEOUT_MS,
    validateStatus: (status) => status === 200,
  });
  return response.data;
}

export async function fetchFiiDiiSource(
  source: FiiDiiSource,
): Promise<FiiDiiDayFlow | null> {
  const data = await breaker.execute(() =>
    retry(() => fetchWithCookies(ENDPOINTS[source]), {
      maxAttempts: 3,
      initialDelayMs: 1_000,
      maxDelayMs: 5_000,
      shouldRetry: (error) =>
        axios.isAxiosError(error) &&
        (error.response === undefined ||
          (error.response.status ?? 500) >= 500 ||
          error.response.status === 403),
    }),
  );
  return parseFiiDiiPayload(data, source);
}

export async function fetchAllFiiDii(): Promise<FiiDiiDayFlow[]> {
  const flows: FiiDiiDayFlow[] = [];
  for (const source of ["combined", "nse"] as const) {
    try {
      const flow = await fetchFiiDiiSource(source);
      if (flow) flows.push(flow);
    } catch (error) {
      logger.warn("FII/DII source fetch failed", {
        source,
        error: serializeError(error),
      });
    }
  }
  return flows;
}
