/**
 * Data-backed Pros & Cons for the stock summary, in the Screener "PROS /
 * CONS" style. Every bullet is rendered from a resolved quick-ratio value —
 * nothing is written editorially — so a bullet is skipped whenever its
 * inputs are missing.
 */

const num = (
  values: Record<string, number | null>,
  id: string,
): number | null => {
  const value = values[id];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const fmtPct1 = (value: number): string =>
  `${value.toLocaleString("en-IN", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;

const fmtMult1 = (value: number): string =>
  value.toLocaleString("en-IN", { maximumFractionDigits: 2 });

export interface ProsConsInput {
  readonly values: Record<string, number | null>;
}

export interface ProsCons {
  readonly pros: readonly string[];
  readonly cons: readonly string[];
}

export function buildProsCons(input: ProsConsInput): ProsCons {
  const { values } = input;
  const pros: string[] = [];
  const cons: string[] = [];

  const profitGrowth5y = num(values, "profit-growth-5years");
  if (profitGrowth5y !== null && profitGrowth5y >= 15) {
    pros.push(
      `Company has delivered good profit growth of ${fmtPct1(profitGrowth5y)} CAGR over the last 5 years.`,
    );
  } else if (profitGrowth5y !== null && profitGrowth5y <= 0) {
    cons.push(
      `Profit growth has been muted at ${fmtPct1(profitGrowth5y)} CAGR over the last 5 years.`,
    );
  }

  const salesGrowth5y = num(values, "sales-growth-5years");
  if (salesGrowth5y !== null && salesGrowth5y >= 10) {
    pros.push(
      `Sales have compounded at ${fmtPct1(salesGrowth5y)} CAGR over the last 5 years.`,
    );
  } else if (salesGrowth5y !== null && salesGrowth5y <= 0) {
    cons.push(
      `Sales have shrunk at ${fmtPct1(salesGrowth5y)} CAGR over the last 5 years.`,
    );
  }

  const payout =
    num(values, "dividend-payout") ?? num(values, "dividend-payout-ratio");
  if (payout !== null && payout >= 25) {
    pros.push(
      `Company has been maintaining a healthy dividend payout of ${fmtPct1(payout)}.`,
    );
  }

  const roe3y = num(values, "average-return-on-equity-3years");
  const roce = num(values, "return-on-capital-employed");
  if (roe3y !== null && roe3y >= 15) {
    pros.push(
      `High return on equity of ${fmtPct1(roe3y)} on average over the last 3 years.`,
    );
  }
  if (roce !== null && roce >= 15 && (roe3y === null || roe3y < 15)) {
    pros.push(`Healthy return on capital employed of ${fmtPct1(roce)}.`);
  }

  const debtEquity = num(values, "debt-to-equity");
  if (debtEquity !== null && debtEquity <= 0.3) {
    pros.push(
      `Almost debt free with a debt to equity of ${fmtMult1(debtEquity)}.`,
    );
  } else if (debtEquity !== null && debtEquity >= 1.5) {
    cons.push(
      `High debt burden with a debt to equity of ${fmtMult1(debtEquity)}.`,
    );
  }

  const interestCover =
    num(values, "interest-coverage-ratio") ?? num(values, "interest-coverage");
  if (interestCover !== null && interestCover < 1.5) {
    cons.push(`Weak interest coverage of ${fmtMult1(interestCover)} times.`);
  }

  const pb = num(values, "price-to-book-value");
  if (pb !== null && pb >= 5) {
    cons.push(`Stock is trading at ${fmtMult1(pb)} times its book value.`);
  }

  const pe = num(values, "price-to-earning");
  const eps = num(values, "eps");
  if (pe !== null && pe >= 50 && (eps === null || eps <= 0)) {
    cons.push(
      `Expensive valuation at a P/E of ${fmtMult1(pe)} with weak earnings.`,
    );
  } else if (pe !== null && pe >= 60) {
    cons.push(`Expensive valuation at a P/E of ${fmtMult1(pe)}.`);
  }

  const opm = num(values, "opm-last-year");
  if (opm !== null && opm < 0) {
    cons.push(
      `Loss-making operations with an operating margin of ${fmtPct1(opm)}.`,
    );
  }

  return { pros: pros.slice(0, 4), cons: cons.slice(0, 4) };
}
