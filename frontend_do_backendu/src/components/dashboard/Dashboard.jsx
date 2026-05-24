import { useEffect, useState } from 'react';
import {
    CalendarDays,
    CheckSquare,
    FolderKanban,
    Users,
} from 'lucide-react';
import StatCard from './StatCard';
import { API_URL, fetchWithAuth } from '../../api/authFetch';

const PRIORITY_BADGE = {
    high: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200',
    medium: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
    low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const PRIORITY_LABEL = { high: 'Wysoki', medium: 'Średni', low: 'Niski' };

const EVENT_BADGE = {
    meeting: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-200',
    deadline: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200',
    reminder: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
};

const EVENT_LABEL = { meeting: 'Spotkanie', deadline: 'Termin', reminder: 'Przypomnienie' };

function formatEventDateTime(value) {
    if (!value) return '';
    const date = new Date(value);
    return date.toLocaleString('pl-PL', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function ListSkeleton() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
                <div
                    key={index}
                    className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                >
                    <div className="space-y-2">
                        <div className="h-4 w-44 rounded bg-slate-200 dark:bg-slate-800" />
                        <div className="h-3 w-28 rounded bg-slate-200 dark:bg-slate-800" />
                    </div>
                    <div className="h-5 w-16 rounded-full bg-slate-200 dark:bg-slate-800" />
                </div>
            ))}
        </div>
    );
}

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [recentTasks, setRecentTasks] = useState([]);
    const [upcomingEvents, setUpcomingEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setError('');
            try {
                const [statsRes, tasksRes, eventsRes] = await Promise.all([
                    fetchWithAuth(`${API_URL}/api/dashboard/stats`),
                    fetchWithAuth(`${API_URL}/api/dashboard/recent-tasks`),
                    fetchWithAuth(`${API_URL}/api/dashboard/upcoming-events`),
                ]);

                if (!statsRes.ok || !tasksRes.ok || !eventsRes.ok) {
                    throw new Error('Nie udało się pobrać danych dashboardu.');
                }

                const [statsData, tasksData, eventsData] = await Promise.all([
                    statsRes.json(),
                    tasksRes.json(),
                    eventsRes.json(),
                ]);

                if (cancelled) return;
                setStats(statsData);
                setRecentTasks(Array.isArray(tasksData) ? tasksData : []);
                setUpcomingEvents(Array.isArray(eventsData) ? eventsData : []);
            } catch (err) {
                if (!cancelled) setError(err.message || 'Nie udało się pobrać dashboardu.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-2">
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    Dashboard
                </h2>
                <p className="text-slate-500 dark:text-slate-400">
                    Szybki przegląd pracy zespołu i aktywności w TeamSync.
                </p>
            </div>

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                    {error}
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    label="Projekty"
                    value={loading ? '—' : stats?.projects ?? 0}
                    helper="Projekty widoczne dla konta"
                    icon={FolderKanban}
                />
                <StatCard
                    label="Aktywne zadania"
                    value={loading ? '—' : stats?.active_tasks ?? 0}
                    helper="Zadania jeszcze niezakończone"
                    icon={CheckSquare}
                />
                <StatCard
                    label="Nadchodzące wydarzenia"
                    value={loading ? '—' : stats?.upcoming_events ?? 0}
                    helper="Wydarzenia w przyszłości"
                    icon={CalendarDays}
                />
                <StatCard
                    label="Członkowie zespołu"
                    value={loading ? '—' : stats?.members ?? 0}
                    helper="Osoby w Twojej organizacji"
                    icon={Users}
                />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
                <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
                        Ostatnie zadania
                    </h3>
                    {loading ? (
                        <ListSkeleton />
                    ) : recentTasks.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">Brak zadań do wyświetlenia.</p>
                    ) : (
                        <div className="space-y-3">
                            {recentTasks.map((task) => {
                                const priority = task.priority || 'medium';
                                return (
                                    <div
                                        key={task.id}
                                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                                                {task.topic}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {task.assignee?.username || 'Nieprzypisane'}
                                            </p>
                                        </div>
                                        <span
                                            className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${PRIORITY_BADGE[priority] || PRIORITY_BADGE.medium}`}
                                        >
                                            {PRIORITY_LABEL[priority] || priority}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
                        Nadchodzące wydarzenia
                    </h3>
                    {loading ? (
                        <ListSkeleton />
                    ) : upcomingEvents.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">Brak nadchodzących wydarzeń.</p>
                    ) : (
                        <div className="space-y-3">
                            {upcomingEvents.map((event) => {
                                const type = event.event_type || 'meeting';
                                return (
                                    <div
                                        key={event.id}
                                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                                                {event.title}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {formatEventDateTime(event.start)}
                                            </p>
                                        </div>
                                        <span
                                            className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${EVENT_BADGE[type] || EVENT_BADGE.meeting}`}
                                        >
                                            {EVENT_LABEL[type] || type}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
