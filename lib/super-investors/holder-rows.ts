import {
  classifyHolder,
  resolveInvestorIdentity,
  type SuperInvestorCategory,
} from "./classify";
import type { ShareholdingXbrlDocument } from "./shareholding-xbrl";

export interface HolderRow {
  readonly category: SuperInvestorCategory;
  readonly holderTable: string;
  readonly holderName: string;
  readonly investorKey: string;
  readonly investorName: string;
  readonly shares: number;
  readonly percent: number;
}

/**
 * Named-investor lines of one parsed filing. Aggregate lines, escrow and
 * IEPF accounts and sub-1% public lines are dropped; the same filed name
 * appearing twice in one table (it happens with multiple folios) is summed.
 */
export function buildHolderRows(doc: ShareholdingXbrlDocument): HolderRow[] {
  const rows = new Map<string, HolderRow>();

  for (const holder of doc.holders) {
    const category = classifyHolder(holder);
    if (category === null) continue;
    const identity = resolveInvestorIdentity(holder);
    if (!identity.key) continue;

    const lineKey = `${category}|${holder.table}|${identity.key}|${holder.name.toUpperCase()}`;
    const existing = rows.get(lineKey);
    rows.set(lineKey, {
      category,
      holderTable: holder.table,
      holderName: holder.name,
      investorKey: identity.key,
      investorName: identity.name,
      shares: (existing?.shares ?? 0) + holder.shares,
      percent:
        Math.round(((existing?.percent ?? 0) + holder.percent) * 10_000) /
        10_000,
    });
  }

  return [...rows.values()];
}
