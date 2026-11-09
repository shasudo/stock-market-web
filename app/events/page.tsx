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
  MapPin,
  CalendarClock,
  CalendarDays,
  User,
  TrendingUp,
  BarChart3,
  Users,
  Bell,
  Tag,
  Clock,
} from "lucide-react";
import toast from "react-hot-toast";

type EventCategory =
  | "personal"
  | "market"
  | "earnings"
  | "meeting"
  | "reminder"
  | "other";

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  eventDate: string;
  isAllDay: boolean;
  category: EventCategory;
  location: string;
  createdAt: string;
  updatedAt: string;
}

interface EventsResponseData {
  readonly events: CalendarEvent[];
}

interface EventFormData {
  readonly title: string;
  readonly description: string;
  readonly eventDate: string;
  readonly eventTime: string;
  readonly isAllDay: boolean;
  readonly category: EventCategory;
  readonly location: string;
}

const EVENT_CATEGORIES: EventCategory[] = [
  "personal",
  "market",
  "earnings",
  "meeting",
  "reminder",
  "other",
];

function isEventCategory(value: unknown): value is EventCategory {
  return (
    typeof value === "string" &&
    (EVENT_CATEGORIES as string[]).includes(value)
  );
}

function isCalendarEvent(value: unknown): value is CalendarEvent {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    typeof value.eventDate === "string" &&
    typeof value.isAllDay === "boolean" &&
    isEventCategory(value.category) &&
    typeof value.location === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isEventsResponse(
  value: unknown,
): value is ApiSuccessResponse<EventsResponseData> {
  return (
    isSuccessfulApiResponse(value) &&
    isRecord(value.data) &&
    Array.isArray(value.data.events) &&
    value.data.events.every(isCalendarEvent)
  );
}

async function requestEvents(): Promise<CalendarEvent[] | null> {
  const response = await apiClient.get<unknown>("/api/events");
  return isEventsResponse(response.data) ? response.data.data.events : null;
}

const categoryOptions: {
  name: EventCategory;
  label: string;
  icon: typeof User;
  text: string;
  bg: string;
  border: string;
}[] = [
  {
    name: "personal",
    label: "Personal",
    icon: User,
    text: "text-purple",
    bg: "bg-purple/10",
    border: "border-purple/30",
  },
  {
    name: "market",
    label: "Market",
    icon: TrendingUp,
    text: "text-info",
    bg: "bg-info/10",
    border: "border-info/30",
  },
  {
    name: "earnings",
    label: "Earnings",
    icon: BarChart3,
    text: "text-success",
    bg: "bg-success/10",
    border: "border-success/30",
  },
  {
    name: "meeting",
    label: "Meeting",
    icon: Users,
    text: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/30",
  },
  {
    name: "reminder",
    label: "Reminder",
    icon: Bell,
    text: "text-error",
    bg: "bg-error/10",
    border: "border-error/30",
  },
  {
    name: "other",
    label: "Other",
    icon: Tag,
    text: "text-muted-foreground",
    bg: "bg-muted",
    border: "border-border",
  },
];

const getCategoryOption = (category: string) =>
  categoryOptions.find((c) => c.name === category) || categoryOptions[5];

function todayInputDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyFormData(): EventFormData {
  return {
    title: "",
    description: "",
    eventDate: todayInputDate(),
    eventTime: "09:00",
    isAllDay: true,
    category: "personal",
    location: "",
  };
}

function toEventDateTime(date: string, time: string, isAllDay: boolean): string {
  return isAllDay ? `${date}T00:00:00` : `${date}T${time}:00`;
}

export default function EventsPage() {
  return (
    <AuthGuard loadingMessage="Loading events...">
      <EventsContent />
    </AuthGuard>
  );
}

function EventsContent() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<EventCategory | "all">(
    "all",
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [formData, setFormData] = useState<EventFormData>(emptyFormData());

  const fetchEvents = useCallback(async (): Promise<void> => {
    try {
      const loaded = await requestEvents();
      if (loaded === null) {
        toast.error("Received an invalid events response");
        return;
      }
      setEvents(loaded);
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Failed to fetch events"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;

    void requestEvents()
      .then((loaded) => {
        if (!isCurrent) return;
        if (loaded === null) {
          toast.error("Received an invalid events response");
          return;
        }
        setEvents(loaded);
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          toast.error(getAxiosErrorMessage(error, "Failed to fetch events"));
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

    const body = {
      title: formData.title,
      description: formData.description,
      eventDate: toEventDateTime(
        formData.eventDate,
        formData.eventTime,
        formData.isAllDay,
      ),
      isAllDay: formData.isAllDay,
      category: formData.category,
      location: formData.location,
    };

    try {
      const response = editingEvent
        ? await apiClient.put<unknown>("/api/events", {
            id: editingEvent.id,
            ...body,
          })
        : await apiClient.post<unknown>("/api/events", body);

      if (isSuccessfulApiResponse(response.data)) {
        toast.success(editingEvent ? "Event updated!" : "Event created!");
        void fetchEvents();
        closeModal();
      } else {
        toast.error(
          getApiResponseMessage(response.data, "Unable to save event"),
        );
      }
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Unable to save event"));
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm("Are you sure you want to delete this event?")) return;

    try {
      const response = await apiClient.delete<unknown>("/api/events", {
        data: { id: eventId },
      });

      if (isSuccessfulApiResponse(response.data)) {
        toast.success("Event deleted");
        setEvents(events.filter((event) => event.id !== eventId));
      } else {
        toast.error(
          getApiResponseMessage(response.data, "Unable to delete event"),
        );
      }
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Failed to delete event"));
    }
  };

  const openEditModal = (event: CalendarEvent) => {
    const eventDateObj = new Date(event.eventDate);
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description,
      eventDate: event.eventDate.slice(0, 10),
      eventTime: eventDateObj.toTimeString().slice(0, 5),
      isAllDay: event.isAllDay,
      category: event.category,
      location: event.location,
    });
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setEditingEvent(null);
    setFormData(emptyFormData());
    setIsModalOpen(false);
    setTimeout(() => setIsModalOpen(true), 0);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEvent(null);
    setFormData(emptyFormData());
  };

  const filteredEvents = useMemo(() => {
    let result = events;
    if (categoryFilter !== "all") {
      result = result.filter((event) => event.category === categoryFilter);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (event) =>
          event.title.toLowerCase().includes(query) ||
          event.description.toLowerCase().includes(query) ||
          event.location.toLowerCase().includes(query),
      );
    }
    return result;
  }, [events, searchQuery, categoryFilter]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const upcomingList = filteredEvents
      .filter((event) => new Date(event.eventDate).getTime() >= now)
      .sort(
        (a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime(),
      );
    const pastList = filteredEvents
      .filter((event) => new Date(event.eventDate).getTime() < now)
      .sort(
        (a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime(),
      );
    return { upcoming: upcomingList, past: pastList };
  }, [filteredEvents]);

  const formatDateTime = (dateString: string, isAllDay: boolean) => {
    const date = new Date(dateString);
    const dateLabel = date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    if (isAllDay) return dateLabel;
    const timeLabel = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${dateLabel} · ${timeLabel}`;
  };

  return (
    <div className="min-h-screen bg-background py-6">
      {}
      <div className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-16 z-40">
        <div className="w-full px-4 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary shadow-lg shadow-primary/20">
                <CalendarClock className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Event Manager
                </h1>
                <p className="text-sm text-muted-foreground">
                  {upcoming.length} upcoming • {past.length} past
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-56 pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-all text-sm"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) =>
                  setCategoryFilter(e.target.value as EventCategory | "all")
                }
                className="px-3 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-all"
              >
                <option value="all">All categories</option>
                {categoryOptions.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.label}
                  </option>
                ))}
              </select>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={openNewModal}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/20 hover:shadow-xl transition-all"
              >
                <Plus className="h-5 w-5" />
                <span>New Event</span>
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {}
      <div className="w-full px-4 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-violet-600 border-t-transparent" />
          </div>
        ) : events.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="p-6 rounded-full bg-primary/10 mb-6">
              <CalendarDays className="h-12 w-12 text-purple" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              No events yet
            </h2>
            <p className="text-muted-foreground mb-6">
              Track earnings dates, meetings, and personal reminders
            </p>
            <button
              onClick={openNewModal}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/20 hover:shadow-xl transition-all"
            >
              <Plus className="h-5 w-5" />
              Create your first event
            </button>
          </motion.div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No events match your search</p>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-4 w-4 text-violet-600" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Upcoming
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {upcoming.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onEdit={openEditModal}
                      onDelete={handleDelete}
                      formatDateTime={formatDateTime}
                    />
                  ))}
                </div>
              </div>
            )}

            {past.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Past
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-70">
                  {past.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onEdit={openEditModal}
                      onDelete={handleDelete}
                      formatDateTime={formatDateTime}
                    />
                  ))}
                </div>
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
              className="bg-card rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground">
                  {editingEvent ? "Edit Event" : "New Event"}
                </h3>
                <button
                  onClick={closeModal}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
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
                    placeholder="Event title..."
                    className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-all"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Details..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-all resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Date
                    </label>
                    <input
                      type="date"
                      value={formData.eventDate}
                      onChange={(e) =>
                        setFormData({ ...formData, eventDate: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Time
                    </label>
                    <input
                      type="time"
                      value={formData.eventTime}
                      disabled={formData.isAllDay}
                      onChange={(e) =>
                        setFormData({ ...formData, eventTime: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={formData.isAllDay}
                    onChange={(e) =>
                      setFormData({ ...formData, isAllDay: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-border text-violet-600 focus:ring-violet-400"
                  />
                  All-day event
                </label>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Location
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                      placeholder="Optional location..."
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Category
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {categoryOptions.map((c) => {
                      const Icon = c.icon;
                      const isSelected = formData.category === c.name;
                      return (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() =>
                            setFormData({ ...formData, category: c.name })
                          }
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                            isSelected
                              ? `${c.bg} ${c.border} ${c.text} ring-2 ring-offset-1 ring-current`
                              : "border-border text-muted-foreground hover:bg-secondary"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

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
                    className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/20 hover:shadow-xl transition-all"
                  >
                    {editingEvent ? "Save Changes" : "Create Event"}
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

function EventCard({
  event,
  onEdit,
  onDelete,
  formatDateTime,
}: {
  event: CalendarEvent;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (id: string) => void;
  formatDateTime: (date: string, isAllDay: boolean) => string;
}) {
  const category = getCategoryOption(event.category);
  const CategoryIcon = category.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -4 }}
      className={`group relative rounded-2xl border ${category.border} ${category.bg} p-5 cursor-pointer transition-all hover:shadow-lg`}
      onClick={() => onEdit(event)}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-foreground line-clamp-1 pr-2">
          {event.title}
        </h3>
        <span
          className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${category.text} bg-muted/70`}
        >
          <CategoryIcon className="h-3 w-3" />
          {category.label}
        </span>
      </div>

      {event.description && (
        <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
          {event.description}
        </p>
      )}

      <div className="space-y-1 mb-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" />
          {formatDateTime(event.eventDate, event.isAllDay)}
        </div>
        {event.location && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {event.location}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end pt-2 border-t border-border">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(event);
            }}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            title="Edit"
          >
            <Edit3 className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(event.id);
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
