import axios from "axios";
import AdmZip from "adm-zip";
import { CircuitBreaker, retry } from "@/lib/resilience";
import { logger, serializeError } from "@/lib/logger";

const USER_AGENT = "Mozilla/5.0";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_BACKFILL_DAYS = 7;

const nseCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 60_000,
});

async function requestBuffer(url: string): Promise<Buffer> {
  return nseCircuitBreaker.execute(() =>
    retry(
      async () => {
        const response = await axios.get<ArrayBuffer>(url, {
          headers: { "User-Agent": USER_AGENT },
          timeout: REQUEST_TIMEOUT_MS,
          responseType: "arraybuffer",
          validateStatus: (status) => status === 200,
        });
        return Buffer.from(response.data);
      },
      {
        maxAttempts: 3,
        initialDelayMs: 1_000,
        maxDelayMs: 5_000,
        shouldRetry: (error) =>
          axios.isAxiosError(error) &&
          (error.response === undefined || error.response.status >= 500),
      },
    ),
  );
}

/** bulk.csv / block.csv are always "latest" — no date suffix, no ZIP. */
export async function fetchNseArchiveCsv(path: string): Promise<string> {
  const buffer = await requestBuffer(
    `https://nsearchives.nseindia.com${path}`,
  );
  return buffer.toString("utf-8");
}

export interface NseBhavcopyArchive {
  readonly date: Date;
  readonly dateSuffixDdmmyyyy: string;
  readonly zip: AdmZip;
}

function formatDdmmyy(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(date.getUTCFullYear()).slice(-2);
  return `${dd}${mm}${yy}`;
}

function formatDdmmyyyy(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getUTCFullYear());
  return `${dd}${mm}${yyyy}`;
}

/**
 * NSE only publishes the daily "PR" bhavcopy ZIP on trading days, so this
 * walks backward from today until it finds one (weekends/holidays have no
 * file — a 404 there is expected, not an error). The ZIP bundles corporate
 * actions (bc), price-band hits (bh), board meetings (bm), 52-week hi/lo
 * (hl) and more — see lib/scrape/nse-bhavcopy.ts for the readers.
 */
export async function fetchLatestBhavcopyArchive(): Promise<NseBhavcopyArchive> {
  const today = new Date();

  for (let daysAgo = 0; daysAgo <= MAX_BACKFILL_DAYS; daysAgo += 1) {
    const candidate = new Date(today);
    candidate.setUTCDate(candidate.getUTCDate() - daysAgo);
    const url = `https://nsearchives.nseindia.com/archives/equities/bhavcopy/pr/PR${formatDdmmyy(candidate)}.zip`;

    try {
      const buffer = await requestBuffer(url);
      return {
        date: candidate,
        dateSuffixDdmmyyyy: formatDdmmyyyy(candidate),
        zip: new AdmZip(buffer),
      };
    } catch (error) {
      logger.debug("No NSE bhavcopy archive for candidate date", {
        daysAgo,
        error: serializeError(error),
      });
    }
  }

  throw new Error(
    `No NSE bhavcopy archive found in the last ${MAX_BACKFILL_DAYS} days.`,
  );
}

/** Reads one member file out of a bhavcopy ZIP by its short prefix
 * (e.g. "bc", "bh", "bm", "hl") + extension, e.g. bc03082026.csv. */
export function readBhavcopyEntry(
  archive: NseBhavcopyArchive,
  prefix: string,
  extension: "csv" | "txt",
): string | null {
  const entryName = `${prefix}${archive.dateSuffixDdmmyyyy}.${extension}`;
  const entry = archive.zip.getEntry(entryName);
  return entry ? archive.zip.readAsText(entry) : null;
}
