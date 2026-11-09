"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { AuthGuard } from "@/components/common";
import apiClient, {
  getAxiosErrorMessage,
  getApiResponseMessage,
  isRecord,
  isSuccessfulApiResponse,
  type ApiSuccessResponse,
} from "@/lib/api-client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Trash2,
  Edit3,
  X,
  Tag,
  BookOpen,
  Sparkles,
  ThumbsUp,
  Meh,
  ThumbsDown,
  CloudLightning,
  Calendar as CalendarIcon,
} from "lucide-react";
import toast from "react-hot-toast";

type DiaryMood = "great" | "good" | "neutral" | "bad" | "terrible";

interface DiaryEntry {
  id: string;
  title: string;
  content: string;
  mood: DiaryMood;
  entryDate: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface DiaryResponseData {
  readonly entries: DiaryEntry[];
}

interface DiaryFormData {
  readonly title: string;
  readonly content: string;
  readonly mood: DiaryMood;
  readonly entryDate: string;
  readonly tags: string[];
}

function isDiaryMood(value: unknown): value is DiaryMood {
  return (
    value === "great" ||
    value === "good" ||
    value === "neutral" ||
    value === "bad" ||
    value === "terrible"
  );
}

function isDiaryEntry(value: unknown): value is DiaryEntry {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.content === "string" &&
    isDiaryMood(value.mood) &&
    typeof value.entryDate === "string" &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === "string") &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isDiaryResponse(
  value: unknown,
): value is ApiSuccessResponse<DiaryResponseData> {
  return (
    isSuccessfulApiResponse(value) &&
    isRecord(value.data) &&
    Array.isArray(value.data.entries) &&
    value.data.entries.every(isDiaryEntry)
  );
}

async function requestDiaryEntries(): Promise<DiaryEntry[] | null> {
  const response = await apiClient.get<unknown>("/api/diary");
  return isDiaryResponse(response.data) ? response.data.data.entries : null;
}

const moodOptions: {
  name: DiaryMood;
  label: string;
  icon: typeof Sparkles;
  text: string;
  bg: string;
  border: string;
  accent: string;
}[] = [
  {
    name: "great",
    label: "Great",
    icon: Sparkles,
    text: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/30",
    accent: "bg-warning",
  },
  {
    name: "good",
    label: "Good",
    icon: ThumbsUp,
    text: "text-success",
    bg: "bg-success/10",
    border: "border-success/30",
    accent: "bg-success",
  },
  {
    name: "neutral",
    label: "Neutral",
    icon: Meh,
    text: "text-muted-foreground",
    bg: "bg-muted",
    border: "border-border",
    accent: "bg-muted-foreground",
  },
  {
    name: "bad",
    label: "Bad",
    icon: ThumbsDown,
    text: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/30",
    accent: "bg-warning",
  },
  {
    name: "terrible",
    label: "Terrible",
    icon: CloudLightning,
    text: "text-error",
    bg: "bg-error/10",
    border: "border-error/30",
    accent: "bg-error",
  },
];

const getMoodOption = (mood: string) =>
  moodOptions.find((m) => m.name === mood) || moodOptions[2];

function todayInputDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyFormData(): DiaryFormData {
  return {
    title: "",
    content: "",
    mood: "neutral",
    entryDate: todayInputDate(),
    tags: [],
  };
}

export default function DiaryPage() {
  return (
    <AuthGuard loadingMessage="Loading diary...">
      <DiaryContent />
    </AuthGuard>
  );
}

function DiaryContent() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [moodFilter, setMoodFilter] = useState<DiaryMood | "all">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [formData, setFormData] = useState<DiaryFormData>(emptyFormData());
  const [tagInput, setTagInput] = useState("");

  const fetchEntries = useCallback(async (): Promise<void> => {
    try {
      const loaded = await requestDiaryEntries();
      if (loaded === null) {
        toast.error("Received an invalid diary response");
        return;
      }
      setEntries(loaded);
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Failed to fetch diary entries"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;

    void requestDiaryEntries()
      .then((loaded) => {
        if (!isCurrent) return;
        if (loaded === null) {
          toast.error("Received an invalid diary response");
          return;
        }
        setEntries(loaded);
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          toast.error(getAxiosErrorMessage(error, "Failed to fetch diary entries"));
        }
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    try {
      const body = editingEntry
        ? { id: editingEntry.id, ...formData }
        : formData;

      const response = editingEntry
        ? await apiClient.put<unknown>("/api/diary", body)
        : await apiClient.post<unknown>("/api/diary", body);

      if (isSuccessfulApiResponse(response.data)) {
        toast.success(editingEntry ? "Entry updated!" : "Entry created!");
        void fetchEntries();
        closeModal();
      } else {
        toast.error(
          getApiResponseMessage(response.data, "Unable to save entry"),
        );
      }
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Unable to save entry"));
    }
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm("Are you sure you want to delete this diary entry?")) return;

    try {
      const response = await apiClient.delete<unknown>("/api/diary", {
        data: { id: entryId },
      });

      if (isSuccessfulApiResponse(response.data)) {
        toast.success("Entry deleted");
        setEntries(entries.filter((entry) => entry.id !== entryId));
      } else {
        toast.error(
          getApiResponseMessage(response.data, "Unable to delete entry"),
        );
      }
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Failed to delete entry"));
    }
  };

  const openEditModal = (entry: DiaryEntry) => {
    setEditingEntry(entry);
    setFormData({
      title: entry.title,
      content: entry.content,
      mood: entry.mood,
      entryDate: entry.entryDate.slice(0, 10),
      tags: entry.tags,
    });
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setEditingEntry(null);
    setFormData(emptyFormData());
    setIsModalOpen(false);
    setTimeout(() => setIsModalOpen(true), 0);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEntry(null);
    setFormData(emptyFormData());
    setTagInput("");
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !formData.tags.includes(tag)) {
      setFormData({ ...formData, tags: [...formData.tags, tag] });
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((t) => t !== tagToRemove),
    });
  };

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (moodFilter !== "all") {
      result = result.filter((entry) => entry.mood === moodFilter);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (entry) =>
          entry.title.toLowerCase().includes(query) ||
          entry.content.toLowerCase().includes(query) ||
          entry.tags.some((tag) => tag.includes(query)),
      );
    }
    return result;
  }, [entries, searchQuery, moodFilter]);

  const groupedByMonth = useMemo(() => {
    const groups = new Map<string, DiaryEntry[]>();
    for (const entry of filteredEntries) {
      const key = new Date(entry.entryDate).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      const bucket = groups.get(key);
      if (bucket) {
        bucket.push(entry);
      } else {
        groups.set(key, [entry]);
      }
    }
    return Array.from(groups.entries());
  }, [filteredEntries]);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  return (
    <div className="min-h-screen bg-background py-6">
      {}
      <div className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-16 z-40">
        <div className="w-full px-4 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-card border border-border/90 shadow-xs text-primary">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Diary</h1>
                <p className="text-sm text-muted-foreground">
                  {entries.length} {entries.length === 1 ? "entry" : "entries"}{" "}
                  • Journal your trading days
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search entries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-56 pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-all text-sm"
                />
              </div>

              {}
              <select
                value={moodFilter}
                onChange={(e) =>
                  setMoodFilter(e.target.value as DiaryMood | "all")
                }
                className="px-3 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-all"
              >
                <option value="all">All moods</option>
                {moodOptions.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.label}
                  </option>
                ))}
              </select>

              {}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={openNewModal}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-xs hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-5 w-5" />
                <span>New Entry</span>
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {}
      <div className="w-full px-4 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
          </div>
        ) : entries.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="p-6 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <BookOpen className="h-12 w-12 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              No diary entries yet
            </h2>
            <p className="text-muted-foreground mb-6">
              Reflect on your trading days, what worked and what didn&apos;t
            </p>
            <button
              onClick={openNewModal}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-xs hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-5 w-5" />
              Write your first entry
            </button>
          </motion.div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No entries match your search</p>
          </div>
        ) : (
          groupedByMonth.map(([monthLabel, monthEntries]) => (
            <div key={monthLabel} className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {monthLabel}
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {monthEntries.map((entry) => (
                  <DiaryCard
                    key={entry.id}
                    entry={entry}
                    onEdit={openEditModal}
                    onDelete={handleDelete}
                    formatDate={formatDate}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              {}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground">
                  {editingEntry ? "Edit Entry" : "New Diary Entry"}
                </h3>
                <button
                  onClick={closeModal}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              {}
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Title
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      placeholder="Entry title..."
                      className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-all"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Date
                    </label>
                    <input
                      type="date"
                      value={formData.entryDate}
                      onChange={(e) =>
                        setFormData({ ...formData, entryDate: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-all"
                    />
                  </div>
                </div>

                {}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    What happened today?
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) =>
                      setFormData({ ...formData, content: e.target.value })
                    }
                    placeholder="Trades taken, lessons learned, emotions felt..."
                    rows={6}
                    className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-all resize-none"
                  />
                </div>

                {}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Mood
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {moodOptions.map((m) => {
                      const Icon = m.icon;
                      const isSelected = formData.mood === m.name;
                      return (
                        <button
                          key={m.name}
                          type="button"
                          onClick={() =>
                            setFormData({ ...formData, mood: m.name })
                          }
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                            isSelected
                              ? `${m.bg} ${m.border} ${m.text} ring-2 ring-offset-1 ring-current`
                              : "border-border text-muted-foreground hover:bg-secondary"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Tags
                  </label>
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {formData.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-secondary text-sm"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && (e.preventDefault(), addTag())
                      }
                      placeholder="Add a tag..."
                      className="flex-1 px-4 py-2 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-all text-sm"
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"
                    >
                      <Tag className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-3 rounded-xl border border-border hover:bg-secondary transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-xs hover:bg-primary/90 transition-colors"
                  >
                    {editingEntry ? "Save Changes" : "Create Entry"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DiaryCard({
  entry,
  onEdit,
  onDelete,
  formatDate,
}: {
  entry: DiaryEntry;
  onEdit: (entry: DiaryEntry) => void;
  onDelete: (id: string) => void;
  formatDate: (date: string) => string;
}) {
  const mood = getMoodOption(entry.mood);
  const MoodIcon = mood.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -4 }}
      className={`group relative rounded-2xl border ${mood.border} ${mood.bg} p-5 cursor-pointer transition-all hover:shadow-lg`}
      onClick={() => onEdit(entry)}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-foreground line-clamp-1 pr-2">
          {entry.title}
        </h3>
        <span
          className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${mood.text} bg-muted/70`}
        >
          <MoodIcon className="h-3 w-3" />
          {mood.label}
        </span>
      </div>

      {entry.content && (
        <p className="text-sm text-muted-foreground line-clamp-4 mb-3">
          {entry.content}
        </p>
      )}

      {entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {entry.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full bg-muted/70 text-xs text-muted-foreground"
            >
              #{tag}
            </span>
          ))}
          {entry.tags.length > 3 && (
            <span className="px-2 py-0.5 text-xs text-muted-foreground">
              +{entry.tags.length - 3}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-xs text-muted-foreground">
          {formatDate(entry.entryDate)}
        </span>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(entry);
            }}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            title="Edit"
          >
            <Edit3 className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(entry.id);
            }}
            className="p-1.5 rounded-lg hover:bg-error/20 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
