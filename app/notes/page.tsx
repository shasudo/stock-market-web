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
  Pin,
  PinOff,
  Trash2,
  Edit3,
  X,
  Tag,
  StickyNote,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";

interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  isPinned: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface NotesResponseData {
  readonly notes: Note[];
}

interface NoteFormData {
  readonly title: string;
  readonly content: string;
  readonly color: string;
  readonly tags: string[];
}

function isNote(value: unknown): value is Note {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.content === "string" &&
    typeof value.color === "string" &&
    typeof value.isPinned === "boolean" &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === "string") &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isNotesResponse(
  value: unknown,
): value is ApiSuccessResponse<NotesResponseData> {
  return (
    isSuccessfulApiResponse(value) &&
    isRecord(value.data) &&
    Array.isArray(value.data.notes) &&
    value.data.notes.every(isNote)
  );
}

async function requestNotes(): Promise<Note[] | null> {
  const response = await apiClient.get<unknown>("/api/notes");
  return isNotesResponse(response.data) ? response.data.data.notes : null;
}

const colorOptions = [
  {
    name: "slate",
    bg: "bg-muted",
    border: "border-border",
    accent: "bg-muted-foreground",
  },
  {
    name: "zinc",
    bg: "bg-muted",
    border: "border-border",
    accent: "bg-muted-foreground",
  },
  {
    name: "stone",
    bg: "bg-muted",
    border: "border-border",
    accent: "bg-muted-foreground",
  },
  {
    name: "neutral",
    bg: "bg-muted",
    border: "border-border",
    accent: "bg-muted-foreground",
  },
  {
    name: "gray",
    bg: "bg-muted",
    border: "border-border",
    accent: "bg-muted-foreground",
  },
  {
    name: "dark",
    bg: "bg-muted",
    border: "border-border",
    accent: "bg-muted-foreground",
  },
];

const getColorClasses = (colorName: string) => {
  return colorOptions.find((c) => c.name === colorName) || colorOptions[0];
};

export default function NotesPage() {
  return (
    <AuthGuard loadingMessage="Loading notes...">
      <NotesContent />
    </AuthGuard>
  );
}

function NotesContent() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [formData, setFormData] = useState<NoteFormData>({
    title: "",
    content: "",
    color: "slate",
    tags: [],
  });
  const [tagInput, setTagInput] = useState("");

  const fetchNotes = useCallback(async (): Promise<void> => {
    try {
      const loadedNotes = await requestNotes();
      if (loadedNotes === null) {
        toast.error("Received an invalid notes response");
        return;
      }

      setNotes(loadedNotes);
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Failed to fetch notes"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;

    void requestNotes()
      .then((loadedNotes) => {
        if (!isCurrent) {
          return;
        }

        if (loadedNotes === null) {
          toast.error("Received an invalid notes response");
          return;
        }

        setNotes(loadedNotes);
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          toast.error(getAxiosErrorMessage(error, "Failed to fetch notes"));
        }
      })
      .finally(() => {
        if (isCurrent) {
          setLoading(false);
        }
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
      const body = editingNote ? { id: editingNote.id, ...formData } : formData;

      const response = editingNote
        ? await apiClient.put<unknown>("/api/notes", body)
        : await apiClient.post<unknown>("/api/notes", body);

      if (isSuccessfulApiResponse(response.data)) {
        toast.success(editingNote ? "Note updated!" : "Note created!");
        void fetchNotes();
        closeModal();
      } else {
        toast.error(
          getApiResponseMessage(response.data, "Unable to save note"),
        );
      }
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Unable to save note"));
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!confirm("Are you sure you want to delete this note?")) return;

    try {
      const response = await apiClient.delete<unknown>("/api/notes", {
        data: { id: noteId },
      });

      if (isSuccessfulApiResponse(response.data)) {
        toast.success("Note deleted");
        setNotes(notes.filter((n) => n.id !== noteId));
      } else {
        toast.error(
          getApiResponseMessage(response.data, "Unable to delete note"),
        );
      }
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Failed to delete note"));
    }
  };

  const handleTogglePin = async (note: Note) => {
    try {
      const response = await apiClient.put<unknown>("/api/notes", {
        id: note.id,
        isPinned: !note.isPinned,
      });

      if (isSuccessfulApiResponse(response.data)) {
        toast.success(note.isPinned ? "Unpinned" : "Pinned!");
        void fetchNotes();
      } else {
        toast.error(
          getApiResponseMessage(response.data, "Unable to update the note"),
        );
      }
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Failed to update note"));
    }
  };

  const openEditModal = (note: Note) => {
    setEditingNote(note);
    setFormData({
      title: note.title,
      content: note.content,
      color: note.color,
      tags: note.tags,
    });
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setEditingNote(null);
    setFormData({ title: "", content: "", color: "slate", tags: [] });
    setIsModalOpen(false);
    setTimeout(() => setIsModalOpen(true), 0);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingNote(null);
    setFormData({ title: "", content: "", color: "slate", tags: [] });
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

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const query = searchQuery.toLowerCase();
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query) ||
        note.tags.some((tag) => tag.includes(query)),
    );
  }, [notes, searchQuery]);

  const pinnedNotes = filteredNotes.filter((n) => n.isPinned);
  const unpinnedNotes = filteredNotes.filter((n) => !n.isPinned);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-background py-6">
      {}
      <div className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-16 z-40">
        <div className="w-full px-4 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary shadow-lg shadow-muted-foreground/20">
                <StickyNote className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">My Notes</h1>
                <p className="text-sm text-muted-foreground">
                  {notes.length} {notes.length === 1 ? "note" : "notes"} •
                  Capture your trading ideas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-all text-sm"
                />
              </div>

              {}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={openNewModal}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium shadow-lg shadow-muted-foreground/20 hover:shadow-xl hover:shadow-muted-foreground/30 transition-all"
              >
                <Plus className="h-5 w-5" />
                <span>New Note</span>
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {}
      <div className="w-full px-4 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-muted-foreground border-t-transparent" />
          </div>
        ) : notes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="p-6 rounded-full bg-muted mb-6">
              <Sparkles className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              No notes yet
            </h2>
            <p className="text-muted-foreground mb-6">
              Start capturing your trading ideas and market insights
            </p>
            <button
              onClick={openNewModal}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium shadow-lg shadow-muted-foreground/20 hover:shadow-xl transition-all"
            >
              <Plus className="h-5 w-5" />
              Create your first note
            </button>
          </motion.div>
        ) : (
          <>
            {}
            {pinnedNotes.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Pin className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Pinned
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {pinnedNotes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      onEdit={openEditModal}
                      onDelete={handleDelete}
                      onTogglePin={handleTogglePin}
                      formatDate={formatDate}
                    />
                  ))}
                </div>
              </div>
            )}

            {}
            {unpinnedNotes.length > 0 && (
              <div>
                {pinnedNotes.length > 0 && (
                  <div className="flex items-center gap-2 mb-4">
                    <StickyNote className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Notes
                    </h2>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {unpinnedNotes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      onEdit={openEditModal}
                      onDelete={handleDelete}
                      onTogglePin={handleTogglePin}
                      formatDate={formatDate}
                    />
                  ))}
                </div>
              </div>
            )}

            {filteredNotes.length === 0 && searchQuery && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No notes match your search
                </p>
              </div>
            )}
          </>
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
              className="bg-card rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              {}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground">
                  {editingNote ? "Edit Note" : "New Note"}
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
                    placeholder="Note title..."
                    className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-all"
                    autoFocus
                  />
                </div>

                {}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Content
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) =>
                      setFormData({ ...formData, content: e.target.value })
                    }
                    placeholder="Write your note..."
                    rows={5}
                    className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-all resize-none"
                  />
                </div>

                {}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Color
                  </label>
                  <div className="flex gap-2">
                    {colorOptions.map((color) => (
                      <button
                        key={color.name}
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, color: color.name })
                        }
                        className={`w-8 h-8 rounded-full ${color.accent} transition-all ${
                          formData.color === color.name
                            ? "ring-2 ring-offset-2 ring-ring scale-110"
                            : "hover:scale-105"
                        }`}
                      />
                    ))}
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
                      className="flex-1 px-4 py-2 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-all text-sm"
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
                    className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium shadow-lg shadow-muted-foreground/20 hover:shadow-xl transition-all"
                  >
                    {editingNote ? "Save Changes" : "Create Note"}
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

function NoteCard({
  note,
  onEdit,
  onDelete,
  onTogglePin,
  formatDate,
}: {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
  onTogglePin: (note: Note) => void;
  formatDate: (date: string) => string;
}) {
  const colorClasses = getColorClasses(note.color);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -4 }}
      className={`group relative rounded-2xl border ${colorClasses.border} ${colorClasses.bg} p-5 cursor-pointer transition-all hover:shadow-lg`}
      onClick={() => onEdit(note)}
    >
      {}
      {note.isPinned && (
        <div className="absolute -top-2 -right-2 p-1.5 rounded-full bg-muted-foreground shadow-lg">
          <Pin className="h-3 w-3 text-white" />
        </div>
      )}

      {}
      <h3 className="font-semibold text-foreground mb-2 line-clamp-1 pr-8">
        {note.title}
      </h3>

      {}
      {note.content && (
        <p className="text-sm text-muted-foreground line-clamp-4 mb-3">
          {note.content}
        </p>
      )}

      {}
      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {note.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full bg-muted/70 text-xs text-muted-foreground"
            >
              #{tag}
            </span>
          ))}
          {note.tags.length > 3 && (
            <span className="px-2 py-0.5 text-xs text-muted-foreground">
              +{note.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-xs text-muted-foreground">
          {formatDate(note.updatedAt)}
        </span>

        {}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(note);
            }}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            title={note.isPinned ? "Unpin" : "Pin"}
          >
            {note.isPinned ? (
              <PinOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Pin className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(note);
            }}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            title="Edit"
          >
            <Edit3 className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(note.id);
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
