import assert from "node:assert/strict";
import test from "node:test";

import { normalizeShareholdingQuarter } from "../../lib/shareholding-pattern/normalize";

// Live RELIANCE shape: the public slice arrives as `publicShare` and the
// `public` key is absent entirely.
const relianceQuarter = {
  asOfDate: "2026-09-30",
  promoters: 50.44,
  fiis: 16.67,
  diis: 21.72,
  government: 0.1,
  publicShare: 11.07,
  others: null,
  shareholders: 5072457,
  filedAt: "2026-10-21T10:55:15Z",
  documentUrl: "https://example.invalid/shp.xml",
};

test("normalizeShareholdingQuarter maps the live wire shape", () => {
  const quarter = normalizeShareholdingQuarter(relianceQuarter);
  assert.notEqual(quarter, null);
  assert.equal(quarter?.public, 11.07);
  assert.equal(quarter?.promoters, 50.44);
  assert.equal(quarter?.others, null);
  assert.equal(quarter?.shareholders, 5072457);
  assert.equal(
    Object.values(quarter ?? {}).every(
      (value) => typeof value === "string" || typeof value === "number" || value === null,
    ),
    true,
  );
});

test("normalizeShareholdingQuarter prefers the canonical public field", () => {
  const quarter = normalizeShareholdingQuarter({
    ...relianceQuarter,
    public: 10.5,
  });
  assert.equal(quarter?.public, 10.5);
});

test("normalizeShareholdingQuarter coerces gaps to null, never undefined", () => {
  const quarter = normalizeShareholdingQuarter({
    asOfDate: "2026-09-30",
    promoters: Number.NaN,
    fiis: "16.67",
  });
  assert.notEqual(quarter, null);
  assert.equal(quarter?.promoters, null);
  assert.equal(quarter?.fiis, null);
  assert.equal(quarter?.diis, null);
  assert.equal(quarter?.public, null);
  assert.equal(quarter?.government, null);
  assert.equal(quarter?.others, null);
  assert.equal(quarter?.shareholders, null);
  for (const value of Object.values(quarter ?? {})) {
    assert.notEqual(value, undefined);
  }
});

test("normalizeShareholdingQuarter rejects non-quarters", () => {
  assert.equal(normalizeShareholdingQuarter(null), null);
  assert.equal(normalizeShareholdingQuarter([]), null);
  assert.equal(normalizeShareholdingQuarter("2026-09-30"), null);
  assert.equal(normalizeShareholdingQuarter({ promoters: 50 }), null);
});
