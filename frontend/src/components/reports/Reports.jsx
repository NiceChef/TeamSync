import { useEffect, useState } from 'react';
import {
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { BarChart3, CheckCircle2, ListTodo, Loader2, Users } from 'lucide-react';
import { fetchTasksSummary, fetchProjectProgress, fetchUserActivity } from '../../api/reports';

const DONE_COLOR = '#10b981';
const OPEN_COLOR = '#cbd5e1';
const PROGRESS_COLOR = '#6366f1';
const REMAINING_COLOR = '#e2e8f0';
const ACTIVITY_COLOR = '#6366f1';
const COMMENT_COLOR = '#a855f7';

function Card({ icon: Icon, title, description, children }) {
    return (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2">
                <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
                    {description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
                    )}
                </div>
            </div>
            {children}
        </section>
    );
}

function StatTile({ label, value, accent }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
            <p className={`text-2xl font-bold ${accent}`}>{value}</p>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        </div>
    );
}

function EmptyChart({ children }) {
    return (
        <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {children}
        </div>
    );
}

const axisTick = { fontSize: 12, fill: '#94a3b8' };

export default function Reports({ isAuthenticated }) {
    const [summary, setSummary] = useState(null);
    const [groups, setGroups] = useState(null);
    const [users, setUsers] = useState(null);
    const [usersForbidden, setUsersForbidden] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isAuthenticated) return;
        let active = true;
        (async () => {
            setLoading(true);
            setError('');
            try {
                const [s, p] = await Promise.all([fetchTasksSummary(), fetchProjectProgress()]);
                if (!active) return;
                setSummary(s);
                setGroups(p.groups || []);
            } catch (err) {
                if (active) setError(err.message || 'Nie udało się pobrać raportów.');
            } finally {
                if (active) setLoading(false);
            }

            try {
                const u = await fetchUserActivity();
                if (active) setUsers(u.users || []);
            } catch (err) {
                if (active && err.code === 403) setUsersForbidden(true);
            }
        })();
        return () => {
            active = false;
        };
    }, [isAuthenticated]);

    if (!isAuthenticated) return null;

    const pieData = summary
        ? [
              { name: 'Zakończone', value: summary.done },
              { name: 'Otwarte', value: summary.open },
          ]
        : [];
    const hasTasks = summary && summary.total > 0;

    const groupData = (groups || []).filter((g) => g.total > 0).map((g) => ({
        name: g.name,
        Zakończone: g.done,
        Pozostałe: Math.max(g.total - g.done, 0),
    }));

    const userData = (users || [])
        .filter((u) => u.activities > 0 || u.comments > 0)
        .map((u) => ({ name: u.username, Aktywności: u.activities, Komentarze: u.comments }));

    return (
        <div className="mx-auto w-full max-w-6xl space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    Raporty
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Wizualizacje postępu zadań, grup i aktywności zespołu.
                </p>
            </div>

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex h-72 items-center justify-center gap-2 rounded-xl border border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Ładowanie raportów…
                </div>
            ) : (
                <>
                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card icon={ListTodo} title="Podsumowanie zadań" description="Widoczne dla Ciebie zadania">
                            {hasTasks ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-3">
                                        <StatTile label="Wszystkie" value={summary.total} accent="text-slate-900 dark:text-slate-100" />
                                        <StatTile label="Zakończone" value={summary.done} accent="text-emerald-600 dark:text-emerald-400" />
                                        <StatTile label="W trakcie" value={summary.in_progress} accent="text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <PieChart>
                                            <Pie
                                                data={pieData}
                                                dataKey="value"
                                                nameKey="name"
                                                innerRadius={55}
                                                outerRadius={85}
                                                paddingAngle={2}
                                            >
                                                <Cell fill={DONE_COLOR} />
                                                <Cell fill={OPEN_COLOR} />
                                            </Pie>
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <EmptyChart>Brak widocznych zadań.</EmptyChart>
                            )}
                        </Card>

                        <Card icon={CheckCircle2} title="Postęp wg grup" description="Zakończone vs pozostałe zadania">
                            {groupData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={groupData} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                        <XAxis dataKey="name" tick={axisTick} interval={0} angle={-15} textAnchor="end" height={50} />
                                        <YAxis tick={axisTick} allowDecimals={false} />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="Zakończone" stackId="a" fill={PROGRESS_COLOR} radius={[0, 0, 0, 0]} />
                                        <Bar dataKey="Pozostałe" stackId="a" fill={REMAINING_COLOR} radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <EmptyChart>Brak zadań przypisanych do grup.</EmptyChart>
                            )}
                        </Card>
                    </div>

                    {!usersForbidden && (
                        <Card icon={Users} title="Aktywność użytkowników" description="Liczba zdarzeń i komentarzy">
                            {userData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={userData} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                        <XAxis dataKey="name" tick={axisTick} interval={0} angle={-15} textAnchor="end" height={50} />
                                        <YAxis tick={axisTick} allowDecimals={false} />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="Aktywności" fill={ACTIVITY_COLOR} radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="Komentarze" fill={COMMENT_COLOR} radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <EmptyChart>Brak zarejestrowanej aktywności.</EmptyChart>
                            )}
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
