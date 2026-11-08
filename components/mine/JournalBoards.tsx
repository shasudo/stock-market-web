"use client";

import { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { ApiError } from "@/lib/types";
import type { DiaryEntry, DiaryResponse, NoteItem, NotesResponse, UserEvent, UserEventsResponse } from "@/lib/types";
import { EmptyState } from "../DataTable";
import { DataStamp } from "../numbers";
import { SessionGate, useSession } from "./session";

function Shell({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline gap-2 px-1">
        <h1 className="text-base font-semibold">{title}</h1>
        <p className="text-xs text-muted">{blurb}</p>
      </div>
      {children}
    </div>
  );
}

function fieldCls() {
  return "mt-1 w-full rounded-md border border-line bg-bg px-3 py-2 text-sm text-fg outline-none placeholder:text-faint focus:border-accent";
}

/** Notes: pinned-first cards with tags. */
export function NotesBoard() {
  const { user, checked } = useSession();
  const [notes, setNotes] = useState<NoteItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  useEffect(() => {
    if (!checked || user == null) return;
    let live = true;
    apiGet<NotesResponse>("/notes")
      .then((n) => {
        if (live) {
          setNotes(n.notes);
          setFailed(false);
        }
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [checked, user, reload]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim() === "") return;
    setBusy(true);
    setNoteError(null);
    try {
      await apiPost<unknown>("/notes", { title: title.trim(), content: content || null });
      setTitle("");
      setContent("");
      setReload((n) => n + 1);
    } catch (err) {
      setNoteError(err instanceof ApiError ? err.message : "Could not save the note.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await apiDelete<unknown>(`/notes/${id}`, {});
    setReload((n) => n + 1);
  }

  const sorted = [...(notes ?? [])].sort((a, b) => Number(b.isPinned) - Number(a.isPinned));

  return (
    <SessionGate checked={checked} user={user} title="Notes">
      <Shell title="Notes" blurb="Symbol-linked thinking, kept with your account.">
        <form onSubmit={create} className="rounded-md border border-line bg-surface p-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title"
            aria-label="Note title"
            maxLength={200}
            className={fieldCls()}
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Thesis, levels, invalidation…"
            aria-label="Note content"
            rows={3}
            className={`${fieldCls()} mt-2`}
          />
          <button
            type="submit"
            disabled={busy || title.trim() === ""}
            className="mt-2 min-h-[40px] rounded-md bg-accent px-4 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save note"}
          </button>
          {noteError != null && (
            <p role="alert" className="mt-2 text-xs font-medium text-down">
              {noteError}
            </p>
          )}
        </form>
        {notes == null && !failed ? (
          <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-6" aria-label="Loading">
            <div className="skeleton h-5 w-full" />
            <div className="skeleton h-5 w-2/3" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-md border border-line bg-surface">
            <EmptyState title={failed ? "Notes are unreachable right now." : "No notes — write the first one above."} />
          </div>
        ) : (
          sorted.map((n) => (
            <article key={n.id} className="rounded-md border border-line bg-surface px-4 py-3">
              <div className="flex items-baseline gap-2">
                <h2 className="text-sm font-semibold">
                  {n.isPinned && <span className="mr-1 text-accent">◆</span>}
                  {n.title}
                </h2>
                <button
                  type="button"
                  onClick={() => remove(n.id)}
                  className="ml-auto min-h-[32px] rounded-md px-2 text-xs font-medium text-muted hover:text-down"
                >
                  Delete
                </button>
              </div>
              {n.content != null && <p className="mt-1 whitespace-pre-wrap text-[13px] text-muted">{n.content}</p>}
              <DataStamp label={n.updatedAt ?? n.createdAt} className="border-0 px-0 pb-0" />
            </article>
          ))
        )}
      </Shell>
    </SessionGate>
  );
}

const MOODS = ["great", "good", "neutral", "bad", "terrible"] as const;

/** Diary: dated entries with mood. */
export function DiaryBoard() {
  const { user, checked } = useSession();
  const [entries, setEntries] = useState<DiaryEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [title, setTitle] = useState("");
  const [mood, setMood] = useState<string>("neutral");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!checked || user == null) return;
    let live = true;
    apiGet<DiaryResponse>("/diary")
      .then((d) => {
        if (live) {
          setEntries(d.entries);
          setFailed(false);
        }
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [checked, user, reload]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim() === "") return;
    setBusy(true);
    setError(null);
    try {
      await apiPost<unknown>("/diary", { title: title.trim(), mood });
      setTitle("");
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the entry.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await apiDelete<unknown>("/diary", { id });
    setReload((n) => n + 1);
  }

  const sorted = [...(entries ?? [])].sort((a, b) => (b.entryDate ?? "").localeCompare(a.entryDate ?? ""));

  return (
    <SessionGate checked={checked} user={user} title="Diary">
      <Shell title="Diary" blurb="One line a day beats a perfect month.">
        <form onSubmit={create} className="flex flex-wrap items-end gap-2 rounded-md border border-line bg-surface p-3">
          <label className="flex min-w-52 flex-1 flex-col gap-1 text-xs font-medium text-muted">
            Entry
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What did the market teach today?"
              maxLength={200}
              className="h-10 rounded-md border border-line bg-bg px-3 text-sm text-fg outline-none placeholder:text-faint focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Mood
            <select
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              className="h-10 rounded-md border border-line bg-bg px-2 text-sm capitalize text-fg outline-none focus:border-accent"
            >
              {MOODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={busy || title.trim() === ""}
            className="min-h-[40px] rounded-md bg-accent px-4 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Saving…" : "Log day"}
          </button>
          {error != null && (
            <p role="alert" className="w-full text-xs font-medium text-down">
              {error}
            </p>
          )}
        </form>
        {entries == null && !failed ? (
          <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-6" aria-label="Loading">
            <div className="skeleton h-5 w-full" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-md border border-line bg-surface">
            <EmptyState title={failed ? "Diary is unreachable right now." : "Blank page — log your first day above."} />
          </div>
        ) : (
          sorted.map((d) => (
            <article key={d.id} className="flex items-baseline gap-3 rounded-md border border-line bg-surface px-4 py-3">
              <span className="tnum shrink-0 text-xs text-faint">{(d.entryDate ?? "").slice(0, 10) || "—"}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{d.title}</span>
                {d.mood != null && <span className="text-[11px] capitalize text-faint">{d.mood}</span>}
              </span>
              <button
                type="button"
                onClick={() => remove(d.id)}
                className="min-h-[32px] shrink-0 rounded-md px-2 text-xs font-medium text-muted hover:text-down"
              >
                Delete
              </button>
            </article>
          ))
        )}
      </Shell>
    </SessionGate>
  );
}

const CATEGORIES = ["personal", "market", "earnings", "meeting", "reminder", "other"] as const;

/** My events: the personal market calendar. */
export function EventsBoard({ title = "Events" }: { title?: string }) {
  const { user, checked } = useSession();
  const [events, setEvents] = useState<UserEvent[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState<string>("personal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!checked || user == null) return;
    let live = true;
    apiGet<UserEventsResponse>("/events")
      .then((e) => {
        if (live) {
          setEvents(e.events);
          setFailed(false);
        }
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [checked, user, reload]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim() === "" || date === "") return;
    setBusy(true);
    setError(null);
    try {
      await apiPost<unknown>("/events", {
        title: name.trim(),
        eventDate: new Date(`${date}T00:00:00Z`).toISOString(),
        category,
      });
      setName("");
      setDate("");
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the event.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await apiDelete<unknown>("/events", { id });
    setReload((n) => n + 1);
  }

  const sorted = [...(events ?? [])].sort((a, b) => (a.eventDate ?? "").localeCompare(b.eventDate ?? ""));

  return (
    <SessionGate checked={checked} user={user} title={title}>
      <Shell title={title} blurb="Earnings you hold, expiries you must respect.">
        <form onSubmit={create} className="flex flex-wrap items-end gap-2 rounded-md border border-line bg-surface p-3">
          <label className="flex min-w-52 flex-1 flex-col gap-1 text-xs font-medium text-muted">
            Event
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Q3 results — RELIANCE"
              maxLength={200}
              className="h-10 rounded-md border border-line bg-bg px-3 text-sm text-fg outline-none placeholder:text-faint focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="tnum h-10 rounded-md border border-line bg-bg px-3 text-sm text-fg outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Kind
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-10 rounded-md border border-line bg-bg px-2 text-sm capitalize text-fg outline-none focus:border-accent"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={busy || name.trim() === "" || date === ""}
            className="min-h-[40px] rounded-md bg-accent px-4 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Saving…" : "Add event"}
          </button>
          {error != null && (
            <p role="alert" className="w-full text-xs font-medium text-down">
              {error}
            </p>
          )}
        </form>
        {events == null && !failed ? (
          <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-6" aria-label="Loading">
            <div className="skeleton h-5 w-full" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-md border border-line bg-surface">
            <EmptyState title={failed ? "Events are unreachable right now." : "Empty calendar — pin your first event."} />
          </div>
        ) : (
          sorted.map((ev) => (
            <article key={ev.id} className="flex items-baseline gap-3 rounded-md border border-line bg-surface px-4 py-3">
              <span className="tnum shrink-0 text-xs text-faint">{(ev.eventDate ?? "").slice(0, 10) || "—"}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{ev.title}</span>
                {ev.category != null && <span className="text-[11px] capitalize text-faint">{ev.category}</span>}
              </span>
              <button
                type="button"
                onClick={() => remove(ev.id)}
                className="min-h-[32px] shrink-0 rounded-md px-2 text-xs font-medium text-muted hover:text-down"
              >
                Delete
              </button>
            </article>
          ))
        )}
      </Shell>
    </SessionGate>
  );
}
