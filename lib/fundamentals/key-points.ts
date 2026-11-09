/**
 * Data-backed Key Points for the stock summary. Every bullet is rendered
 * from a resolved quick-ratio value or the live quote — nothing is written
 * editorially, so a point is skipped whenever its inputs are missing.
 */

const fmtCr = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1e7)
    return `₹${(value / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr`;
  if (abs >= 1e5)
    return `₹${(value / 1e5).toLocaleString("en-IN", { maximumFractionDigits: 2 })} Lakh`;
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

const fmtPrice = (value: number): string =>
  `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const fmtPct = (value: number): string =>
  `${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}%`;

const fmtMult = (value: number): string =>
  value.toLocaleString("en-IN", { maximumFractionDigits: 2 });

const num = (
  values: Record<string, number | null>,
  id: string,
): number | null => {
  const value = values[id];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

export interface KeyPointsInput {
  readonly companyName: string;
  readonly values: Record<string, number | null>;
  readonly price: number | null;
  readonly week52High: number | null;
  readonly week52Low: number | null;
}

export function buildKeyPoints(input: KeyPointsInput): string[] {
  const { values, price, week52High, week52Low, companyName } = input;
  const shortName = companyName.split(" ")[0] || companyName;
  const points: string[] = [];

  const mcap = num(values, "market-capitalization");
  const pe = num(values, "price-to-earning");
  if (mcap !== null && pe !== null) {
    points.push(
      `${shortName} has a market cap of ${fmtCr(mcap)} and trades at a P/E of ${fmtMult(pe)}.`,
    );
  } else if (mcap !== null) {
    points.push(`${shortName} has a market cap of ${fmtCr(mcap)}.`);
  } else if (pe !== null) {
    points.push(`${shortName} trades at a P/E of ${fmtMult(pe)}.`);
  }

  if (week52High !== null && week52Low !== null && price !== null) {
    const belowHigh = ((week52High - price) / week52High) * 100;
    points.push(
      `Touched a 52-week high of ${fmtPrice(week52High)} and low of ${fmtPrice(week52Low)}; currently ${fmtPct(belowHigh)} below the high.`,
    );
  }

  const divYield = num(values, "dividend-yield");
  const payout = num(values, "dividend-payout");
  if (divYield !== null) {
    points.push(
      payout !== null
        ? `Dividend yield of ${fmtPct(divYield)} with a payout ratio of ${fmtPct(payout)}.`
        : `Dividend yield of ${fmtPct(divYield)}.`,
    );
  }

  const de = num(values, "debt-to-equity");
  const roce = num(values, "return-on-capital-employed");
  const roe = num(values, "return-on-equity");
  if (de !== null || roce !== null || roe !== null) {
    const parts: string[] = [];
    if (de !== null) parts.push(`debt-to-equity of ${fmtMult(de)}`);
    if (roce !== null) parts.push(`ROCE of ${fmtPct(roce)}`);
    if (roe !== null) parts.push(`ROE of ${fmtPct(roe)}`);
    points.push(`Balance sheet shows ${parts.join(", ")}.`);
  }

  const salesGrowth = num(values, "sales-growth");
  const profitGrowth = num(values, "profit-growth");
  if (salesGrowth !== null || profitGrowth !== null) {
    const parts: string[] = [];
    if (salesGrowth !== null)
      parts.push(`sales growth of ${fmtPct(salesGrowth)}`);
    if (profitGrowth !== null)
      parts.push(`profit growth of ${fmtPct(profitGrowth)}`);
    points.push(`Recent momentum: ${parts.join(" with ")} (TTM, YoY).`);
  }

  const eps = num(values, "eps");
  const bv = num(values, "book-value");
  if (eps !== null || bv !== null) {
    const parts: string[] = [];
    if (eps !== null) parts.push(`EPS of ${fmtPrice(eps)}`);
    if (bv !== null) parts.push(`book value of ${fmtPrice(bv)} per share`);
    points.push(`Shareholder metrics: ${parts.join(" on a ")}.`);
  }

  return points.slice(0, 6);
}
