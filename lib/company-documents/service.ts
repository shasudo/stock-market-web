import axios from "axios";
import { CircuitBreaker, retry } from "@/lib/resilience";
import { logger, serializeError } from "@/lib/logger";
import {
  buildCompanyDocuments,
  type CompanyDocumentsResponse,
} from "./documents";

const NSE_API = "https://www.nseindia.com/api";
const USER_AGENT = "Mozilla/5.0";
const REQUEST_TIMEOUT_MS = 20_000;
const ANNOUNCEMENT_WINDOW_DAYS = 365;
const CACHE_TTL_MS = 15 * 60_000;
const MAX_CACHE_ENTRIES = 300;

/**
 * NSE answers these company endpoints to plain server requests, like the
 * shareholding master the super-investor sync uses. If NSE starts refusing
 * them the section shows as unavailable; nothing retries around a block.
 */
const breaker = new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 120_000 });

export type NseJsonFetcher = (url: string) => Promise<unknown>;

export const fetchNseJson: NseJsonFetcher = (url) =>
  breaker.execute(() =>
    retry(
      async () => {
        const response = await axios.get<unknown>(url, {
          headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
          timeout: REQUEST_TIMEOUT_MS,
        });
        return response.data;
      },
      {
        maxAttempts: 2,
        initialDelayMs: 1_000,
        maxDelayMs: 3_000,
        shouldRetry: (error) =>
          axios.isAxiosError(error) &&
          (error.response === undefined || error.response.status >= 500),
      },
    ),
  );

function ddMmYyyy(date: Date): string {
  const ist = new Date(date.getTime() + 19_800_000);
  return `${String(ist.getUTCDate()).padStart(2, "0")}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-${ist.getUTCFullYear()}`;
}

export function companyDocumentUrls(symbol: string, now: Date) {
  const encoded = encodeURIComponent(symbol);
  const from = new Date(now.getTime() - ANNOUNCEMENT_WINDOW_DAYS * 86_400_000);
  return {
    actions: `${NSE_API}/corporates-corporateActions?index=equities&symbol=${encoded}`,
    announcements: `${NSE_API}/corporate-announcements?index=equities&symbol=${encoded}&from_date=${ddMmYyyy(from)}&to_date=${ddMmYyyy(now)}`,
    annualReports: `${NSE_API}/annual-reports?index=equities&symbol=${encoded}`,
  };
}

export interface CompanyDocumentsServiceDependencies {
  readonly fetchJson: NseJsonFetcher;
  readonly now?: () => Date;
}

/** Corporate actions, last year's announcements and annual reports for one NSE symbol. */
export class CompanyDocumentsService {
  private readonly cache = new Map<string, { at: number; value: CompanyDocumentsResponse }>();
  private readonly inflight = new Map<string, Promise<CompanyDocumentsResponse>>();

  public constructor(private readonly dependencies: CompanyDocumentsServiceDependencies) {}

  public async getDocuments(symbol: string): Promise<CompanyDocumentsResponse> {
    const now = this.now();
    const cached = this.cache.get(symbol);
    if (cached && now.getTime() - cached.at < CACHE_TTL_MS) return cached.value;

    let running = this.inflight.get(symbol);
    if (!running) {
      running = this.load(symbol, now).finally(() => this.inflight.delete(symbol));
      this.inflight.set(symbol, running);
    }
    const value = await running;
    if (value.unavailable.length === 0) {
      if (this.cache.size >= MAX_CACHE_ENTRIES) {
        const oldest = this.cache.keys().next().value;
        if (oldest !== undefined) this.cache.delete(oldest);
      }
      this.cache.set(symbol, { at: now.getTime(), value });
    }
    return value;
  }

  private now(): Date {
    return this.dependencies.now?.() ?? new Date();
  }

  private async load(symbol: string, now: Date): Promise<CompanyDocumentsResponse> {
    const urls = companyDocumentUrls(symbol, now);
    const keys = ["actions", "announcements", "annualReports"] as const;
    const settled = await Promise.allSettled(
      keys.map((key) => this.dependencies.fetchJson(urls[key])),
    );
    const unavailable: (typeof keys)[number][] = [];
    const payload: Record<(typeof keys)[number], unknown> = {
      actions: null,
      announcements: null,
      annualReports: null,
    };
    settled.forEach((result, index) => {
      const key = keys[index]!;
      if (result.status === "fulfilled") {
        payload[key] = result.value;
      } else {
        unavailable.push(key);
        logger.warn("Company documents request failed", {
          endpoint: "stocks/documents",
          symbol,
          section: key,
          error: serializeError(result.reason),
        });
      }
    });
    return buildCompanyDocuments({ symbol, ...payload, unavailable, fetchedAt: now });
  }
}
