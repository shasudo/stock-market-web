/** Relocated from the retired server module of the same domain.
 *  The shape is unchanged; Java serves it now, this file only types it. */
export type HolderCategory = "promoters" | "fiis" | "diis" | "public";

export interface ShareholdingHolderLine {
  readonly category: HolderCategory;
  /** Identity across quarters (the investor key the super-investor sync assigns). */
  readonly key: string;
  /** Name as filed in the latest quarter that lists the holder. */
  readonly name: string;
  /** asOfDate (YYYY-MM-DD) to % of shares as filed; absent when not listed that quarter. */
  readonly values: Readonly<Record<string, number>>;
}

export interface ShareholdingPatternResponse {
  readonly symbol: string;
  /** Oldest first, at most MAX_QUARTERS. */
  readonly quarters: readonly ShareholdingQuarter[];
  /**
   * Every promoter-group entity and every public holder above the 1%
   * disclosure threshold, per category, largest in the latest quarter first.
   */
  readonly holders: readonly ShareholdingHolderLine[];
}

export interface ShareholdingQuarter {
  /** Quarter end the pattern is "as on", YYYY-MM-DD. */
  readonly asOfDate: string;
  readonly promoters: number | null;
  readonly fiis: number | null;
  readonly diis: number | null;
  readonly government: number | null;
  readonly public: number | null;
  readonly others: number | null;
  readonly shareholders: number | null;
  /** When the company filed it with the exchange. */
  readonly filedAt: string;
  readonly documentUrl: string;
}

/** Category rows that expand into named holders (screener-style "+" rows). */
