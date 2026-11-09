/** Relocated from the retired server module of the same domain.
 *  The shape is unchanged; Java serves it now, this file only types it. */
export interface UnlistedQuote {
  readonly price: number;
  readonly asOf: string;
  readonly source: string;
}

export interface UnlistedSummary {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly symbol: string | null;
  readonly sector: string;
  readonly isin: string | null;
  readonly description: string;
  readonly website: string | null;
  readonly minLotShares: number | null;
  readonly faceValue: number | null;
  readonly active: boolean;
  readonly price: number | null;
  readonly previousPrice: number | null;
  readonly change: number | null;
  readonly changePct: number | null;
  readonly high52: number | null;
  readonly low52: number | null;
  /** When the latest quote was recorded (ISO). */
  readonly updatedAt: string | null;
  /** "manual" or the feed name the latest quote came from. */
  readonly source: string | null;
  readonly quoteCount: number;
}

export interface UnlistedDetail extends UnlistedSummary {
  /** Oldest first. */
  readonly history: readonly UnlistedQuote[];
}

export interface ImportRow {
  readonly name: string;
  readonly symbol: string | null;
  readonly sector: string | null;
  readonly isin: string | null;
  readonly price: number;
  readonly asOf: Date | null;
}

const YEAR_MS = 365 * 86_400_000;
