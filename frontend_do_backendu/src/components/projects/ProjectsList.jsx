import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, Plus, Search, X } from 'lucide-react';
import { API_URL, fetchWithAuth } from '../../api/authFetch';
import { listProjects, createProject } from '../../api/projects';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { PROJECT_STATUSES, statusMeta, initials } from './projectUtils';

function ProgressBar({ value }) {
    return (
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all"
                style={{ width: `${value}%` }}
            />
        </div>
    );
}

function MemberAvatars({ members = [], count }) {
    const shown = members.slice(0, 4);
    const extra = (count ?? members.length) - shown.length;
    if (!shown.length && !count) return null;
    return (
        <div className="flex -space-x-2">
            {shown.map((m) => (
                <span
                    key={m.id}
                    title={m.username}
                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-indigo-100 text-[10px] font-semibold text-indigo-700 dark:border-slate-900 dark:bg-indigo-500/20 dark:text-indigo-200"
                >
                    {initials(m)}
                </span>
            ))}
            {extra > 0 && (
                <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-semibold text-slate-600 dark:border-slate-900 dark:bg-slate-800 dark:text-slate-300">
                    +{extra}
                </span>
            )}
        </div>
    );
}

function CreateProjectDialog({ open, onClose, onCreated }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState('draft');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (open) {
            setName('');
            setDescription('');
            setStatus('draft');
            setError('');
        }
    }, [open]);

    if (!open) return null;

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        try {
            const project = await createProject({ name, description, status });
            onCreated(project);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        Nowy projekt
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {error && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
                        {error}
                    </div>
                )}

                <form onSubmit={submit} className="space-y-4">
                    <label className="block">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                            Nazwa
                        </span>
                        <input
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            autoFocus
                        />
                    </label>

                    <label className="block">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                            Opis opcjonalnie
                        </span>
                        <textarea
                            rows={3}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </label>

                    <label className="block">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                            Status
                        </span>
                        <select
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                        >
                            {PROJECT_STATUSES.map((s) => (
                                <option key={s.code} value={s.code}>
                                    {s.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="secondary" onClick={onClose}>
                            Anuluj
                        </Button>
                        <Button type="submit" variant="primary" disabled={saving}>
                            {saving ? 'Tworzenie...' : 'Utwórz projekt'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function ProjectsList({ isAuthenticated }) {
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [q, setQ] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [me, setMe] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) return;
        (async () => {
            try {
                const r = await fetchWithAuth(`${API_URL}/api/auth/me`);
                if (r.ok) setMe(await r.json());
            } catch {
                /* ignore */
            }
        })();
    }, [isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated) return;
        let active = true;
        setLoading(true);
        setError('');
        const handle = setTimeout(async () => {
            try {
                const data = await listProjects({ q, status: statusFilter });
                if (active) setProjects(Array.isArray(data) ? data : []);
            } catch (err) {
                if (active) setError(err.message);
            } finally {
                if (active) setLoading(false);
            }
        }, 250);
        return () => {
            active = false;
            clearTimeout(handle);
        };
    }, [isAuthenticated, q, statusFilter]);

    if (!isAuthenticated) return null;

    const canCreate = me && me.role !== 'client';

    return (
        <div className="mx-auto w-full max-w-6xl space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="bg-gradient-to-r from-indigo-600 to-purple-700 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
                        Projekty
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Zarządzaj projektami zespołu, śledź postęp i członków.
                    </p>
                </div>
                {canCreate && (
                    <Button variant="primary" onClick={() => setDialogOpen(true)}>
                        <Plus className="h-4 w-4" />
                        Nowy projekt
                    </Button>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[220px] flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        type="search"
                        placeholder="Szukaj projektu..."
                        className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                </div>
                <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
                    {[{ code: '', label: 'Wszystkie' }, ...PROJECT_STATUSES].map((s) => (
                        <button
                            key={s.code || 'all'}
                            type="button"
                            onClick={() => setStatusFilter(s.code)}
                            className={[
                                'rounded-md px-3 py-1.5 text-sm font-medium transition',
                                statusFilter === s.code
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                            ].join(' ')}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className="h-44 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50"
                        />
                    ))}
                </div>
            ) : projects.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-700">
                    <FolderKanban className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
                    <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                        Brak projektów do wyświetlenia.
                    </p>
                    {canCreate && (
                        <p className="mt-1 text-sm text-slate-400">
                            Utwórz pierwszy projekt, aby rozpocząć.
                        </p>
                    )}
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {projects.map((p) => {
                        const meta = statusMeta(p.status);
                        return (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => navigate(`/projects/${p.id}`)}
                                className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-px hover:border-indigo-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/40"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                                        {p.name}
                                    </h3>
                                    <Badge variant={meta.variant}>{meta.label}</Badge>
                                </div>
                                <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm text-slate-500 dark:text-slate-400">
                                    {p.description || 'Brak opisu'}
                                </p>
                                <div className="mt-3">
                                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                        <span>Postęp · {p.task_count} zad.</span>
                                        <span>{p.progress_percent}%</span>
                                    </div>
                                    <ProgressBar value={p.progress_percent} />
                                </div>
                                <div className="mt-4 flex items-center justify-between">
                                    <MemberAvatars count={p.member_count} />
                                    <span className="text-xs text-slate-400">
                                        {p.member_count} {p.member_count === 1 ? 'członek' : 'członków'}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            <CreateProjectDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                onCreated={(project) => {
                    setDialogOpen(false);
                    navigate(`/projects/${project.id}`);
                }}
            />
        </div>
    );
}
