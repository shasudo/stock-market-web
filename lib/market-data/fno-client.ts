/** Relocated from the retired server module of the same domain.
 *  The shape is unchanged; Java serves it now, this file only types it. */
export interface FnoUnderlying {
  readonly symbol: string;
  readonly exchangeSegment: string;
  readonly expiries: readonly string[];
}

export interface OptionLegDTO {
  readonly securityId: number;
  readonly tradingSymbol: string;
  readonly lastPrice: number | null;
  readonly netChange: number | null;
  readonly pctChange: number | null;
  readonly openInterest: number | null;
}

export interface OptionChainRowDTO {
  readonly strikePrice: number;
  readonly call: OptionLegDTO | null;
  readonly put: OptionLegDTO | null;
}

export interface NearMonthFutureDTO {
  readonly underlyingSymbol: string;
  readonly expiryDate: string;
  readonly lotSize: number;
  readonly leg: OptionLegDTO;
}

export interface OptionChainDTO {
  readonly underlyingSymbol: string;
  readonly expiryDate: string;
  readonly rows: readonly OptionChainRowDTO[];
  readonly future: OptionLegDTO | null;
}

export class FnoClientError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "FnoClientError";
  }
}

const UNAVAILABLE_MESSAGE =
  "F&O data is temporarily unavailable. Please try again shortly.";

export async function fetchFnoUnderlyings(
  signal?: AbortSignal,
): Promise<readonly FnoUnderlying[]> {
  const response = await fetch("/api/market-data/fno/underlyings", {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new FnoClientError(getErrorMessage(body));
  }
  if (
    !isRecord(body) ||
    !Array.isArray((body as { underlyings?: unknown }).underlyings)
  ) {
    throw new FnoClientError(UNAVAILABLE_MESSAGE);
  }

  return (body as { underlyings: FnoUnderlying[] }).underlyings;
}

export async function fetchOptionChain(
  underlying: string,
  expiry: string,
  signal?: AbortSignal,
): Promise<OptionChainDTO> {
  const params = new URLSearchParams({ underlying, expiry });
  const response = await fetch(`/api/market-data/fno/option-chain?${params}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new FnoClientError(getErrorMessage(body));
  }
  if (!isRecord(body) || !Array.isArray((body as { rows?: unknown }).rows)) {
    throw new FnoClientError(UNAVAILABLE_MESSAGE);
  }

  return body as unknown as OptionChainDTO;
}

export async function fetchNearMonthFuture(
  underlying: string,
  signal?: AbortSignal,
): Promise<NearMonthFutureDTO> {
  const params = new URLSearchParams({ underlying });
  const response = await fetch(`/api/market-data/fno/future?${params}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new FnoClientError(getErrorMessage(body));
  }
  if (!isRecord(body) || !isRecord((body as { leg?: unknown }).leg)) {
    throw new FnoClientError(UNAVAILABLE_MESSAGE);
  }

  return body as unknown as NearMonthFutureDTO;
}

export function getFnoClientErrorMessage(error: unknown): string {
  return error instanceof FnoClientError ? error.message : UNAVAILABLE_MESSAGE;
}

export function isFnoRequestAborted(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function getErrorMessage(body: unknown): string {
  if (isRecord(body) && typeof body.message === "string" && body.message.trim()) {
    return body.message;
  }
  return UNAVAILABLE_MESSAGE;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}
