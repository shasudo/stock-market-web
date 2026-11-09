/** Human-readable text for scans: the clause rows, Explain, and copy-as-text. */
import { getMeasure, getSegment, timeframeText } from "./catalog";
import type { Arg, Clause, CompareOp, Expr, Group, Scan, ScanNode, Term } from "./scan-types";

export const OP_LABELS: Record<CompareOp, string> = {
  "=": "Equals",
  "!=": "Not equals",
  ">": "Greater than",
  ">=": "Greater than equal to",
  "<": "Less than",
  "<=": "Less than equal to",
  "crossed-above": "Crossed above",
  "crossed-below": "Crossed below",
};

export const OP_SYMBOLS: Record<CompareOp, string> = {
  "=": "=",
  "!=": "!=",
  ">": ">",
  ">=": ">=",
  "<": "<",
  "<=": "<=",
  "crossed-above": "crossed above",
  "crossed-below": "crossed below",
};

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "–";
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

function argText(arg: Arg): string {
  switch (arg.kind) {
    case "number":
      return formatNumber(arg.value);
    case "source":
      return arg.value;
    case "expr":
      return exprText(arg.expr);
    case "filter":
      return clauseText(arg.clause);
  }
}

export function measureName(term: Extract<Term, { kind: "measure" }>): string {
  const def = getMeasure(term.measure);
  if (!def) return term.measure;
  return def.short === undefined ? def.label : def.short;
}

export function termText(term: Term): string {
  if (term.kind === "number") return formatNumber(term.value);
  if (term.kind === "text") return `"${term.value}"`;
  const def = getMeasure(term.measure);
  const name = measureName(term);
  const args = term.args.length ? `(${term.args.map(argText).join(", ")})` : "";
  if (def?.category === "Math functions") return `${name}${args}`;
  if (!def?.timeframed) return `${name}${args}`;
  return `${timeframeText(term.timeframe, term.offset)} ${name}${args}`;
}

export function exprText(expr: Expr | null): string {
  if (!expr || expr.terms.length === 0) return "";
  return expr.terms
    .map((term, index) => (index === 0 ? termText(term) : `${expr.ops[index - 1] ?? "+"} ${termText(term)}`))
    .join(" ");
}

export function clauseText(clause: Clause): string {
  const left = exprText(clause.left);
  if (!clause.op || !clause.right || clause.right.terms.length === 0) return left;
  return `${left} ${OP_SYMBOLS[clause.op]} ${exprText(clause.right)}`;
}

export function groupHeadline(group: Group): string {
  const match = group.match === "all" ? "all" : `any ${group.match}`;
  return `${group.mode} ${match} of`;
}

function nodeLines(node: ScanNode, depth: number, out: string[]): void {
  const pad = "  ".repeat(depth);
  const off = node.enabled ? "" : " [disabled]";
  if (node.kind === "clause") {
    out.push(`${pad}• ${clauseText(node)}${off}`);
    return;
  }
  out.push(`${pad}Stock ${groupHeadline(node)}:${off}`);
  node.items.forEach((item) => nodeLines(item, depth + 1, out));
}

/** The whole scan as indented text, the way Explain shows it. */
export function scanText(scan: Scan): string {
  const segment = getSegment(scan.segment)?.label ?? scan.segment;
  const out: string[] = [];
  out.push(`Stock ${groupHeadline(scan.root)} the below filters in ${segment} segment:`);
  scan.root.items.forEach((item) => nodeLines(item, 1, out));
  if (scan.root.items.length === 0) out.push("  (no filters)");
  return out.join("\n");
}

/** One sentence per filter, in plain English. */
export function explainScan(scan: Scan): string[] {
  const segment = getSegment(scan.segment)?.label ?? scan.segment;
  const lines: string[] = [
    `Looks at every stock in the ${segment} segment and keeps the ones that ${scan.root.mode === "passes" ? "pass" : "fail"} ${
      scan.root.match === "all" ? "all" : `at least ${scan.root.match}`
    } of these filters:`,
  ];
  const walk = (node: ScanNode, depth: number): void => {
    if (!node.enabled) return;
    const pad = "   ".repeat(depth);
    if (node.kind === "group") {
      lines.push(
        `${pad}A sub-group that ${node.mode === "passes" ? "passes" : "fails"} ${
          node.match === "all" ? "all" : `any ${node.match}`
        } of:`,
      );
      node.items.forEach((item) => walk(item, depth + 1));
      return;
    }
    lines.push(`${pad}- ${explainClause(node)}`);
  };
  scan.root.items.forEach((item) => walk(item, 0));
  return lines;
}

function explainClause(clause: Clause): string {
  const left = exprText(clause.left);
  if (!clause.op || !clause.right) return `${left} is present`;
  const right = exprText(clause.right);
  switch (clause.op) {
    case "crossed-above":
      return `${left} has just moved from at or below ${right} to above it`;
    case "crossed-below":
      return `${left} has just moved from at or above ${right} to below it`;
    case "=":
      return `${left} equals ${right}`;
    case "!=":
      return `${left} does not equal ${right}`;
    default:
      return `${left} is ${OP_LABELS[clause.op].toLowerCase()} ${right}`;
  }
}
