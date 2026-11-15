import EconomicCalendar from "@/components/calendar/EconomicCalendar";

export default function CalendarPage() {
  return (
    <div>
      <div className="w-full">
        <div className="rounded-lg border border-border bg-card p-4 shadow-[var(--card-shadow)]">
          <EconomicCalendar />
        </div>
      </div>
    </div>
  );
}
