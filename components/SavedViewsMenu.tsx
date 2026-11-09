"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bookmark, Check, Loader2, Trash2 } from "lucide-react";
import {
  deleteSavedView,
  fetchSavedViews,
  isSignedOutError,
  saveSavedView,
  SavedViewsError,
  type SavedView,
} from "@/lib/saved-views-client";
import type {
  SavedViewPayload,
  SavedViewScope,
} from "@/lib/validations/saved-views";

/** Signed-out visitors get the same feature backed by their own browser. */
function guestKey(scope: SavedViewScope): string {
  return `stockmarket:guest-views:${scope}`;
}

function readGuestViews(scope: SavedViewScope): SavedView[] {
  try {
    const raw = window.localStorage.getItem(guestKey(scope));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is SavedView =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as SavedView).id === "string" &&
        typeof (entry as SavedView).name === "string" &&
        typeof (entry as SavedView).payload === "object" &&
        (entry as SavedView).payload !== null,
    );
  } catch {
    return [];
  }
}

function writeGuestViews(
  scope: SavedViewScope,
  views: readonly SavedView[],
): void {
  try {
    window.localStorage.setItem(guestKey(scope), JSON.stringify(views));
  } catch {
    // Quota or privacy mode; the list simply won't persist.
  }
}

interface Props {
  scope: SavedViewScope;
  /** The screen's current filters/columns, captured fresh on every render. */
  currentPayload: SavedViewPayload;
  onApply: (payload: SavedViewPayload) => void;
}

/**
 * Key-sorted JSON so "has this view been edited since I applied it?" does not
 * depend on the order the page or the database happened to build the object.
 */
function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${canonical(entryValue)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export default function SavedViewsMenu({
  scope,
  currentPayload,
  onApply,
}: Props) {
  const [open, setOpen] = useState(false);
  const [views, setViews] = useState<readonly SavedView[]>([]);
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const [appliedSignature, setAppliedSignature] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guest, setGuest] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const appliedView = views.find((view) => view.id === appliedId) ?? null;
  const currentSignature = canonical(currentPayload);
  const isModified =
    appliedSignature !== null && appliedSignature !== currentSignature;
  const trimmedName = nameInput.trim();
  const willOverwrite = views.some((view) => view.name === trimmedName);

  const reload = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      try {
        const loaded = await fetchSavedViews(scope, signal);
        if (signal?.aborted) return;
        setGuest(false);
        setViews(loaded);
        setError(null);
      } catch (loadError) {
        if (signal?.aborted) return;
        if (isSignedOutError(loadError)) {
          setGuest(true);
          setViews(readGuestViews(scope));
          setError(null);
          return;
        }
        setError(
          loadError instanceof SavedViewsError
            ? loadError.message
            : "Saved views could not be loaded.",
        );
      }
    },
    [scope],
  );

  useEffect(() => {
    const controller = new AbortController();
    async function loadOnMount(): Promise<void> {
      await reload(controller.signal);
    }
    void loadOnMount();
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent): void => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const openMenu = (): void => {
    setNameInput(appliedView?.name ?? "");
    setError(null);
    setOpen(true);
  };

  const handleSave = async (): Promise<void> => {
    if (!trimmedName || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (guest) {
        const existing = readGuestViews(scope);
        const entry: SavedView = {
          id: `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: trimmedName,
          payload: currentPayload,
        };
        const next = [
          ...existing.filter((view) => view.name !== trimmedName),
          entry,
        ];
        writeGuestViews(scope, next);
        setViews(next);
        setAppliedId(entry.id);
      } else {
        await saveSavedView({
          name: trimmedName,
          scope,
          payload: currentPayload,
        });
        await reload();
      }
      // Re-anchor the "modified" dot to what was just written, so the view
      // reads as clean the moment it is saved.
      setAppliedSignature(currentSignature);
      setOpen(false);
    } catch (saveError) {
      setError(
        saveError instanceof SavedViewsError
          ? saveError.message
          : "The view could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleApply = (view: SavedView): void => {
    onApply(view.payload);
    setAppliedId(view.id);
    setAppliedSignature(canonical(view.payload));
    setNameInput(view.name);
    setOpen(false);
  };

  const handleDelete = async (view: SavedView): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (guest) {
        const next = readGuestViews(scope).filter(
          (entry) => entry.id !== view.id,
        );
        writeGuestViews(scope, next);
        setViews(next);
      } else {
        await deleteSavedView(view.id);
      }
      if (view.id === appliedId) {
        setAppliedId(null);
        setAppliedSignature(null);
      }
      if (!guest) await reload();
    } catch (deleteError) {
      setError(
        deleteError instanceof SavedViewsError
          ? deleteError.message
          : "The view could not be deleted.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        title={
          appliedView
            ? `Applied: ${appliedView.name}${isModified ? " (edited)" : ""}`
            : "Save and reuse filter and column setups"
        }
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-black bg-card hover:bg-muted max-w-[220px]"
      >
        <Bookmark className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{appliedView?.name ?? "Views"}</span>
        {isModified && (
          <span
            title="Edited since it was applied"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning"
          />
        )}
        {views.length > 0 && !appliedView && (
          <span className="rounded-full bg-black px-1.5 py-0.5 text-[10px] leading-none text-white dark:bg-zinc-100 dark:text-zinc-950">
            {views.length}
          </span>
        )}
        <span className="text-[10px] opacity-60">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-80 border border-black bg-card shadow-lg dark:border-zinc-800">
          <div className="border-b border-border p-2">
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              Save current filters &amp; columns as
            </label>
            <div className="flex gap-1.5">
              <input
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleSave();
                }}
                placeholder="e.g. Smallcap breakouts"
                maxLength={60}
                autoFocus
                className="min-w-0 flex-1 border border-border px-2 py-1 text-xs focus:border-ring focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!trimmedName || busy}
                className="flex shrink-0 items-center gap-1 border border-black bg-black px-2.5 py-1 text-xs font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
              >
                {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                {willOverwrite ? "Update" : "Save"}
              </button>
            </div>
            {willOverwrite && (
              <p className="mt-1 text-[11px] text-warning">
                Overwrites the existing &ldquo;{trimmedName}&rdquo;.
              </p>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto">
            {views.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                No saved views yet. Set your filters and columns, then save them
                under a name.
              </p>
            ) : (
              views.map((view) => (
                <div
                  key={view.id}
                  className={`group flex items-center gap-1 border-b border-border last:border-b-0 ${
                    view.id === appliedId ? "bg-muted" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleApply(view)}
                    className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
                  >
                    <Check
                      className={`h-3.5 w-3.5 shrink-0 ${
                        view.id === appliedId
                          ? "text-foreground"
                          : "text-transparent"
                      }`}
                    />
                    <span className="truncate">{view.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(view)}
                    disabled={busy}
                    title={`Delete "${view.name}"`}
                    aria-label={`Delete ${view.name}`}
                    className="mr-2 shrink-0 p-1 text-muted-foreground hover:text-error group-hover:text-muted-foreground disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {guest && (
            <p className="border-t border-border bg-muted px-3 py-2 text-[11px] text-muted-foreground">
              Not signed in — views are saved free in this browser. Sign in to
              sync them across devices.
            </p>
          )}

          {error && (
            <p className="border-t border-error/30 bg-error/10 px-3 py-2 text-[11px] text-error">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
