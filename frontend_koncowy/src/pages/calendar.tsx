import { useState, useCallback, useMemo, useRef, type DragEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  GripVertical,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEvents } from "@/hooks/use-events";
import { useUpdateEvent } from "@/hooks/use-update-event";
import type { CalendarEvent, CalendarEventType } from "@/types";
import {
  parseUTC,
  toUTCString,
  formatMonthYear,
  formatWeekRange,
  formatDayFull,
  formatDayShort,
  formatTime,
  formatTimeRange,
  formatHourLabel,
  getMonthGrid,
  getHourSlots,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  differenceInMinutes,
  getHours,
  getMinutes,
  setHours,
  setMinutes,
} from "@/lib/date";
import { cn } from "@/lib/utils";

type CalendarView = "month" | "week" | "day";

const EVENT_COLORS: Record<CalendarEventType, string> = {
  meeting: "bg-blue-500",
  deadline: "bg-red-500",
  reminder: "bg-amber-500",
};

const EVENT_BG: Record<CalendarEventType, string> = {
  meeting: "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300",
  deadline: "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300",
  reminder: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300",
};

// ─── Drag & Drop helpers ───────────────────────────────────────────────

function setDragData(e: DragEvent, eventId: string) {
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", eventId);
}

function getDragData(e: DragEvent): string {
  return e.dataTransfer.getData("text/plain");
}

// ─── Event Detail Popover ──────────────────────────────────────────────

function EventPopover({
  event,
  onClose,
}: {
  event: CalendarEvent;
  onClose: () => void;
}) {
  const start = parseUTC(event.start);
  const end = parseUTC(event.end);

  return (
    <div
      className="absolute z-50 w-72 rounded-lg border bg-popover p-4 shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("h-2.5 w-2.5 rounded-full", EVENT_COLORS[event.type])} />
          <h3 className="text-sm font-semibold">{event.title}</h3>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-xs"
        >
          &times;
        </button>
      </div>
      {event.description && (
        <p className="mb-2 text-xs text-muted-foreground">{event.description}</p>
      )}
      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          <span>{formatTimeRange(start, end)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-3 w-3" />
          <span>{formatDayShort(start)}</span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {event.attendees.slice(0, 4).map((u) => (
          <span
            key={u.id}
            className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium"
          >
            {u.firstName}
          </span>
        ))}
        {event.attendees.length > 4 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
            +{event.attendees.length - 4}
          </span>
        )}
      </div>
      <Badge variant="outline" className="mt-3">
        {event.type}
      </Badge>
    </div>
  );
}

// ─── Month View ────────────────────────────────────────────────────────

function MonthView({
  currentDate,
  events,
  onSelectDay,
  onDropEvent,
  selectedEvent,
  onSelectEvent,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectDay: (day: Date) => void;
  onDropEvent: (eventId: string, targetDay: Date) => void;
  selectedEvent: CalendarEvent | null;
  onSelectEvent: (event: CalendarEvent | null) => void;
}) {
  const days = getMonthGrid(currentDate);
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = parseUTC(ev.start).toDateString();
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    }
    return map;
  }, [events]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  return (
    <div className="rounded-lg border">
      <div className="grid grid-cols-7 border-b">
        {dayNames.map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayKey = day.toDateString();
          const dayEvents = eventsByDay.get(dayKey) ?? [];
          const inMonth = isSameMonth(day, currentDate);
          const today = isToday(day);

          return (
            <div
              key={dayKey}
              className={cn(
                "relative min-h-[100px] border-b border-r p-1 transition-colors",
                !inMonth && "bg-muted/30",
                today && "bg-primary/5",
              )}
              onClick={() => onSelectDay(day)}
              onDragOver={handleDragOver}
              onDrop={(e) => {
                e.preventDefault();
                const eventId = getDragData(e);
                if (eventId) onDropEvent(eventId, day);
              }}
            >
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                  today && "bg-primary text-primary-foreground font-bold",
                  !inMonth && "text-muted-foreground/50",
                )}
              >
                {day.getDate()}
              </span>
              <div className="mt-0.5 space-y-0.5">
                {dayEvents.slice(0, 3).map((ev) => (
                  <button
                    key={ev.id}
                    draggable
                    onDragStart={(e) => setDragData(e, ev.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent(selectedEvent?.id === ev.id ? null : ev);
                    }}
                    className={cn(
                      "flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] font-medium leading-tight transition-colors border",
                      EVENT_BG[ev.type],
                      "hover:opacity-80 cursor-grab active:cursor-grabbing",
                    )}
                  >
                    <GripVertical className="h-2.5 w-2.5 shrink-0 opacity-40" />
                    <span className="truncate">{ev.title}</span>
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <span className="block text-[10px] text-muted-foreground pl-1">
                    +{dayEvents.length - 3} more
                  </span>
                )}
              </div>
              {selectedEvent &&
                isSameDay(parseUTC(selectedEvent.start), day) && (
                  <EventPopover
                    event={selectedEvent}
                    onClose={() => onSelectEvent(null)}
                  />
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week View ─────────────────────────────────────────────────────────

function WeekView({
  currentDate,
  events,
  onDropEvent,
  selectedEvent,
  onSelectEvent,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onDropEvent: (eventId: string, targetDate: Date) => void;
  selectedEvent: CalendarEvent | null;
  onSelectEvent: (event: CalendarEvent | null) => void;
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const hours = getHourSlots();
  const containerRef = useRef<HTMLDivElement>(null);

  const weekDays = useMemo(() => {
    const days: Date[] = [];
    let d = weekStart;
    while (d <= weekEnd) {
      days.push(d);
      d = addDays(d, 1);
    }
    return days;
  }, [weekStart, weekEnd]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  return (
    <div className="overflow-auto rounded-lg border" ref={containerRef}>
      {/* Header */}
      <div className="sticky top-0 z-10 grid grid-cols-[60px_repeat(7,1fr)] border-b bg-card">
        <div className="border-r" />
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            className={cn(
              "border-r px-2 py-2 text-center",
              isToday(day) && "bg-primary/5",
            )}
          >
            <div className="text-xs text-muted-foreground">
              {formatDayShort(day).split(",")[0]}
            </div>
            <div
              className={cn(
                "mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                isToday(day) && "bg-primary text-primary-foreground",
              )}
            >
              {day.getDate()}
            </div>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)]">
        {hours.map((hour) => (
          <div key={hour} className="contents">
            <div className="flex h-14 items-start justify-end border-b border-r pr-2 pt-0.5 text-[10px] text-muted-foreground">
              {formatHourLabel(hour)}
            </div>
            {weekDays.map((day) => {
              const cellEvents = events.filter((ev) => {
                const s = parseUTC(ev.start);
                return isSameDay(s, day) && getHours(s) === hour;
              });

              return (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  className={cn(
                    "relative h-14 border-b border-r transition-colors hover:bg-muted/30",
                    isToday(day) && "bg-primary/2",
                  )}
                  onDragOver={handleDragOver}
                  onDrop={(e) => {
                    e.preventDefault();
                    const eventId = getDragData(e);
                    if (eventId) {
                      const target = setHours(setMinutes(day, 0), hour);
                      onDropEvent(eventId, target);
                    }
                  }}
                >
                  {cellEvents.map((ev) => {
                    const s = parseUTC(ev.start);
                    const eEnd = parseUTC(ev.end);
                    const duration = Math.max(differenceInMinutes(eEnd, s), 15);
                    const topOffset = getMinutes(s);
                    const heightPx = Math.min((duration / 60) * 56, 112);

                    return (
                      <button
                        key={ev.id}
                        draggable
                        onDragStart={(e) => setDragData(e, ev.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEvent(
                            selectedEvent?.id === ev.id ? null : ev,
                          );
                        }}
                        className={cn(
                          "absolute left-0.5 right-0.5 rounded border px-1 py-0.5 text-left text-[10px] font-medium leading-tight",
                          EVENT_BG[ev.type],
                          "cursor-grab active:cursor-grabbing overflow-hidden",
                        )}
                        style={{
                          top: `${(topOffset / 60) * 56}px`,
                          height: `${heightPx}px`,
                        }}
                      >
                        <div className="flex items-center gap-0.5">
                          <GripVertical className="h-2.5 w-2.5 shrink-0 opacity-40" />
                          <span className="truncate">{ev.title}</span>
                        </div>
                        {duration >= 30 && (
                          <span className="opacity-70">{formatTime(s)}</span>
                        )}
                      </button>
                    );
                  })}
                  {selectedEvent &&
                    cellEvents.some((e) => e.id === selectedEvent.id) && (
                      <EventPopover
                        event={selectedEvent}
                        onClose={() => onSelectEvent(null)}
                      />
                    )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Day View ──────────────────────────────────────────────────────────

function DayView({
  currentDate,
  events,
  onDropEvent,
  selectedEvent,
  onSelectEvent,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onDropEvent: (eventId: string, targetDate: Date) => void;
  selectedEvent: CalendarEvent | null;
  onSelectEvent: (event: CalendarEvent | null) => void;
}) {
  const hours = getHourSlots();
  const dayEvents = useMemo(
    () => events.filter((ev) => isSameDay(parseUTC(ev.start), currentDate)),
    [events, currentDate],
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  return (
    <div className="overflow-auto rounded-lg border">
      <div className="grid grid-cols-[60px_1fr]">
        {hours.map((hour) => {
          const cellEvents = dayEvents.filter(
            (ev) => getHours(parseUTC(ev.start)) === hour,
          );

          return (
            <div key={hour} className="contents">
              <div className="flex h-16 items-start justify-end border-b border-r pr-2 pt-1 text-xs text-muted-foreground">
                {formatHourLabel(hour)}
              </div>
              <div
                className="relative h-16 border-b transition-colors hover:bg-muted/30"
                onDragOver={handleDragOver}
                onDrop={(e) => {
                  e.preventDefault();
                  const eventId = getDragData(e);
                  if (eventId) {
                    const target = setHours(setMinutes(currentDate, 0), hour);
                    onDropEvent(eventId, target);
                  }
                }}
              >
                {cellEvents.map((ev) => {
                  const s = parseUTC(ev.start);
                  const eEnd = parseUTC(ev.end);
                  const duration = Math.max(differenceInMinutes(eEnd, s), 15);
                  const topOffset = getMinutes(s);
                  const heightPx = Math.min((duration / 60) * 64, 128);

                  return (
                    <button
                      key={ev.id}
                      draggable
                      onDragStart={(e) => setDragData(e, ev.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(
                          selectedEvent?.id === ev.id ? null : ev,
                        );
                      }}
                      className={cn(
                        "absolute left-1 right-1 rounded border px-2 py-1 text-left text-xs font-medium",
                        EVENT_BG[ev.type],
                        "cursor-grab active:cursor-grabbing",
                      )}
                      style={{
                        top: `${(topOffset / 60) * 64}px`,
                        height: `${heightPx}px`,
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <GripVertical className="h-3 w-3 shrink-0 opacity-40" />
                        <span className="truncate">{ev.title}</span>
                      </div>
                      <span className="text-[10px] opacity-70">
                        {formatTimeRange(s, eEnd)}
                      </span>
                    </button>
                  );
                })}
                {selectedEvent &&
                  cellEvents.some((e) => e.id === selectedEvent.id) && (
                    <EventPopover
                      event={selectedEvent}
                      onClose={() => onSelectEvent(null)}
                    />
                  )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Calendar Page ────────────────────────────────────────────────

export function CalendarPage() {
  const { data: events = [], isLoading } = useEvents();
  const updateMutation = useUpdateEvent();

  const [view, setView] = useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const navigateBack = useCallback(() => {
    setSelectedEvent(null);
    setCurrentDate((d) =>
      view === "month" ? subMonths(d, 1) : view === "week" ? subWeeks(d, 1) : subDays(d, 1),
    );
  }, [view]);

  const navigateForward = useCallback(() => {
    setSelectedEvent(null);
    setCurrentDate((d) =>
      view === "month" ? addMonths(d, 1) : view === "week" ? addWeeks(d, 1) : addDays(d, 1),
    );
  }, [view]);

  const goToToday = useCallback(() => {
    setSelectedEvent(null);
    setCurrentDate(new Date());
  }, []);

  const handleDropEvent = useCallback(
    (eventId: string, targetDate: Date) => {
      const event = events.find((e) => e.id === eventId);
      if (!event) return;

      const oldStart = parseUTC(event.start);
      const oldEnd = parseUTC(event.end);
      const durationMs = oldEnd.getTime() - oldStart.getTime();

      const newStart = view === "month"
        ? setMinutes(setHours(targetDate, getHours(oldStart)), getMinutes(oldStart))
        : targetDate;
      const newEnd = new Date(newStart.getTime() + durationMs);

      updateMutation.mutate({
        id: eventId,
        start: toUTCString(newStart),
        end: toUTCString(newEnd),
      });
    },
    [events, updateMutation, view],
  );

  const handleSelectDay = useCallback((day: Date) => {
    setSelectedEvent(null);
    setCurrentDate(day);
    setView("day");
  }, []);

  const headerLabel = useMemo(() => {
    if (view === "month") return formatMonthYear(currentDate);
    if (view === "week") {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
      const we = endOfWeek(currentDate, { weekStartsOn: 1 });
      return formatWeekRange(ws, we);
    }
    return formatDayFull(currentDate);
  }, [view, currentDate]);

  const views: { key: CalendarView; label: string }[] = [
    { key: "month", label: "Month" },
    { key: "week", label: "Week" },
    { key: "day", label: "Day" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground">
            Manage your schedule and deadlines
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={navigateBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={navigateForward}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="ml-2 text-lg font-semibold">{headerLabel}</h2>
        </div>
        <div className="flex gap-1 rounded-lg border p-0.5">
          {views.map((v) => (
            <Button
              key={v.key}
              variant={view === v.key ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setSelectedEvent(null);
                setView(v.key);
              }}
            >
              {v.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Calendar body */}
      {isLoading ? (
        <div className="flex h-96 items-center justify-center rounded-lg border text-muted-foreground">
          Loading events...
        </div>
      ) : (
        <>
          {view === "month" && (
            <MonthView
              currentDate={currentDate}
              events={events}
              onSelectDay={handleSelectDay}
              onDropEvent={handleDropEvent}
              selectedEvent={selectedEvent}
              onSelectEvent={setSelectedEvent}
            />
          )}
          {view === "week" && (
            <WeekView
              currentDate={currentDate}
              events={events}
              onDropEvent={handleDropEvent}
              selectedEvent={selectedEvent}
              onSelectEvent={setSelectedEvent}
            />
          )}
          {view === "day" && (
            <DayView
              currentDate={currentDate}
              events={events}
              onDropEvent={handleDropEvent}
              selectedEvent={selectedEvent}
              onSelectEvent={setSelectedEvent}
            />
          )}
        </>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="font-medium">Legend:</span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
          Meeting
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          Deadline
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          Reminder
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <GripVertical className="h-3 w-3" />
          Drag events to reschedule
        </span>
      </div>
    </div>
  );
}
