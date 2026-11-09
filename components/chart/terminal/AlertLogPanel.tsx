"use client";

import { useEffect, useState } from "react";
import {
  clearAlertTriggerLog,
  readAlertTriggerLog,
  type AlertTrigger,
} from "./alerts";
import { formatNumber } from "./ui";

/** TradingView-style docked Log tab: every alert trigger, newest first. */
export default function AlertLogPanel() {
  const [log, setLog] = useState<readonly AlertTrigger[]>(() =>
    typeof window === "undefined" ? [] : readAlertTriggerLog(),
  );

  useEffect(() => {
    const timer = setInterval(() => setLog(readAlertTriggerLog()), 5_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section aria-label="Alert log" className="flex min-h-0 flex-1 flex-col">
      {log.length === 0 ? (
        <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">
          No alerts triggered yet! You will see a list here when they do.
        </p>
      ) : (
        <>
          <div className="flex justify-end px-3 py-1.5">
            <button
              type="button"
              onClick={() => {
                clearAlertTriggerLog();
                setLog(readAlertTriggerLog());
              }}
              className="text-[12px] font-semibold text-muted-foreground hover:text-error"
            >
              Clear log
            </button>
          </div>
          <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 pb-3">
            {log.map((entry, index) => (
              <li
                key={`${entry.at}-${index}`}
                className="rounded-lg border border-border px-3 py-2 text-[13px]"
              >
                <p className="font-semibold text-foreground">
                  {entry.symbol} {entry.condition} ₹{formatNumber(entry.price)}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  {new Date(entry.at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
