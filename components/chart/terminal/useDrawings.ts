"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sanitizeDrawings, type Drawing } from "@/lib/chart/drawings";
import {
  drawingsServerKey,
  markSynced,
  pullDrawings,
  queuePush,
  removeFromServer,
} from "./chart-sync";

const STORAGE_PREFIX = "chart:terminal:drawings:v1:";
const HISTORY_LIMIT = 100;

type Snapshot = readonly Drawing[];

interface State {
  readonly symbol: string;
  readonly drawings: Snapshot;
  readonly past: readonly Snapshot[];
  readonly future: readonly Snapshot[];
}

function read(symbol: string): Drawing[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + symbol);
    return raw ? sanitizeDrawings(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function write(symbol: string, drawings: Snapshot): void {
  try {
    if (drawings.length === 0) {
      window.localStorage.removeItem(STORAGE_PREFIX + symbol);
    } else {
      window.localStorage.setItem(
        STORAGE_PREFIX + symbol,
        JSON.stringify(drawings),
      );
    }
  } catch {
    // Drawings are a convenience; a full or blocked storage must not break the chart.
  }
}

function fresh(symbol: string): State {
  return {
    symbol,
    drawings: typeof window === "undefined" ? [] : read(symbol),
    past: [],
    future: [],
  };
}

function pushPast(state: State): readonly Snapshot[] {
  return [...state.past, state.drawings].slice(-HISTORY_LIMIT);
}

export interface UseDrawingsResult {
  readonly drawings: readonly Drawing[];
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly add: (drawing: Drawing) => void;
  /** Replace a drawing; pass `record: false` for each step of a drag. */
  readonly replace: (drawing: Drawing, record?: boolean) => void;
  /** Snapshot for undo before a multi-step edit such as a drag. */
  readonly beginChange: () => void;
  readonly remove: (id: string) => void;
  readonly clear: () => void;
  readonly undo: () => void;
  readonly redo: () => void;
}

/** Drawings for one symbol, with undo/redo, saved to localStorage as they change. */
export function useDrawings(symbol: string): UseDrawingsResult {
  const [state, setState] = useState<State>(() => fresh(symbol));

  // Switching symbol loads that symbol's drawings and starts a fresh history.
  if (state.symbol !== symbol) {
    setState(fresh(symbol));
  }

  // Drawings made on another device arrive once per symbol, if newer.
  useEffect(() => {
    let cancelled = false;
    void pullDrawings(symbol).then((result) => {
      if (cancelled || result === null || result === "none") return;
      const incoming = sanitizeDrawings(result.drawings);
      markSynced(drawingsServerKey(symbol), result.updatedAt, incoming);
      write(symbol, incoming);
      setState((current) =>
        current.symbol === symbol
          ? { symbol, drawings: incoming, past: [], future: [] }
          : current,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  // The first save for a symbol only runs after the user actually changes it,
  // so merely opening a chart never overwrites the account copy.
  const editedRef = useRef(false);
  useEffect(() => {
    write(state.symbol, state.drawings);
    if (!editedRef.current) return;
    editedRef.current = false;
    if (state.drawings.length === 0) {
      void removeFromServer(drawingsServerKey(state.symbol));
    } else {
      queuePush(drawingsServerKey(state.symbol), state.drawings);
    }
  }, [state.symbol, state.drawings]);

  const add = useCallback((drawing: Drawing) => {
    editedRef.current = true;
    setState((current) => ({
      ...current,
      drawings: [...current.drawings, drawing],
      past: pushPast(current),
      future: [],
    }));
  }, []);

  const replace = useCallback((drawing: Drawing, record = true) => {
    editedRef.current = true;
    setState((current) => ({
      ...current,
      drawings: current.drawings.map((existing) =>
        existing.id === drawing.id ? drawing : existing,
      ),
      past: record ? pushPast(current) : current.past,
      future: record ? [] : current.future,
    }));
  }, []);

  const beginChange = useCallback(() => {
    editedRef.current = true;
    setState((current) => ({
      ...current,
      past: pushPast(current),
      future: [],
    }));
  }, []);

  const remove = useCallback((id: string) => {
    editedRef.current = true;
    setState((current) => ({
      ...current,
      drawings: current.drawings.filter((entry) => entry.id !== id),
      past: pushPast(current),
      future: [],
    }));
  }, []);

  const clear = useCallback(() => {
    editedRef.current = true;
    setState((current) =>
      current.drawings.length === 0
        ? current
        : { ...current, drawings: [], past: pushPast(current), future: [] },
    );
  }, []);

  const undo = useCallback(() => {
    editedRef.current = true;
    setState((current) => {
      const previous = current.past[current.past.length - 1];
      if (!previous) return current;
      return {
        ...current,
        drawings: previous,
        past: current.past.slice(0, -1),
        future: [...current.future, current.drawings],
      };
    });
  }, []);

  const redo = useCallback(() => {
    editedRef.current = true;
    setState((current) => {
      const next = current.future[current.future.length - 1];
      if (!next) return current;
      return {
        ...current,
        drawings: next,
        past: [...current.past, current.drawings],
        future: current.future.slice(0, -1),
      };
    });
  }, []);

  return {
    drawings: state.symbol === symbol ? state.drawings : [],
    canUndo: state.symbol === symbol && state.past.length > 0,
    canRedo: state.symbol === symbol && state.future.length > 0,
    add,
    replace,
    beginChange,
    remove,
    clear,
    undo,
    redo,
  };
}
