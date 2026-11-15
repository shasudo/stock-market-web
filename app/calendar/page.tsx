import EconomicCalendar from "@/components/calendar/EconomicCalendar";

export default function CalendarPage() {
  return (
    <div>
      <div className="w-full">
        <div className="rounded-[10px] border border-border bg-card p-4">
          <EconomicCalendar />
        </div>
      </div>
    </div>
  );
}
