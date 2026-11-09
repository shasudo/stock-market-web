"use client";

import { useCallback, useSyncExternalStore } from "react";
import { logger, serializeError } from "@/lib/logger";

export interface CustomEconomicEvent {
  id: string;
  date: string;
  time: string;
  currency: string;
  event: string;
  importance: number;
  actual: string;
  forecast: string;
  previous: string;
}

export interface CustomHoliday {
  id: string;
  date: string;
  country: string;
  exchange: string;
  holiday: string;
}

export interface CustomEarning {
  id: string;
  date: string;
  time: string;
  company: string;
  eps: string;
  epsForecast: string;
  revenue: string;
  revenueForecast: string;
  marketCap: string;
}

export interface CustomDividend {
  id: string;
  date: string;
  company: string;
  exDivDate: string;
  dividend: string;
  type: string;
  paymentDate: string;
  yield: string;
}

export interface CustomSplit {
  id: string;
  date: string;
  company: string;
  ratio: string;
  exDate?: string;
}

export interface CustomIPO {
  id: string;
  date: string;
  company: string;
  exchange: string;
  ipoValue: string;
  price: string;
  last: string;
}

export interface CustomExpiration {
  id: string;
  instrument: string;
  contract: string;
  month: string;
  settlement: string;
  rollover: string;
}

export interface CustomCalendarData {
  economic: CustomEconomicEvent[];
  holidays: CustomHoliday[];
  earnings: CustomEarning[];
  dividends: CustomDividend[];
  splits: CustomSplit[];
  ipo: CustomIPO[];
  expiration: CustomExpiration[];
}

type CalendarDataListener = () => void;
type CalendarDataUpdater = (
  currentData: CustomCalendarData,
) => CustomCalendarData;
type UnknownRecord = Record<string, unknown>;

const STORAGE_KEY = "custom-calendar-data";
const storageListeners = new Set<CalendarDataListener>();

const initialData: CustomCalendarData = {
  economic: [],
  holidays: [],
  earnings: [],
  dividends: [],
  splits: [],
  ipo: [],
  expiration: [],
};

let cachedCalendarData: CustomCalendarData | undefined;

export function useCalendarData() {
  const customData = useSyncExternalStore(
    subscribeToCalendarData,
    getClientCalendarData,
    getServerCalendarData,
  );
  const isLoaded = useSyncExternalStore(
    subscribeToCalendarData,
    getClientLoadedState,
    getServerLoadedState,
  );

  const addEconomicEvent = useCallback(
    (event: Omit<CustomEconomicEvent, "id">): void => {
      updateCalendarData((currentData) => ({
        ...currentData,
        economic: [
          ...currentData.economic,
          { ...event, id: createEntryId("custom-eco") },
        ],
      }));
    },
    [],
  );

  const deleteEconomicEvent = useCallback((id: string): void => {
    updateCalendarData((currentData) => ({
      ...currentData,
      economic: currentData.economic.filter((event) => event.id !== id),
    }));
  }, []);

  const addHoliday = useCallback((holiday: Omit<CustomHoliday, "id">): void => {
    updateCalendarData((currentData) => ({
      ...currentData,
      holidays: [
        ...currentData.holidays,
        { ...holiday, id: createEntryId("custom-hol") },
      ],
    }));
  }, []);

  const deleteHoliday = useCallback((id: string): void => {
    updateCalendarData((currentData) => ({
      ...currentData,
      holidays: currentData.holidays.filter((holiday) => holiday.id !== id),
    }));
  }, []);

  const addEarning = useCallback((earning: Omit<CustomEarning, "id">): void => {
    updateCalendarData((currentData) => ({
      ...currentData,
      earnings: [
        ...currentData.earnings,
        { ...earning, id: createEntryId("custom-ear") },
      ],
    }));
  }, []);

  const deleteEarning = useCallback((id: string): void => {
    updateCalendarData((currentData) => ({
      ...currentData,
      earnings: currentData.earnings.filter((earning) => earning.id !== id),
    }));
  }, []);

  const addDividend = useCallback(
    (dividend: Omit<CustomDividend, "id">): void => {
      updateCalendarData((currentData) => ({
        ...currentData,
        dividends: [
          ...currentData.dividends,
          { ...dividend, id: createEntryId("custom-div") },
        ],
      }));
    },
    [],
  );

  const deleteDividend = useCallback((id: string): void => {
    updateCalendarData((currentData) => ({
      ...currentData,
      dividends: currentData.dividends.filter((dividend) => dividend.id !== id),
    }));
  }, []);

  const addSplit = useCallback((split: Omit<CustomSplit, "id">): void => {
    updateCalendarData((currentData) => ({
      ...currentData,
      splits: [
        ...currentData.splits,
        { ...split, id: createEntryId("custom-spl") },
      ],
    }));
  }, []);

  const deleteSplit = useCallback((id: string): void => {
    updateCalendarData((currentData) => ({
      ...currentData,
      splits: currentData.splits.filter((split) => split.id !== id),
    }));
  }, []);

  const addIPO = useCallback((ipo: Omit<CustomIPO, "id">): void => {
    updateCalendarData((currentData) => ({
      ...currentData,
      ipo: [...currentData.ipo, { ...ipo, id: createEntryId("custom-ipo") }],
    }));
  }, []);

  const deleteIPO = useCallback((id: string): void => {
    updateCalendarData((currentData) => ({
      ...currentData,
      ipo: currentData.ipo.filter((entry) => entry.id !== id),
    }));
  }, []);

  const addExpiration = useCallback(
    (expiration: Omit<CustomExpiration, "id">): void => {
      updateCalendarData((currentData) => ({
        ...currentData,
        expiration: [
          ...currentData.expiration,
          { ...expiration, id: createEntryId("custom-exp") },
        ],
      }));
    },
    [],
  );

  const deleteExpiration = useCallback((id: string): void => {
    updateCalendarData((currentData) => ({
      ...currentData,
      expiration: currentData.expiration.filter(
        (expiration) => expiration.id !== id,
      ),
    }));
  }, []);

  return {
    customData,
    isLoaded,
    addEconomicEvent,
    deleteEconomicEvent,
    addHoliday,
    deleteHoliday,
    addEarning,
    deleteEarning,
    addDividend,
    deleteDividend,
    addSplit,
    deleteSplit,
    addIPO,
    deleteIPO,
    addExpiration,
    deleteExpiration,
  };
}

function subscribeToCalendarData(listener: CalendarDataListener): () => void {
  storageListeners.add(listener);

  if (typeof window === "undefined") {
    return (): void => {
      storageListeners.delete(listener);
    };
  }

  const handleStorageChange = (event: StorageEvent): void => {
    if (event.key !== STORAGE_KEY) {
      return;
    }

    cachedCalendarData = readStoredCalendarData();
    listener();
  };

  window.addEventListener("storage", handleStorageChange);
  return (): void => {
    storageListeners.delete(listener);
    window.removeEventListener("storage", handleStorageChange);
  };
}

function getClientCalendarData(): CustomCalendarData {
  if (typeof window === "undefined") {
    return initialData;
  }

  cachedCalendarData ??= readStoredCalendarData();
  return cachedCalendarData;
}

function getServerCalendarData(): CustomCalendarData {
  return initialData;
}

function getClientLoadedState(): boolean {
  return typeof window !== "undefined";
}

function getServerLoadedState(): boolean {
  return false;
}

function updateCalendarData(updater: CalendarDataUpdater): void {
  const nextData = updater(getClientCalendarData());
  cachedCalendarData = nextData;
  persistCalendarData(nextData);
  storageListeners.forEach((listener) => listener());
}

function readStoredCalendarData(): CustomCalendarData {
  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEY);
    if (!storedValue) {
      return initialData;
    }

    const parsedValue: unknown = JSON.parse(storedValue);
    if (isCustomCalendarData(parsedValue)) {
      return parsedValue;
    }

    logStorageWarning("Ignoring malformed custom calendar data");
  } catch (error) {
    logStorageWarning("Unable to read custom calendar data", error);
  }

  return initialData;
}

function persistCalendarData(data: CustomCalendarData): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    logStorageWarning("Unable to save custom calendar data", error);
  }
}

function createEntryId(prefix: string): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

function logStorageWarning(message: string, error?: unknown): void {
  logger.warn(message, {
    source: "calendar-storage",
    error: error === undefined ? undefined : serializeError(error),
  });
}

function isCustomCalendarData(value: unknown): value is CustomCalendarData {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isArrayOf(value.economic, isCustomEconomicEvent) &&
    isArrayOf(value.holidays, isCustomHoliday) &&
    isArrayOf(value.earnings, isCustomEarning) &&
    isArrayOf(value.dividends, isCustomDividend) &&
    isArrayOf(value.splits, isCustomSplit) &&
    isArrayOf(value.ipo, isCustomIPO) &&
    isArrayOf(value.expiration, isCustomExpiration)
  );
}

function isCustomEconomicEvent(value: unknown): value is CustomEconomicEvent {
  return (
    hasStringProperties(value, [
      "id",
      "date",
      "time",
      "currency",
      "event",
      "actual",
      "forecast",
      "previous",
    ]) &&
    isRecord(value) &&
    typeof value.importance === "number" &&
    Number.isFinite(value.importance)
  );
}

function isCustomHoliday(value: unknown): value is CustomHoliday {
  return hasStringProperties(value, [
    "id",
    "date",
    "country",
    "exchange",
    "holiday",
  ]);
}

function isCustomEarning(value: unknown): value is CustomEarning {
  return hasStringProperties(value, [
    "id",
    "date",
    "time",
    "company",
    "eps",
    "epsForecast",
    "revenue",
    "revenueForecast",
    "marketCap",
  ]);
}

function isCustomDividend(value: unknown): value is CustomDividend {
  return hasStringProperties(value, [
    "id",
    "date",
    "company",
    "exDivDate",
    "dividend",
    "type",
    "paymentDate",
    "yield",
  ]);
}

function isCustomSplit(value: unknown): value is CustomSplit {
  if (
    !hasStringProperties(value, ["id", "date", "company", "ratio"]) ||
    !isRecord(value)
  ) {
    return false;
  }

  return value.exDate === undefined || typeof value.exDate === "string";
}

function isCustomIPO(value: unknown): value is CustomIPO {
  return hasStringProperties(value, [
    "id",
    "date",
    "company",
    "exchange",
    "ipoValue",
    "price",
    "last",
  ]);
}

function isCustomExpiration(value: unknown): value is CustomExpiration {
  return hasStringProperties(value, [
    "id",
    "instrument",
    "contract",
    "month",
    "settlement",
    "rollover",
  ]);
}

function isArrayOf<T>(
  value: unknown,
  isItem: (entry: unknown) => entry is T,
): value is T[] {
  return Array.isArray(value) && value.every(isItem);
}

function hasStringProperties(
  value: unknown,
  propertyNames: readonly string[],
): value is UnknownRecord {
  return (
    isRecord(value) &&
    propertyNames.every(
      (propertyName) => typeof value[propertyName] === "string",
    )
  );
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
