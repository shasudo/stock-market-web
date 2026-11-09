"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
} from "react";
import type {
  CustomDividend,
  CustomEarning,
  CustomEconomicEvent,
  CustomExpiration,
  CustomHoliday,
  CustomIPO,
  CustomSplit,
} from "@/hooks/useCalendarData";

export type CalendarTab =
  | "Economic Calendar"
  | "Holidays"
  | "Earnings"
  | "Dividends"
  | "Splits"
  | "IPO"
  | "Expiration";

type FormValues = Record<string, string>;

interface CalendarFormField {
  name: string;
  label: string;
  placeholder: string;
  type?: "number" | "text";
}

interface CalendarFormConfig {
  title: string;
  fields: readonly CalendarFormField[];
}

interface AddEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: CalendarTab;
  onAddEconomic: (data: Omit<CustomEconomicEvent, "id">) => void;
  onAddHoliday: (data: Omit<CustomHoliday, "id">) => void;
  onAddEarning: (data: Omit<CustomEarning, "id">) => void;
  onAddDividend: (data: Omit<CustomDividend, "id">) => void;
  onAddSplit: (data: Omit<CustomSplit, "id">) => void;
  onAddIPO: (data: Omit<CustomIPO, "id">) => void;
  onAddExpiration: (data: Omit<CustomExpiration, "id">) => void;
}

const formConfigs: Readonly<Record<CalendarTab, CalendarFormConfig>> = {
  "Economic Calendar": {
    title: "Add Economic Event",
    fields: [
      {
        name: "date",
        label: "Date",
        placeholder: "Today / Tomorrow / Yesterday",
      },
      { name: "time", label: "Time", placeholder: "e.g., 14:30" },
      { name: "currency", label: "Currency", placeholder: "e.g., USD" },
      { name: "event", label: "Event", placeholder: "e.g., CPI (MoM)" },
      {
        name: "importance",
        label: "Importance (1-3)",
        placeholder: "1, 2, or 3",
        type: "number",
      },
      { name: "actual", label: "Actual", placeholder: "e.g., 0.3%" },
      { name: "forecast", label: "Forecast", placeholder: "e.g., 0.2%" },
      { name: "previous", label: "Previous", placeholder: "e.g., 0.1%" },
    ],
  },
  Holidays: {
    title: "Add Holiday",
    fields: [
      { name: "date", label: "Date", placeholder: "e.g., Dec 25, 2025" },
      { name: "country", label: "Country", placeholder: "e.g., United States" },
      { name: "exchange", label: "Exchange Name", placeholder: "e.g., NYSE" },
      {
        name: "holiday",
        label: "Holiday Name",
        placeholder: "e.g., Christmas Day",
      },
    ],
  },
  Earnings: {
    title: "Add Earnings",
    fields: [
      { name: "date", label: "Date", placeholder: "Today / Tomorrow" },
      { name: "time", label: "Time", placeholder: "Pre-Market / After Hours" },
      { name: "company", label: "Company", placeholder: "e.g., Apple (AAPL)" },
      { name: "eps", label: "EPS", placeholder: "e.g., 1.52" },
      { name: "epsForecast", label: "EPS Forecast", placeholder: "e.g., 1.48" },
      { name: "revenue", label: "Revenue", placeholder: "e.g., 95.2B" },
      {
        name: "revenueForecast",
        label: "Revenue Forecast",
        placeholder: "e.g., 92.1B",
      },
      { name: "marketCap", label: "Market Cap", placeholder: "e.g., 2.5T" },
    ],
  },
  Dividends: {
    title: "Add Dividend",
    fields: [
      { name: "date", label: "Date", placeholder: "e.g., Dec 17, 2025" },
      {
        name: "company",
        label: "Company",
        placeholder: "e.g., Microsoft (MSFT)",
      },
      {
        name: "exDivDate",
        label: "Ex-Dividend Date",
        placeholder: "e.g., Dec 17, 2025",
      },
      { name: "dividend", label: "Dividend", placeholder: "e.g., 0.75" },
      { name: "type", label: "Type", placeholder: "e.g., 3M (Quarterly)" },
      {
        name: "paymentDate",
        label: "Payment Date",
        placeholder: "e.g., Dec 31, 2025",
      },
      { name: "yield", label: "Yield", placeholder: "e.g., 2.5%" },
    ],
  },
  Splits: {
    title: "Add Stock Split",
    fields: [
      { name: "date", label: "Split Date", placeholder: "e.g., Dec 20, 2025" },
      { name: "company", label: "Company", placeholder: "e.g., Tesla (TSLA)" },
      { name: "ratio", label: "Split Ratio", placeholder: "e.g., 3:1" },
      {
        name: "exDate",
        label: "Ex-Date",
        placeholder: "e.g., Today (optional)",
      },
    ],
  },
  IPO: {
    title: "Add IPO",
    fields: [
      {
        name: "date",
        label: "Listing Date",
        placeholder: "e.g., Dec 15, 2025",
      },
      { name: "company", label: "Company", placeholder: "e.g., NewCorp (NEW)" },
      { name: "exchange", label: "Exchange", placeholder: "e.g., NASDAQ" },
      { name: "ipoValue", label: "IPO Value", placeholder: "e.g., 150.0M" },
      { name: "price", label: "IPO Price", placeholder: "e.g., 25.00" },
      { name: "last", label: "Last Price", placeholder: "e.g., 27.50" },
    ],
  },
  Expiration: {
    title: "Add Expiration",
    fields: [
      {
        name: "instrument",
        label: "Instrument",
        placeholder: "e.g., S&P 500 VIX",
      },
      { name: "contract", label: "Contract", placeholder: "e.g., VXc1" },
      { name: "month", label: "Month", placeholder: "e.g., Dec 25" },
      {
        name: "settlement",
        label: "Settlement",
        placeholder: "e.g., Dec 17, 2025",
      },
      {
        name: "rollover",
        label: "Last Rollover",
        placeholder: "e.g., Nov 19, 2025",
      },
    ],
  },
};

function readField(values: FormValues, fieldName: string): string {
  return values[fieldName]?.trim() ?? "";
}

function clampImportance(value: string): number {
  const parsedValue = Number.parseInt(value, 10);
  const defaultImportance = 2;

  if (!Number.isFinite(parsedValue)) {
    return defaultImportance;
  }

  return Math.min(3, Math.max(1, parsedValue));
}

export default function AddEntryModal({
  isOpen,
  onClose,
  activeTab,
  onAddEconomic,
  onAddHoliday,
  onAddEarning,
  onAddDividend,
  onAddSplit,
  onAddIPO,
  onAddExpiration,
}: AddEntryModalProps): ReactElement | null {
  const [formData, setFormData] = useState<FormValues>({});
  const [formError, setFormError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const errorId = useId();
  const config = formConfigs[activeTab];

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previouslyFocusedElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") {
        return;
      }

      setFormData({});
      setFormError(null);
      onClose();
    };

    document.addEventListener("keydown", closeOnEscape);
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      previouslyFocusedElement?.focus();
    };
  }, [isOpen, onClose]);

  const handleClose = (): void => {
    setFormData({});
    setFormError(null);
    onClose();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (config.fields.some((field) => !readField(formData, field.name))) {
      setFormError("Complete all fields before adding this entry.");
      return;
    }

    switch (activeTab) {
      case "Economic Calendar":
        onAddEconomic({
          date: readField(formData, "date"),
          time: readField(formData, "time"),
          currency: readField(formData, "currency"),
          event: readField(formData, "event"),
          importance: clampImportance(readField(formData, "importance")),
          actual: readField(formData, "actual"),
          forecast: readField(formData, "forecast"),
          previous: readField(formData, "previous"),
        });
        break;
      case "Holidays":
        onAddHoliday({
          date: readField(formData, "date"),
          country: readField(formData, "country"),
          exchange: readField(formData, "exchange"),
          holiday: readField(formData, "holiday"),
        });
        break;
      case "Earnings":
        onAddEarning({
          date: readField(formData, "date"),
          time: readField(formData, "time"),
          company: readField(formData, "company"),
          eps: readField(formData, "eps"),
          epsForecast: readField(formData, "epsForecast"),
          revenue: readField(formData, "revenue"),
          revenueForecast: readField(formData, "revenueForecast"),
          marketCap: readField(formData, "marketCap"),
        });
        break;
      case "Dividends":
        onAddDividend({
          date: readField(formData, "date"),
          company: readField(formData, "company"),
          exDivDate: readField(formData, "exDivDate"),
          dividend: readField(formData, "dividend"),
          type: readField(formData, "type"),
          paymentDate: readField(formData, "paymentDate"),
          yield: readField(formData, "yield"),
        });
        break;
      case "Splits":
        onAddSplit({
          date: readField(formData, "date"),
          company: readField(formData, "company"),
          ratio: readField(formData, "ratio"),
          exDate: readField(formData, "exDate"),
        });
        break;
      case "IPO":
        onAddIPO({
          date: readField(formData, "date"),
          company: readField(formData, "company"),
          exchange: readField(formData, "exchange"),
          ipoValue: readField(formData, "ipoValue"),
          price: readField(formData, "price"),
          last: readField(formData, "last"),
        });
        break;
      case "Expiration":
        onAddExpiration({
          instrument: readField(formData, "instrument"),
          contract: readField(formData, "contract"),
          month: readField(formData, "month"),
          settlement: readField(formData, "settlement"),
          rollover: readField(formData, "rollover"),
        });
        break;
    }

    handleClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={formError ? errorId : undefined}
        tabIndex={-1}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-card shadow-2xl focus:outline-none"
      >
        <div className="flex items-center justify-between border-b border-border bg-primary px-6 py-4">
          <h3
            id={titleId}
            className="text-lg font-semibold text-primary-foreground"
          >
            {config.title}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close dialog"
            className="text-primary-foreground/80 transition-colors hover:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {formError && (
              <p
                id={errorId}
                role="alert"
                className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-sm text-error"
              >
                {formError}
              </p>
            )}
            {config.fields.map((field) => {
              const fieldId = `${titleId}-${field.name}`;
              const fieldValue = formData[field.name] ?? "";

              return (
                <div key={field.name}>
                  <label
                    htmlFor={fieldId}
                    className="mb-1 block text-sm font-medium text-muted-foreground"
                  >
                    {field.label}
                  </label>
                  <input
                    id={fieldId}
                    name={field.name}
                    type={field.type ?? "text"}
                    placeholder={field.placeholder}
                    value={fieldValue}
                    onChange={(changeEvent) => {
                      setFormData((currentData) => ({
                        ...currentData,
                        [field.name]: changeEvent.target.value,
                      }));
                      setFormError(null);
                    }}
                    aria-invalid={Boolean(formError && !fieldValue.trim())}
                    aria-describedby={
                      formError && !fieldValue.trim() ? errorId : undefined
                    }
                    className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                    min={field.type === "number" ? 1 : undefined}
                    max={field.type === "number" ? 3 : undefined}
                    required
                  />
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 border-t border-border bg-muted px-6 py-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              Add Entry
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
