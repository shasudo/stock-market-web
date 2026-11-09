"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

import { getIndicatorDefinition } from "@/lib/technical/indicator-catalog";
import {
  type IndicatorInstance,
  type IndicatorInstanceSnapshot,
  type IndicatorSeriesMap,
  computeIndicator,
  normalizeIndicatorInstance,
  toInstanceSnapshot,
} from "@/lib/technical/indicator-schema";
import type { Candle } from "@/lib/technical/types";

const DEFAULT_STORAGE_KEY = "chart:indicators";
const DEFAULTS_STORAGE_KEY = "chart:indicator-defaults";
const EMPTY_INSTANCES: readonly IndicatorInstance[] = [];

interface StoredInstance {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly snapshot: IndicatorInstanceSnapshot;
}

export interface UseChartIndicatorsOptions {
  /** localStorage key for the active indicator list; pass null to disable. */
  readonly storageKey?: string | null;
  readonly initialDefinitionIds?: readonly string[];
  readonly candles?: readonly Candle[];
  /** Called with the serialisable list each time it is saved, e.g. to sync it. */
  readonly onPersist?: (payload: unknown) => void;
}

export interface UseChartIndicatorsResult {
  readonly instances: readonly IndicatorInstance[];
  readonly series: Readonly<Record<string, IndicatorSeriesMap>>;
  readonly addIndicator: (definitionId: string) => string | null;
  readonly updateIndicator: (instance: IndicatorInstance) => void;
  readonly removeIndicator: (instanceId: string) => void;
  readonly duplicateIndicator: (instanceId: string) => void;
  readonly toggleHidden: (instanceId: string) => void;
  readonly moveIndicator: (
    instanceId: string,
    direction: "front" | "forward" | "backward" | "back",
  ) => void;
  readonly saveAsDefault: (instance: IndicatorInstance) => void;
  readonly clearDefault: (definitionId: string) => void;
  readonly getInstance: (instanceId: string) => IndicatorInstance | undefined;
}

/**
 * Owns the chart's indicator list: creation from saved per-indicator defaults,
 * edits, persistence, and the computed series each instance produces.
 */
export function useChartIndicators(
  options: UseChartIndicatorsOptions = {},
): UseChartIndicatorsResult {
  const {
    storageKey = DEFAULT_STORAGE_KEY,
    initialDefinitionIds,
    candles,
    onPersist,
  } = options;

  const [store] = useState(() =>
    createIndicatorStore(storageKey, initialDefinitionIds ?? [], onPersist),
  );

  const instances = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  const addIndicator = useCallback(
    (definitionId: string): string | null => {
      const instance = buildInstance(
        definitionId,
        createInstanceId(definitionId),
      );
      if (!instance) return null;
      store.update((current) => [...current, instance]);
      return instance.instanceId;
    },
    [store],
  );

  const updateIndicator = useCallback(
    (instance: IndicatorInstance) => {
      store.update((current) =>
        current.map((candidate) =>
          candidate.instanceId === instance.instanceId ? instance : candidate,
        ),
      );
    },
    [store],
  );

  const removeIndicator = useCallback(
    (instanceId: string) => {
      store.update((current) =>
        current.filter((candidate) => candidate.instanceId !== instanceId),
      );
    },
    [store],
  );

  const duplicateIndicator = useCallback(
    (instanceId: string) => {
      store.update((current) => {
        const source = current.find(
          (candidate) => candidate.instanceId === instanceId,
        );
        if (!source) return current;
        return [
          ...current,
          { ...source, instanceId: createInstanceId(source.definitionId) },
        ];
      });
    },
    [store],
  );

  const toggleHidden = useCallback(
    (instanceId: string) => {
      store.update((current) =>
        current.map((candidate) =>
          candidate.instanceId === instanceId
            ? { ...candidate, hidden: !candidate.hidden }
            : candidate,
        ),
      );
    },
    [store],
  );

  const saveAsDefault = useCallback((instance: IndicatorInstance) => {
    writeSavedDefault(instance.definitionId, toInstanceSnapshot(instance));
  }, []);

  const clearDefault = useCallback((definitionId: string) => {
    writeSavedDefault(definitionId, null);
  }, []);

  const moveIndicator = useCallback(
    (
      instanceId: string,
      direction: "front" | "forward" | "backward" | "back",
    ) => {
      store.update((current) => {
        const index = current.findIndex(
          (candidate) => candidate.instanceId === instanceId,
        );
        if (index < 0) return current;
        const next = [...current];
        const [entry] = next.splice(index, 1);
        if (direction === "front") next.push(entry!);
        else if (direction === "back") next.unshift(entry!);
        else if (direction === "forward")
          next.splice(Math.min(next.length, index + 1), 0, entry!);
        else next.splice(Math.max(0, index - 1), 0, entry!);
        return next;
      });
    },
    [store],
  );

  const getInstance = useCallback(
    (instanceId: string) =>
      instances.find((candidate) => candidate.instanceId === instanceId),
    [instances],
  );

  const series = useMemo(() => {
    if (!candles) return {};
    const computed: Record<string, IndicatorSeriesMap> = {};
    for (const instance of instances) {
      const definition = getIndicatorDefinition(instance.definitionId);
      if (!definition) continue;
      computed[instance.instanceId] = computeIndicator(
        definition,
        instance,
        candles,
      );
    }
    return computed;
  }, [candles, instances]);

  return {
    instances,
    series,
    addIndicator,
    updateIndicator,
    removeIndicator,
    duplicateIndicator,
    toggleHidden,
    moveIndicator,
    saveAsDefault,
    clearDefault,
    getInstance,
  };
}

interface IndicatorStore {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => readonly IndicatorInstance[];
  readonly getServerSnapshot: () => readonly IndicatorInstance[];
  readonly update: (
    updater: (
      current: readonly IndicatorInstance[],
    ) => readonly IndicatorInstance[],
  ) => void;
}

/**
 * localStorage is an external store, so it is read through
 * useSyncExternalStore: the server and the hydration pass both see an empty
 * list, and the persisted list is adopted only once React is on the client.
 */
function createIndicatorStore(
  storageKey: string | null,
  seedDefinitionIds: readonly string[],
  onPersist?: (payload: unknown) => void,
): IndicatorStore {
  const listeners = new Set<() => void>();
  let instances: readonly IndicatorInstance[] | null = null;

  const load = (): readonly IndicatorInstance[] => {
    const stored = storageKey ? readStoredInstances(storageKey) : [];
    if (stored.length > 0) return stored;

    return seedDefinitionIds
      .map((definitionId) =>
        buildInstance(definitionId, createInstanceId(definitionId)),
      )
      .filter((instance): instance is IndicatorInstance => instance !== null);
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      if (instances === null) instances = load();
      return instances;
    },
    getServerSnapshot() {
      return EMPTY_INSTANCES;
    },
    update(updater) {
      if (instances === null) instances = load();
      const next = updater(instances);
      if (next === instances) return;

      instances = next;
      if (storageKey) {
        const payload = writeStoredInstances(storageKey, next);
        onPersist?.(payload);
      }
      for (const listener of listeners) listener();
    },
  };
}

function buildInstance(
  definitionId: string,
  instanceId: string,
): IndicatorInstance | null {
  const definition = getIndicatorDefinition(definitionId);
  if (!definition) return null;
  return normalizeIndicatorInstance(
    definition,
    instanceId,
    readSavedDefault(definitionId) ?? {},
  );
}

let instanceCounter = 0;

function createInstanceId(definitionId: string): string {
  instanceCounter += 1;
  return `${definitionId}-${instanceCounter}`;
}

function readStoredInstances(storageKey: string): IndicatorInstance[] {
  const stored = readJson<readonly StoredInstance[]>(storageKey);
  if (!Array.isArray(stored)) return [];

  const seen = new Set<string>();
  const instances: IndicatorInstance[] = [];
  for (const entry of stored) {
    const definition = getIndicatorDefinition(entry?.definitionId);
    if (!definition) continue;

    const instanceId =
      typeof entry.instanceId === "string" && !seen.has(entry.instanceId)
        ? entry.instanceId
        : createInstanceId(definition.id);
    seen.add(instanceId);
    instances.push(
      normalizeIndicatorInstance(definition, instanceId, entry.snapshot ?? {}),
    );
  }
  return instances;
}

function writeStoredInstances(
  storageKey: string,
  instances: readonly IndicatorInstance[],
): StoredInstance[] {
  const payload: StoredInstance[] = instances.map((instance) => ({
    instanceId: instance.instanceId,
    definitionId: instance.definitionId,
    snapshot: toInstanceSnapshot(instance),
  }));
  writeJson(storageKey, payload);
  return payload;
}

function readSavedDefault(
  definitionId: string,
): IndicatorInstanceSnapshot | null {
  const stored =
    readJson<Record<string, IndicatorInstanceSnapshot>>(DEFAULTS_STORAGE_KEY);
  const snapshot = stored?.[definitionId];
  return snapshot && typeof snapshot === "object" ? snapshot : null;
}

function writeSavedDefault(
  definitionId: string,
  snapshot: IndicatorInstanceSnapshot | null,
): void {
  const stored =
    readJson<Record<string, IndicatorInstanceSnapshot>>(DEFAULTS_STORAGE_KEY) ??
    {};
  if (snapshot) {
    stored[definitionId] = snapshot;
  } else {
    delete stored[definitionId];
  }
  writeJson(DEFAULTS_STORAGE_KEY, stored);
}

/**
 * Chart preferences are cosmetic, so a rejected or corrupt localStorage falls
 * back to defaults rather than breaking the chart.
 */
function readJson<TValue>(key: string): TValue | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as TValue) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}
