import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { getMonday } from './calendarUtils';
import CalendarGrid from './CalendarGrid';

const monthNames = [
    'Styczeń',
    'Luty',
    'Marzec',
    'Kwiecień',
    'Maj',
    'Czerwiec',
    'Lipiec',
    'Sierpień',
    'Wrzesień',
    'Październik',
    'Listopad',
    'Grudzień',
];

export default function CalendarPanel({
    currentDate,
    calendarView,
    days,
    selectedDate,
    selectedRange,
    onPreviousMonth,
    onNextMonth,
    onPreviousWeek,
    onNextWeek,
    onToday,
    onClearSelection,
    isDateSelected,
    isDateInRange,
    hasTaskOnDate,
    onDateClick,
}) {
    const title =
        calendarView === 'month'
            ? `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
            : `Tydzień od ${getMonday(currentDate).toLocaleDateString('pl-PL')}`;

    return (
        <section className="sticky top-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5 lg:top-4">
            <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                        <CalendarDays className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                        <span>Widok kalendarza</span>
                    </div>

                    <h3 className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">
                        {title}
                    </h3>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                    <button
                        type="button"
                        onClick={calendarView === 'month' ? onPreviousMonth : onPreviousWeek}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                        aria-label="Poprzedni okres"
                        title="Poprzedni okres"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>

                    <button
                        type="button"
                        onClick={calendarView === 'month' ? onNextMonth : onNextWeek}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                        aria-label="Następny okres"
                        title="Następny okres"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={onToday}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-700 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:shadow-md"
                >
                    <CalendarDays className="h-4 w-4" />
                    Dziś
                </button>

                <button
                    type="button"
                    onClick={onClearSelection}
                    disabled={!selectedDate && !selectedRange.start}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                    <RotateCcw className="h-4 w-4" />
                    Wyczyść
                </button>
            </div>

            <CalendarGrid
                days={days}
                isDateSelected={isDateSelected}
                isDateInRange={isDateInRange}
                hasTaskOnDate={hasTaskOnDate}
                onDateClick={onDateClick}
            />

            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
                <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded border-2 border-indigo-500 bg-indigo-100" />
                    <span>Dziś</span>
                </div>

                <div className="flex items-center gap-2">
                    <span className="relative h-4 w-4 rounded border border-emerald-500 bg-white">
                        <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-emerald-500" />
                    </span>
                    <span>Zadania</span>
                </div>

                <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded bg-gradient-to-br from-indigo-500 to-purple-700" />
                    <span>Wybrany</span>
                </div>

                <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded border border-indigo-400 bg-indigo-100" />
                    <span>Zakres</span>
                </div>
            </div>
        </section>
    );
}