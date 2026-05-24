import { useEffect, useMemo, useState } from 'react';
import {
    Activity,
    CheckCircle2,
    ClipboardList,
    FolderKanban,
    Users,
} from 'lucide-react';
import StatCard from './StatCard';
import ReportCard from './ReportCard';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Dashboard() {
    const [tasksReport, setTasksReport] = useState('');
    const [activityReport, setActivityReport] = useState('');
    const [projectReport, setProjectReport] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const token = () => localStorage.getItem('access_token');

    useEffect(() => {
        async function loadReports() {
            setLoading(true);
            setError('');

            try {
                const headers = { Authorization: `Bearer ${token()}` };

                const [tasksResponse, activityResponse, projectsResponse] = await Promise.all([
                    fetch(`${API_URL}/api/reports/tasks-summary`, { headers }),
                    fetch(`${API_URL}/api/reports/user-activity`, { headers }),
                    fetch(`${API_URL}/api/reports/project-progress`, { headers }),
                ]);

                if (!tasksResponse.ok || !activityResponse.ok || !projectsResponse.ok) {
                    throw new Error('Nie udało się pobrać danych dashboardu.');
                }

                const [tasks, activity, projects] = await Promise.all([
                    tasksResponse.text(),
                    activityResponse.text(),
                    projectsResponse.text(),
                ]);

                setTasksReport(tasks);
                setActivityReport(activity);
                setProjectReport(projects);
            } catch (err) {
                setError(err.message || 'Nie udało się pobrać dashboardu.');
            } finally {
                setLoading(false);
            }
        }

        loadReports();
    }, []);

    const stats = useMemo(() => {
        const visibleTasks = tasksReport.match(/Widoczne zadania:\s*(\d+)/)?.[1] ?? '0';
        const doneTasks = tasksReport.match(/Zakończone \(completed\):\s*(\d+)/)?.[1] ?? '0';
        const inProgress = tasksReport.match(/W trakcie \(status\):\s*(\d+)/)?.[1] ?? '0';

        const userLines = activityReport
            .split('\n')
            .filter((line) => line.includes(':') && !line.startsWith('==='));

        const groupLines = projectReport
            .split('\n')
            .filter((line) => line.includes(':') && !line.startsWith('==='));

        return {
            visibleTasks,
            doneTasks,
            inProgress,
            users: userLines.length,
            groups: groupLines.length,
        };
    }, [tasksReport, activityReport, projectReport]);

    if (loading) {
        return (
            <div className="space-y-8">
                <div>
                    <div className="h-9 w-48 rounded-lg bg-slate-200 dark:bg-slate-800" />
                    <div className="mt-2 h-5 w-64 rounded-lg bg-slate-200 dark:bg-slate-800" />
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div
                            key={index}
                            className="h-36 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                        >
                            <div className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-800" />
                            <div className="mt-4 h-8 w-16 rounded bg-slate-200 dark:bg-slate-800" />
                            <div className="mt-6 h-3 w-36 rounded bg-slate-200 dark:bg-slate-800" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

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
                    label="Widoczne zadania"
                    value={stats.visibleTasks}
                    helper="Wszystkie zadania dostępne dla konta"
                    icon={ClipboardList}
                />
                <StatCard
                    label="Zakończone"
                    value={stats.doneTasks}
                    helper="Zadania oznaczone jako wykonane"
                    icon={CheckCircle2}
                />
                <StatCard
                    label="W trakcie"
                    value={stats.inProgress}
                    helper="Zadania ze statusem w toku"
                    icon={Activity}
                />
                <StatCard
                    label="Grupy"
                    value={stats.groups}
                    helper="Grupy/projekty widoczne w raporcie"
                    icon={Users}
                />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
                <ReportCard title="Raport zadań" icon={ClipboardList}>
                    {tasksReport}
                </ReportCard>

                <ReportCard title="Aktywność użytkowników" icon={Users}>
                    {activityReport}
                </ReportCard>

                <div className="xl:col-span-2">
                    <ReportCard title="Postęp projektów i grup" icon={FolderKanban}>
                        {projectReport}
                    </ReportCard>
                </div>
            </div>
        </div>
    );
}