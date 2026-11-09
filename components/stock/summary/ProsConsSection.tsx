"use client";

import { buildProsCons } from "@/lib/fundamentals/pros-cons";

export function ProsConsSection({
  values,
}: {
  values: Record<string, number | null> | null;
}) {
  if (!values) return null;
  const { pros, cons } = buildProsCons({ values });
  if (pros.length === 0 && cons.length === 0) return null;
  return (
    <section
      id="analysis"
      className="scroll-mt-24 rounded-2xl border border-border/90 bg-card p-4 shadow-xs md:p-5"
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-foreground">
            Pros
          </h2>
          {pros.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No clear strengths in the latest data.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {pros.map((pro) => (
                <li
                  key={pro}
                  className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"
                >
                  <span
                    aria-hidden="true"
                    className="mt-0.5 font-bold text-emerald-600"
                  >
                    ✓
                  </span>
                  {pro}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-foreground">
            Cons
          </h2>
          {cons.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No clear weaknesses in the latest data.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {cons.map((con) => (
                <li
                  key={con}
                  className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"
                >
                  <span
                    aria-hidden="true"
                    className="mt-0.5 font-bold text-error"
                  >
                    ✕
                  </span>
                  {con}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        *Generated from the company&apos;s financial data.
      </p>
    </section>
  );
}
