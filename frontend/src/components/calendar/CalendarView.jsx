import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ChevronLeft,
    ChevronRight,
    CalendarDays,
    CheckSquare,
    Clock,
    GripVertical,
    Pencil,
    Plus,
    Trash2,
    X,
} from 'lucide-react';
import {
    EVENT_DOT,
    EVENT_CHIP,
    EVENT_LABEL,
    parseUTC,
    toUTCString,
    toLocalInputValue,
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
    startOfWeek,
    endOfWeek,
    differenceInMinutes,
    getHours,
    getMinutes,
    setHours,
    setMinutes,
    fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    fetchTasksWithDeadline,
    updateTaskDeadline,
    toDateOnly,
    taskTouchesDay,
    formatTaskDateRange,
} from './eventUtils';
import { canManage as userCanManage } from '../../constants/roles';
import { useMe } from '../../context/auth-context';
import { useTaskDrawer } from '../../context/task-drawer-context';

const EVENT_TYPES = [
    { value: 'meeting', label: 'Spotkanie' },
    { value: 'deadline', label: 'Termin' },
    { value: 'reminder', label: 'Przypomnienie' },
];

// ─── Formularz tworzenia / edycji wydarzenia ─────────────────────────────
function EventForm({ initial, onClose, onSubmit }) {
    const [title, setTitle] = useState(initial.title || '');
    const [description, setDescription] = useState(initial.description || '');
    const [eventType, setEventType] = useState(initial.event_type || 'meeting');
    const [start, setStart] = useState(initial.start || '');
    const [end, setEnd] = useState(initial.end || '');
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const submit = async (e) => {
        e.preventDefault();
        setFormError('');
        if (!title.trim()) {
            setFormError('Tytuł jest wymagany.');
            return;
        }
        if (!start || !end) {
            setFormError('Podaj początek i koniec.');
            return;
        }
        if (new Date(end) < new Date(start)) {
            setFormError('Koniec musi być po początku.');
            return;
        }
        setSaving(true);
        try {
            await onSubmit({
                title: title.trim(),
                description: description.trim(),
                event_type: eventType,
                start: toUTCString(new Date(start)),
                end: toUTCString(new Date(end)),
            });
        } catch (err) {
            setFormError(err.message || 'Nie udało się zapisać.');
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {initial.id ? 'Edytuj wydarzenie' : 'Nowe wydarzenie'}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {formError && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
                        {formError}
                    </div>
                )}

                <form onSubmit={submit} className="space-y-4">
                    <label className="block">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Tytuł</span>
                        <input
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                            autoFocus
                        />
                    </label>

                    <label className="block">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Typ</span>
                        <select
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            value={eventType}
                            onChange={(e) => setEventType(e.target.value)}
                        >
                            {EVENT_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>
                                    {t.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Początek</span>
                            <input
                                type="datetime-local"
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                value={start}
                                onChange={(e) => setStart(e.target.value)}
                                required
                            />
                        </label>
                        <label className="block">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Koniec</span>
                            <input
                                type="datetime-local"
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                value={end}
                                onChange={(e) => setEnd(e.target.value)}
                                required
                            />
                        </label>
                    </div>

                    <label className="block">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Opis opcjonalnie</span>
                        <textarea
                            rows={3}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </label>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                        >
                            Anuluj
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {saving ? 'Zapisywanie...' : initial.id ? 'Zapisz zmiany' : 'Utwórz'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function cx(...parts) {
    return parts.filter(Boolean).join(' ');
}

// Stabilna pusta referencja dla komórek bez zdarzeń (unika nowej tablicy na render).
const EMPTY_EVENTS = [];

// Dane przeciągania kodują typ, by odróżnić wydarzenie od zadania: "event:12" / "task:34".
function setDragData(e, kind, id) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${kind}:${id}`);
}

function getDragData(e) {
    const raw = e.dataTransfer.getData('text/plain');
    const idx = raw.indexOf(':');
    if (idx === -1) return { kind: 'event', id: raw };
    return { kind: raw.slice(0, idx), id: raw.slice(idx + 1) };
}

// ─── Popover ze szczegółami wydarzenia ───────────────────────────────────
function EventPopover({ event, onClose, onEdit, onDelete, canManage }) {
    const start = parseUTC(event.start);
    const end = parseUTC(event.end);
    const type = event.event_type || 'meeting';
    const attendees = event.attendees || [];
    function TaskPopover({ task, onClose, onOpen }) {
        if (!task) return null;

        const statusLabel = task.status?.label || (task.completed ? 'Zakończone' : 'Otwarte');
        const projectLabel = task.project?.name || task.project_name || 'Bez projektu';
        const typeLabel = task.parent_id || task.relation_type === 'subtask' ? 'Podzadanie' : 'Zadanie';

        return (
            <div
                className="absolute z-50 w-72 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-lg dark:border-slate-700 dark:bg-slate-900"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
                            {typeLabel}
                        </p>
                        <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {task.topic}
                        </h3>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                        &times;
                    </button>
                </div>

                {task.notes && (
                    <p className="mb-3 line-clamp-3 text-xs text-slate-500 dark:text-slate-400">
                        {task.notes}
                    </p>
                )}

                <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center justify-between gap-3">
                        <span>Termin</span>
                        <span className="text-right font-medium text-slate-700 dark:text-slate-200">
                            {formatTaskDateRange(task)}
                        </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <span>Status</span>
                        <span className="text-right font-medium text-slate-700 dark:text-slate-200">
                            {statusLabel}
                        </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <span>Priorytet</span>
                        <span className="text-right font-medium text-slate-700 dark:text-slate-200">
                            {task.priority || '-'}
                        </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <span>Projekt</span>
                        <span className="max-w-[150px] truncate text-right font-medium text-slate-700 dark:text-slate-200">
                            {projectLabel}
                        </span>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => onOpen(task.id)}
                    className="mt-4 w-full rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                    Otwórz zadanie
                </button>
            </div>
        );
    }
    return (
        <div
            className="absolute z-50 w-72 rounded-lg border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className={cx('h-2.5 w-2.5 rounded-full', EVENT_DOT[type])} />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {event.title}
                    </h3>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                    &times;
                </button>
            </div>
            {event.description && (
                <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">{event.description}</p>
            )}
            <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    <span>{formatTimeRange(start, end)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <CalendarDays className="h-3 w-3" />
                    <span>{formatDayShort(start)}</span>
                </div>
            </div>
            {attendees.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                    {attendees.slice(0, 4).map((u) => (
                        <span
                            key={u.id}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        >
                            {u.username}
                        </span>
                    ))}
                    {attendees.length > 4 && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            +{attendees.length - 4}
                        </span>
                    )}
                </div>
            )}
            <div className="mt-3 flex items-center justify-between gap-2">
                <span
                    className={cx(
                        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                        EVENT_CHIP[type],
                    )}
                >
                    {EVENT_LABEL[type] || type}
                </span>
                {canManage && (
                    <div className="flex gap-1">
                        <button
                            type="button"
                            onClick={() => onEdit(event)}
                            title="Edytuj"
                            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                        >
                            <Pencil className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => onDelete(event)}
                            title="Usuń"
                            className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Widok miesiąca ──────────────────────────────────────────────────────
function MonthView({
    currentDate,
    events,
    tasks,
    onSelectDay,
    onCreateAt,
    onDropEvent,
    onDropTask,
    selectedEvent,
    selectedTask,
    onSelectEvent,
    onSelectTask,
    onOpenTask,
    canManage,
    onEditEvent,
    onDeleteEvent,
}) {
    const days = getMonthGrid(currentDate);
    const dayNames = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nie'];

    const eventsByDay = useMemo(() => {
        const map = new Map();
        for (const ev of events) {
            const key = parseUTC(ev.start).toDateString();
            const arr = map.get(key) ?? [];
            arr.push(ev);
            map.set(key, arr);
        }
        return map;
    }, [events]);

    const tasksByDay = useMemo(() => {
        const map = new Map();

        for (const day of days) {
            const matchingTasks = (tasks || []).filter((task) => taskTouchesDay(task, day));

            if (matchingTasks.length > 0) {
                map.set(day.toDateString(), matchingTasks);
            }
        }

        return map;
    }, [days, tasks]);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }, []);

    return (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800">
                {dayNames.map((d) => (
                    <div
                        key={d}
                        className="px-2 py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400"
                    >
                        {d}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7">
                {days.map((day) => {
                    const dayKey = day.toDateString();
                    const dayEvents = eventsByDay.get(dayKey) ?? [];
                    const dayTasks = tasksByDay.get(dayKey) ?? [];
                    const inMonth = isSameMonth(day, currentDate);
                    const today = isToday(day);

                    return (
                        <div
                            key={dayKey}
                            className={cx(
                                'group relative min-h-[100px] border-b border-r border-slate-200 p-1 transition-colors dark:border-slate-800',
                                !inMonth && 'bg-slate-50 dark:bg-slate-950/40',
                                today && 'bg-indigo-50/60 dark:bg-indigo-500/5',
                                canManage && 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30',
                                '[&.drag-over]:bg-indigo-50/70 [&.drag-over]:border-2 [&.drag-over]:border-dashed [&.drag-over]:border-indigo-500 dark:[&.drag-over]:bg-indigo-500/10'
                            )}
                            onClick={() => (canManage ? onCreateAt(day) : onSelectDay(day))}
                            onDragEnter={(e) => canManage && e.target === e.currentTarget && e.currentTarget.classList.add('drag-over')}
                            onDragLeave={(e) => e.target === e.currentTarget && e.currentTarget.classList.remove('drag-over')}
                            onDragOver={handleDragOver}
                            onDrop={(e) => {
                                e.preventDefault();
                                e.currentTarget.classList.remove('drag-over');
                                const { kind, id } = getDragData(e);
                                if (!id) return;
                                if (kind === 'task') onDropTask(id, day);
                                else onDropEvent(id, day);
                            }}
                        >
                            <div className="flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectDay(day);
                                    }}
                                    className={cx(
                                        'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs text-slate-700 transition hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700',
                                        today && 'bg-indigo-600 font-bold text-white hover:bg-indigo-700',
                                        !inMonth && 'text-slate-400 dark:text-slate-600',
                                    )}
                                >
                                    {day.getDate()}
                                </button>
                                {canManage && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onCreateAt(day);
                                        }}
                                        title="Dodaj wydarzenie"
                                        className="opacity-0 transition group-hover:opacity-100"
                                    >
                                        <Plus className="h-3.5 w-3.5 text-slate-400 hover:text-indigo-600" />
                                    </button>
                                )}
                            </div>
                            <div className="mt-0.5 space-y-0.5">
                                {dayTasks.slice(0, 2).map((t) => (
                                    <div key={`task-${t.id}`} className="relative">
                                        <button
                                            type="button"
                                            draggable
                                            onDragStart={(e) => {
                                                e.stopPropagation();
                                                setDragData(e, 'task', t.id);
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSelectEvent(null);
                                                onSelectTask(selectedTask?.id === t.id ? null : t);
                                            }}
                                            title={`Zadanie: ${t.topic} | ${formatTaskDateRange(t)}`}
                                            className="flex w-full cursor-grab items-center gap-1 rounded border border-dashed border-slate-300 bg-white px-1 py-0.5 text-left text-[10px] font-medium leading-tight text-slate-600 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-400 hover:text-indigo-600 hover:shadow-sm active:translate-y-0 active:cursor-grabbing dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                        >
                                            <CheckSquare className="h-2.5 w-2.5 shrink-0 opacity-60" />
                                            <span className="min-w-0 flex-1 truncate">{t.topic}</span>
                                            <span className="shrink-0 rounded bg-slate-100 px-1 text-[9px] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                                OD-DO
                                            </span>
                                        </button>

                                        {selectedTask?.id === t.id && (
                                            <TaskPopover
                                                task={selectedTask}
                                                onClose={() => onSelectTask(null)}
                                                onOpen={onOpenTask}
                                            />
                                        )}
                                    </div>
                                ))}
                                {dayEvents.slice(0, 3).map((ev) => (
                                    <button
                                        key={ev.id}
                                        type="button"
                                        draggable
                                        onDragStart={(e) => setDragData(e, 'event', ev.id)}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelectEvent(selectedEvent?.id === ev.id ? null : ev);
                                        }}
                                        className={cx(
                                            'flex w-full cursor-grab items-center gap-1 rounded border px-1 py-0.5 text-left text-[10px] font-medium leading-tight transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm hover:opacity-95 active:cursor-grabbing active:translate-y-0',
                                            EVENT_CHIP[ev.event_type || 'meeting'],
                                        )}
                                    >
                                        <GripVertical className="h-2.5 w-2.5 shrink-0 opacity-40" />
                                        <span className="truncate">{ev.title}</span>
                                    </button>
                                ))}
                                {dayEvents.length > 3 && (
                                    <span className="block pl-1 text-[10px] text-slate-500 dark:text-slate-400">
                                        +{dayEvents.length - 3} więcej
                                    </span>
                                )}
                            </div>
                            {selectedEvent && isSameDay(parseUTC(selectedEvent.start), day) && (
                                <EventPopover
                                    event={selectedEvent}
                                    onClose={() => onSelectEvent(null)}
                                    canManage={canManage}
                                    onEdit={onEditEvent}
                                    onDelete={onDeleteEvent}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Widok tygodnia ──────────────────────────────────────────────────────
function WeekView({
    currentDate,
    events,
    tasks,
    onDropEvent,
    onDropTask,
    onCreateAt,
    selectedEvent,
    selectedTask,
    onSelectEvent,
    onSelectTask,
    onOpenTask,
    canManage,
    onEditEvent,
    onDeleteEvent,
}) {
    const weekStart = startOfWeek(currentDate);
    const weekEnd = endOfWeek(currentDate);
    const hours = getHourSlots();

    // Stabilne prymitywy do listy zależności — daty to nowe obiekty przy każdym renderze.
    const weekStartMs = weekStart.getTime();
    const weekEndMs = weekEnd.getTime();
    const weekDays = useMemo(() => {
        const days = [];
        let d = new Date(weekStartMs);
        const end = new Date(weekEndMs);
        while (d <= end) {
            days.push(d);
            d = addDays(d, 1);
        }
        return days;
    }, [weekStartMs, weekEndMs]);

    // Indeks zdarzeń wg „dzień-godzina" — zamiast filtrować całą listę w każdej ze 168 komórek.
    const eventsByDayHour = useMemo(() => {
        const map = new Map();
        for (const ev of events) {
            const s = parseUTC(ev.start);
            const key = `${s.toDateString()}-${getHours(s)}`;
            const arr = map.get(key) ?? [];
            arr.push(ev);
            map.set(key, arr);
        }
        return map;
    }, [events]);

    const tasksByDay = useMemo(() => {
        const map = new Map();

        for (const day of weekDays) {
            const matchingTasks = (tasks || []).filter((task) => taskTouchesDay(task, day));

            if (matchingTasks.length > 0) {
                map.set(day.toDateString(), matchingTasks);
            }
        }

        return map;
    }, [weekDays, tasks]);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }, []);

    return (
        <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="sticky top-0 z-10 grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="border-r border-slate-200 dark:border-slate-800" />
                {weekDays.map((day) => (
                    <div
                        key={day.toISOString()}
                        className={cx(
                            'border-r border-slate-200 px-2 py-2 text-center dark:border-slate-800',
                            isToday(day) && 'bg-indigo-50/60 dark:bg-indigo-500/5',
                        )}
                    >
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            {formatDayShort(day).split(',')[0]}
                        </div>
                        <div
                            className={cx(
                                'mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold text-slate-700 dark:text-slate-200',
                                isToday(day) && 'bg-indigo-600 text-white',
                            )}
                        >
                            {day.getDate()}
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-[60px_repeat(7,1fr)]">
                {hours.map((hour) => (
                    <div key={hour} className="contents">
                        <div className="flex h-14 items-start justify-end border-b border-r border-slate-200 pr-2 pt-0.5 text-[10px] text-slate-400 dark:border-slate-800">
                            {formatHourLabel(hour)}
                        </div>
                        {weekDays.map((day) => {
                            const cellEvents = eventsByDayHour.get(`${day.toDateString()}-${hour}`) ?? EMPTY_EVENTS;
                            const cellTasks = hour === 9
                                ? (tasksByDay.get(day.toDateString()) ?? EMPTY_EVENTS)
                                : EMPTY_EVENTS;

                            return (
                                <div
                                    key={`${day.toISOString()}-${hour}`}
                                    className={cx(
                                        'relative h-14 border-b border-r border-slate-200 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40',
                                        isToday(day) && 'bg-indigo-50/30 dark:bg-indigo-500/[0.03]',
                                        canManage && 'cursor-pointer',
                                    )}
                                    onClick={() => canManage && onCreateAt(setHours(setMinutes(day, 0), hour))}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        const { kind, id } = getDragData(e);
                                        if (!id) return;

                                        const target = setHours(setMinutes(day, 0), hour);

                                        if (kind === 'task') {
                                            onDropTask(id, target);
                                        } else {
                                            onDropEvent(id, target);
                                        }
                                    }}
                                >
                                    <div className="absolute inset-x-0.5 top-0.5 z-10 space-y-1">
                                        {cellTasks.slice(0, 3).map((task) => (
                                            <div key={`week-task-${task.id}`} className="relative">
                                                <button
                                                    type="button"
                                                    draggable
                                                    onDragStart={(e) => {
                                                        e.stopPropagation();
                                                        setDragData(e, 'task', task.id);
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onSelectEvent(null);
                                                        onSelectTask(selectedTask?.id === task.id ? null : task);
                                                    }}
                                                    title={`Zadanie: ${task.topic} | ${formatTaskDateRange(task)}`}
                                                    className="flex w-full cursor-grab items-center gap-1 rounded border border-dashed border-slate-300 bg-white px-1 py-0.5 text-left text-[10px] font-medium leading-tight text-slate-600 shadow-sm transition hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                                >
                                                    <CheckSquare className="h-2.5 w-2.5 shrink-0 opacity-60" />
                                                    <span className="min-w-0 flex-1 truncate">{task.topic}</span>
                                                </button>

                                                {selectedTask?.id === task.id && (
                                                    <TaskPopover
                                                        task={selectedTask}
                                                        onClose={() => onSelectTask(null)}
                                                        onOpen={onOpenTask}
                                                    />
                                                )}
                                            </div>
                                        ))}

                                        {cellTasks.length > 3 && (
                                            <div className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                                +{cellTasks.length - 3} więcej
                                            </div>
                                        )}
                                    </div>
                                    {cellEvents.map((ev) => {
                                        const s = parseUTC(ev.start);
                                        const eEnd = parseUTC(ev.end);
                                        const duration = Math.max(differenceInMinutes(eEnd, s), 15);
                                        const topOffset = getMinutes(s);
                                        const heightPx = Math.min((duration / 60) * 56, 112);

                                        return (
                                            <button
                                                key={ev.id}
                                                type="button"
                                                draggable
                                                onDragStart={(e) => setDragData(e, 'event', ev.id)}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelectEvent(selectedEvent?.id === ev.id ? null : ev);
                                                }}
                                                className={cx(
                                                    'absolute left-0.5 right-0.5 cursor-grab overflow-hidden rounded border px-1 py-0.5 text-left text-[10px] font-medium leading-tight transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:z-10 active:cursor-grabbing active:translate-y-0',
                                                    EVENT_CHIP[ev.event_type || 'meeting'],
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
                                    {selectedEvent && cellEvents.some((e) => e.id === selectedEvent.id) && (
                                        <EventPopover
                                            event={selectedEvent}
                                            onClose={() => onSelectEvent(null)}
                                            canManage={canManage}
                                            onEdit={onEditEvent}
                                            onDelete={onDeleteEvent}
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

// ─── Widok dnia ──────────────────────────────────────────────────────────
function DayView({
    currentDate,
    events,
    tasks,
    onDropEvent,
    onDropTask,
    onCreateAt,
    selectedEvent,
    selectedTask,
    onSelectEvent,
    onSelectTask,
    onOpenTask,
    canManage,
    onEditEvent,
    onDeleteEvent,
}) {
    const [dayMode, setDayMode] = useState('tasks');
    const hours = getHourSlots();

    const dayEvents = useMemo(
        () => events.filter((ev) => isSameDay(parseUTC(ev.start), currentDate)),
        [events, currentDate],
    );

    const dayTasks = useMemo(
        () => (tasks || []).filter((task) => taskTouchesDay(task, currentDate)),
        [tasks, currentDate],
    );

    const eventsByHour = useMemo(() => {
        const map = new Map();

        for (const ev of dayEvents) {
            const h = getHours(parseUTC(ev.start));
            const arr = map.get(h) ?? [];
            arr.push(ev);
            map.set(h, arr);
        }

        return map;
    }, [dayEvents]);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }, []);

    const hasAnyItems = dayEvents.length > 0 || dayTasks.length > 0;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatDayFull(currentDate)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {dayTasks.length} zadań, {dayEvents.length} spotkań/wydarzeń
                    </p>
                </div>

                <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={() => setDayMode('tasks')}
                        className={cx(
                            'rounded-md px-3 py-1.5 text-xs font-semibold transition',
                            dayMode === 'tasks'
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                        )}
                    >
                        Zadania
                    </button>
                    <button
                        type="button"
                        onClick={() => setDayMode('meetings')}
                        className={cx(
                            'rounded-md px-3 py-1.5 text-xs font-semibold transition',
                            dayMode === 'meetings'
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                        )}
                    >
                        Spotkania
                    </button>
                </div>
            </div>

            {!hasAnyItems && (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900/50">
                    <div className="rounded-full bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                        <CalendarDays className="h-6 w-6" />
                    </div>
                    <h4 className="mt-3 text-sm font-semibold text-slate-950 dark:text-slate-100">
                        Czyste konto na dziś
                    </h4>
                    <p className="mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">
                        Nie masz zaplanowanych spotkań ani zadań na ten dzień.
                    </p>
                    {canManage && (
                        <button
                            type="button"
                            onClick={() => onCreateAt(setHours(setMinutes(currentDate, 0), 9))}
                            className="mt-4 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                            Dodaj wydarzenie
                        </button>
                    )}
                </div>
            )}

            {dayMode === 'tasks' && (
                <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    {dayTasks.length === 0 ? (
                        <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
                            Brak zadań dla wybranego dnia.
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-200 dark:divide-slate-800">
                            {dayTasks.map((task) => (
                                <div key={`day-task-${task.id}`} className="relative p-4">
                                    <button
                                        type="button"
                                        draggable
                                        onDragStart={(e) => {
                                            e.stopPropagation();
                                            setDragData(e, 'task', task.id);
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelectEvent(null);
                                            onSelectTask(selectedTask?.id === task.id ? null : task);
                                        }}
                                        className="flex w-full items-start gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-left transition hover:border-indigo-400 hover:bg-indigo-50/40 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-indigo-500/10"
                                    >
                                        <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-semibold text-slate-900 dark:text-slate-100">
                                                    {task.topic}
                                                </p>
                                                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                                                    {task.status?.label || (task.completed ? 'Zakończone' : 'Otwarte')}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                {formatTaskDateRange(task)}
                                            </p>
                                            {task.notes && (
                                                <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                                                    {task.notes}
                                                </p>
                                            )}
                                        </div>
                                    </button>

                                    {selectedTask?.id === task.id && (
                                        <TaskPopover
                                            task={selectedTask}
                                            onClose={() => onSelectTask(null)}
                                            onOpen={onOpenTask}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {dayMode === 'meetings' && (
                <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="grid grid-cols-[60px_1fr]">
                        {hours.map((hour) => {
                            const cellEvents = eventsByHour.get(hour) ?? EMPTY_EVENTS;

                            return (
                                <div key={hour} className="contents">
                                    <div className="flex h-16 items-start justify-end border-b border-r border-slate-200 pr-2 pt-1 text-xs text-slate-400 dark:border-slate-800">
                                        {formatHourLabel(hour)}
                                    </div>
                                    <div
                                        className={cx(
                                            'relative h-16 border-b border-slate-200 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40',
                                            canManage && 'cursor-pointer',
                                        )}
                                        onClick={() => canManage && onCreateAt(setHours(setMinutes(currentDate, 0), hour))}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            const { kind, id } = getDragData(e);
                                            if (!id) return;

                                            const target = setHours(setMinutes(currentDate, 0), hour);

                                            if (kind === 'task') {
                                                onDropTask(id, target);
                                            } else {
                                                onDropEvent(id, target);
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
                                                    type="button"
                                                    draggable
                                                    onDragStart={(e) => setDragData(e, 'event', ev.id)}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onSelectTask(null);
                                                        onSelectEvent(selectedEvent?.id === ev.id ? null : ev);
                                                    }}
                                                    className={cx(
                                                        'absolute left-1 right-1 cursor-grab rounded border px-2 py-1 text-left text-xs font-medium active:cursor-grabbing',
                                                        EVENT_CHIP[ev.event_type || 'meeting'],
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

                                        {selectedEvent && cellEvents.some((e) => e.id === selectedEvent.id) && (
                                            <EventPopover
                                                event={selectedEvent}
                                                onClose={() => onSelectEvent(null)}
                                                canManage={canManage}
                                                onEdit={onEditEvent}
                                                onDelete={onDeleteEvent}
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Pasek narzędzi: przyciski widoku ────────────────────────────────────
function ToolbarButton({ active, onClick, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cx(
                'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                active
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
            )}
        >
            {children}
        </button>
    );
}

function IconButton({ onClick, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
            {children}
        </button>
    );
}

// ─── Główny widok kalendarza ─────────────────────────────────────────────
export default function CalendarView({ isAuthenticated }) {
    const navigate = useNavigate();
    const { openCreateTask } = useTaskDrawer();
    const [events, setEvents] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [view, setView] = useState('month');
    const [currentDate, setCurrentDate] = useState(() => new Date());
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [selectedTask, setSelectedTask] = useState(null);
    const me = useMe();
    const [formState, setFormState] = useState(null); // null | { initial }
    const [showCreateMenu, setShowCreateMenu] = useState(false);

    const canManage = userCanManage(me);

    const loadEvents = useCallback(async () => {
        try {
            setError('');
            const data = await fetchEvents();
            setEvents(data);
        } catch (err) {
            setError(err.message || 'Nie udało się pobrać wydarzeń.');
        } finally {
            setLoading(false);
        }
    }, []);

    const loadTasks = useCallback(async () => {
        try {
            const data = await fetchTasksWithDeadline();
            setTasks(data);
        } catch {
            /* nakładka zadań jest opcjonalna */
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            setLoading(true);
            loadEvents();
            loadTasks();
        }
    }, [isAuthenticated, loadEvents, loadTasks]);

    const openCreate = useCallback((date) => {
        const base = date ? new Date(date) : new Date();
        if (!date) base.setMinutes(0, 0, 0);

        const startD = new Date(base);
        if (startD.getHours() === 0 && startD.getMinutes() === 0) {
            startD.setHours(9);
        }

        const endD = new Date(startD.getTime() + 60 * 60 * 1000);

        setSelectedEvent(null);
        setSelectedTask(null);
        setShowCreateMenu(false);
        setFormState({
            initial: {
                title: '',
                description: '',
                event_type: 'meeting',
                start: toLocalInputValue(startD),
                end: toLocalInputValue(endD),
            },
        });
    }, []);

    const handleCreateTaskFromCalendar = useCallback(() => {
        const date = toDateOnly(currentDate);

        setSelectedEvent(null);
        setSelectedTask(null);
        setShowCreateMenu(false);

        openCreateTask?.({
            defaults: {
                planned_date: date,
                deadline: date,
            },
        });
    }, [currentDate, openCreateTask]);

    const handleCreateMeetingFromCalendar = useCallback(() => {
        setShowCreateMenu(false);
        openCreate(null);
    }, [openCreate]);

    const handleCreateProjectFromCalendar = useCallback(() => {
        setSelectedEvent(null);
        setSelectedTask(null);
        setShowCreateMenu(false);
        navigate('/projects');
    }, [navigate]);

    const openEdit = useCallback((event) => {
        setSelectedEvent(null);
        setFormState({
            initial: {
                id: event.id,
                version: event.version,
                title: event.title || '',
                description: event.description || '',
                event_type: event.event_type || 'meeting',
                start: toLocalInputValue(parseUTC(event.start)),
                end: toLocalInputValue(parseUTC(event.end)),
            },
        });
    }, []);

    const handleSubmitForm = useCallback(
        async (payload) => {
            const editing = formState?.initial?.id;
            if (editing) {
                await updateEvent(editing, { ...payload, expected_version: formState.initial.version });
            } else {
                await createEvent(payload);
            }
            setFormState(null);
            await loadEvents();
        },
        [formState, loadEvents],
    );

    const handleDeleteEvent = useCallback(
        async (event) => {
            if (!window.confirm(`Usunąć wydarzenie „${event.title}"?`)) return;
            setSelectedEvent(null);
            try {
                await deleteEvent(event.id);
                setEvents((curr) => curr.filter((e) => e.id !== event.id));
            } catch (err) {
                setError(err.message || 'Nie udało się usunąć wydarzenia.');
            }
        },
        [],
    );

    const handleDropTask = useCallback(
        (taskId, targetDate) => {
            const task = tasks.find((t) => String(t.id) === String(taskId));
            if (!task) return;

            const newDeadline = toDateOnly(targetDate);
            if (task.deadline === newDeadline) return;

            // Optymistyczna aktualizacja UI.
            const previous = tasks;
            setTasks((curr) =>
                curr.map((t) =>
                    String(t.id) === String(taskId) ? { ...t, deadline: newDeadline } : t,
                ),
            );

            updateTaskDeadline(taskId, {
                deadline: newDeadline,
                expected_version: task.version,
            })
                .then((updated) => {
                    setTasks((curr) =>
                        curr.map((t) => (String(t.id) === String(updated.id) ? updated : t)),
                    );
                })
                .catch((err) => {
                    // Konflikt wersji (409) lub błąd → cofnij i odśwież z serwera.
                    setTasks(previous);
                    if (err.code === 409) {
                        setError('Zadanie zmieniło się w międzyczasie — odświeżono dane.');
                    } else {
                        setError(err.message || 'Nie udało się przenieść zadania.');
                    }
                    loadTasks();
                });
        },
        [tasks, loadTasks],
    );

    const handleOpenTask = useCallback((taskId) => {
        setSelectedEvent(null);
        setSelectedTask(null);
        navigate(`/tasks/${taskId}`);
    }, [navigate]);

    const navigateBack = useCallback(() => {
        setSelectedEvent(null);
        setSelectedTask(null);
        setCurrentDate((d) =>
            view === 'month' ? subMonths(d, 1) : view === 'week' ? subWeeks(d, 1) : addDays(d, -1),
        );
    }, [view]);

    const navigateForward = useCallback(() => {
        setSelectedEvent(null);
        setSelectedTask(null);
        setCurrentDate((d) =>
            view === 'month' ? addMonths(d, 1) : view === 'week' ? addWeeks(d, 1) : addDays(d, 1),
        );
    }, [view]);

    const goToToday = useCallback(() => {
        setSelectedEvent(null);
        setSelectedTask(null);
        setCurrentDate(new Date());
    }, []);

    const handleDropEvent = useCallback(
        (eventId, targetDate) => {
            const event = events.find((e) => String(e.id) === String(eventId));
            if (!event) return;

            const oldStart = parseUTC(event.start);
            const oldEnd = parseUTC(event.end);
            const durationMs = oldEnd.getTime() - oldStart.getTime();

            const newStart =
                view === 'month'
                    ? setMinutes(setHours(targetDate, getHours(oldStart)), getMinutes(oldStart))
                    : targetDate;
            const newEnd = new Date(newStart.getTime() + durationMs);

            const startStr = toUTCString(newStart);
            const endStr = toUTCString(newEnd);

            // Optymistyczna aktualizacja UI.
            const previous = events;
            setEvents((curr) =>
                curr.map((e) =>
                    String(e.id) === String(eventId) ? { ...e, start: startStr, end: endStr } : e,
                ),
            );
            setSelectedEvent(null);

            updateEvent(eventId, {
                start: startStr,
                end: endStr,
                expected_version: event.version,
            })
                .then((updated) => {
                    setEvents((curr) =>
                        curr.map((e) => (String(e.id) === String(updated.id) ? updated : e)),
                    );
                })
                .catch((err) => {
                    // Konflikt wersji (409) lub błąd → cofnij i odśwież z serwera.
                    setEvents(previous);
                    if (err.code === 409) {
                        setError('Wydarzenie zmieniło się w międzyczasie — odświeżono dane.');
                    } else {
                        setError(err.message || 'Nie udało się przenieść wydarzenia.');
                    }
                    loadEvents();
                });
        },
        [events, view, loadEvents],
    );

    const handleSelectDay = useCallback((day) => {
        setSelectedEvent(null);
        setSelectedTask(null);
        setCurrentDate(day);
        setView('day');
    }, []);

    const headerLabel = useMemo(() => {
        if (view === 'month') return formatMonthYear(currentDate);
        if (view === 'week') return formatWeekRange(startOfWeek(currentDate), endOfWeek(currentDate));
        return formatDayFull(currentDate);
    }, [view, currentDate]);

    const views = [
        { key: 'month', label: 'Miesiąc' },
        { key: 'week', label: 'Tydzień' },
        { key: 'day', label: 'Dzień' },
    ];

    return (
        <div
            className="space-y-4"
            onClick={() => {
                if (selectedEvent) setSelectedEvent(null);
                if (selectedTask) setSelectedTask(null);
                if (showCreateMenu) setShowCreateMenu(false);
            }}
        >
            <div className="flex flex-col gap-2">
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    Kalendarz
                </h2>
                <p className="text-slate-500 dark:text-slate-400">
                    Zarządzaj harmonogramem, spotkaniami i terminami.
                </p>
            </div>

            {error && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                    {error}
                </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <IconButton onClick={navigateBack}>
                        <ChevronLeft className="h-4 w-4" />
                    </IconButton>
                    <button
                        type="button"
                        onClick={goToToday}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        Dziś
                    </button>
                    <IconButton onClick={navigateForward}>
                        <ChevronRight className="h-4 w-4" />
                    </IconButton>
                    <h3 className="ml-2 text-lg font-semibold capitalize text-slate-900 dark:text-slate-100">
                        {headerLabel}
                    </h3>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex gap-1 rounded-lg border border-slate-200 p-0.5 dark:border-slate-800">
                        {views.map((v) => (
                            <ToolbarButton
                                key={v.key}
                                active={view === v.key}
                                onClick={() => {
                                    setSelectedEvent(null);
                                    setView(v.key);
                                }}
                            >
                                {v.label}
                            </ToolbarButton>
                        ))}
                    </div>
                    {canManage && (
                        <div className="relative">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowCreateMenu((value) => !value);
                                }}
                                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-700 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:shadow-md"
                            >
                                <Plus className="h-4 w-4" />
                                Utwórz
                            </button>

                            {showCreateMenu && (
                                <div
                                    className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-800 dark:bg-slate-900"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button
                                        type="button"
                                        onClick={handleCreateTaskFromCalendar}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                                    >
                                        <CheckSquare className="h-4 w-4 text-indigo-500" />
                                        Utwórz zadanie
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleCreateMeetingFromCalendar}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                                    >
                                        <CalendarDays className="h-4 w-4 text-blue-500" />
                                        Utwórz spotkanie
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleCreateProjectFromCalendar}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                                    >
                                        <Plus className="h-4 w-4 text-emerald-500" />
                                        Utwórz projekt
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex h-96 items-center justify-center rounded-lg border border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    Ładowanie wydarzeń…
                </div>
            ) : (
                <>
                    {view === 'month' && (
                        <MonthView
                            currentDate={currentDate}
                            events={events}
                            tasks={tasks}
                            onSelectDay={handleSelectDay}
                            onCreateAt={openCreate}
                            onDropEvent={handleDropEvent}
                            onDropTask={handleDropTask}
                            selectedEvent={selectedEvent}
                            selectedTask={selectedTask}
                            onSelectEvent={setSelectedEvent}
                            onSelectTask={setSelectedTask}
                            onOpenTask={handleOpenTask}
                            canManage={canManage}
                            onEditEvent={openEdit}
                            onDeleteEvent={handleDeleteEvent}
                        />
                    )}
                    {view === 'week' && (
                        <WeekView
                            currentDate={currentDate}
                            events={events}
                            tasks={tasks}
                            onDropEvent={handleDropEvent}
                            onDropTask={handleDropTask}
                            onCreateAt={openCreate}
                            selectedEvent={selectedEvent}
                            selectedTask={selectedTask}
                            onSelectEvent={setSelectedEvent}
                            onSelectTask={setSelectedTask}
                            onOpenTask={handleOpenTask}
                            canManage={canManage}
                            onEditEvent={openEdit}
                            onDeleteEvent={handleDeleteEvent}
                        />
                    )}
                    {view === 'day' && (
                        <DayView
                            currentDate={currentDate}
                            events={events}
                            tasks={tasks}
                            onDropEvent={handleDropEvent}
                            onDropTask={handleDropTask}
                            onCreateAt={openCreate}
                            selectedEvent={selectedEvent}
                            selectedTask={selectedTask}
                            onSelectEvent={setSelectedEvent}
                            onSelectTask={setSelectedTask}
                            onOpenTask={handleOpenTask}
                            canManage={canManage}
                            onEditEvent={openEdit}
                            onDeleteEvent={handleDeleteEvent}
                        />
                    )}
                </>
            )}

            {formState && (
                <EventForm
                    initial={formState.initial}
                    onClose={() => setFormState(null)}
                    onSubmit={handleSubmitForm}
                />
            )}

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium">Legenda:</span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    Spotkanie
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                    Termin
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    Przypomnienie
                </span>
                <span className="flex items-center gap-1.5">
                    <CheckSquare className="h-3 w-3 opacity-60" />
                    Termin zadania
                </span>
                <span className="ml-auto flex items-center gap-1.5">
                    <GripVertical className="h-3 w-3" />
                    {canManage ? 'Przeciągnij / kliknij dzień, aby dodać' : 'Przeciągnij, aby zmienić termin'}
                </span>
            </div>
        </div>
    );
}