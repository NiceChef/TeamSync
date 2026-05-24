import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    CheckCircle2,
    Circle,
    Pencil,
    Plus,
    Search,
    Trash2,
    UserMinus,
    Users,
} from 'lucide-react';
import { API_URL, fetchWithAuth } from '../../api/authFetch';
import {
    getProject,
    updateProject,
    deleteProject,
    addProjectMember,
    removeProjectMember,
    searchUsers,
} from '../../api/projects';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { PROJECT_STATUSES, statusMeta, initials } from './projectUtils';

const PRIORITY_META = {
    high: { label: 'Wysoki', variant: 'danger' },
    medium: { label: 'Średni', variant: 'warning' },
    low: { label: 'Niski', variant: 'default' },
};

function EditProjectForm({ project, onSaved, onCancel }) {
    const [name, setName] = useState(project.name);
    const [description, setDescription] = useState(project.description || '');
    const [status, setStatus] = useState(project.status);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        try {
            const updated = await updateProject(project.id, { name, description, status });
            onSaved(updated);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <form
            onSubmit={submit}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
                    {error}
                </div>
            )}
            <label className="block">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Nazwa</span>
                <input
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />
            </label>
            <label className="block">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Opis</span>
                <textarea
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
            </label>
            <label className="block">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Status</span>
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
            <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={onCancel}>
                    Anuluj
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Zapisywanie...' : 'Zapisz zmiany'}
                </Button>
            </div>
        </form>
    );
}

function MembersPanel({ project, canManage, onChanged }) {
    const [userSearch, setUserSearch] = useState('');
    const [hits, setHits] = useState([]);
    const [error, setError] = useState('');

    const doSearch = async () => {
        setError('');
        try {
            const data = await searchUsers(userSearch);
            const memberIds = new Set((project.members || []).map((m) => m.id));
            setHits(data.filter((u) => !memberIds.has(u.id)));
        } catch (err) {
            setError(err.message);
        }
    };

    const add = async (userId) => {
        setError('');
        try {
            const updated = await addProjectMember(project.id, userId);
            setHits((h) => h.filter((u) => u.id !== userId));
            onChanged(updated);
        } catch (err) {
            setError(err.message);
        }
    };

    const remove = async (userId) => {
        setError('');
        try {
            await removeProjectMember(project.id, userId);
            onChanged({
                ...project,
                members: project.members.filter((m) => m.id !== userId),
            });
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                    Członkowie ({(project.members || []).length})
                </h3>
            </div>

            {error && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
                    {error}
                </div>
            )}

            {(project.members || []).length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Brak członków.</p>
            ) : (
                <ul className="space-y-2">
                    {project.members.map((m) => (
                        <li
                            key={m.id}
                            className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950"
                        >
                            <span className="flex min-w-0 items-center gap-2">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">
                                    {initials(m)}
                                </span>
                                <span className="min-w-0 truncate text-sm text-slate-700 dark:text-slate-200">
                                    {m.username}
                                </span>
                            </span>
                            {canManage && (
                                <button
                                    type="button"
                                    onClick={() => remove(m.id)}
                                    title="Usuń członka"
                                    className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                                >
                                    <UserMinus className="h-4 w-4" />
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {canManage && (
                <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                    <div className="flex gap-2">
                        <input
                            type="search"
                            placeholder="Szukaj użytkownika..."
                            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                        />
                        <Button variant="secondary" size="sm" onClick={doSearch}>
                            <Search className="h-4 w-4" />
                        </Button>
                    </div>
                    {hits.length > 0 && (
                        <ul className="mt-3 space-y-2">
                            {hits.map((u) => (
                                <li
                                    key={u.id}
                                    className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950"
                                >
                                    <span className="min-w-0 truncate text-slate-700 dark:text-slate-200">
                                        {u.username} <span className="text-slate-400">({u.email})</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => add(u.id)}
                                        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Dodaj
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </section>
    );
}

function TasksPanel({ tasks }) {
    return (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">
                Zadania projektu ({tasks.length})
            </h3>
            {tasks.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Ten projekt nie ma jeszcze przypisanych zadań.
                </p>
            ) : (
                <ul className="space-y-2">
                    {tasks.map((t) => {
                        const prio = PRIORITY_META[t.priority] || PRIORITY_META.medium;
                        return (
                            <li
                                key={t.id}
                                className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-slate-950"
                            >
                                <span className="flex min-w-0 items-center gap-2">
                                    {t.completed ? (
                                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                                    ) : (
                                        <Circle className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
                                    )}
                                    <span
                                        className={[
                                            'min-w-0 truncate text-sm',
                                            t.completed
                                                ? 'text-slate-400 line-through'
                                                : 'text-slate-700 dark:text-slate-200',
                                        ].join(' ')}
                                    >
                                        {t.topic}
                                    </span>
                                </span>
                                <span className="flex shrink-0 items-center gap-2">
                                    {t.status?.label && (
                                        <span className="text-xs text-slate-400">{t.status.label}</span>
                                    )}
                                    <Badge variant={prio.variant}>{prio.label}</Badge>
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}

export default function ProjectDetail({ isAuthenticated }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState(null);
    const [me, setMe] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const load = async () => {
        setError('');
        try {
            const data = await getProject(id);
            setProject(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

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
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, id]);

    if (!isAuthenticated) return null;

    if (loading) {
        return (
            <div className="mx-auto w-full max-w-5xl">
                <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50" />
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="mx-auto w-full max-w-5xl space-y-4">
                <Button variant="ghost" onClick={() => navigate('/projects')}>
                    <ArrowLeft className="h-4 w-4" />
                    Wróć do projektów
                </Button>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
                    {error || 'Nie znaleziono projektu.'}
                </div>
            </div>
        );
    }

    const meta = statusMeta(project.status);
    const isClient = me?.role === 'client';
    const canManage = !isClient;
    const isOwner = me && me.id === project.created_by_id;
    const tasks = project.tasks || [];

    const handleDelete = async () => {
        if (!window.confirm(`Usunąć projekt „${project.name}"? Zadania zostaną odpięte, nie usunięte.`)) {
            return;
        }
        setDeleting(true);
        try {
            await deleteProject(project.id);
            navigate('/projects');
        } catch (err) {
            setError(err.message);
            setDeleting(false);
        }
    };

    return (
        <div className="mx-auto w-full max-w-5xl space-y-6">
            <Button variant="ghost" onClick={() => navigate('/projects')}>
                <ArrowLeft className="h-4 w-4" />
                Projekty
            </Button>

            {editing ? (
                <EditProjectForm
                    project={project}
                    onCancel={() => setEditing(false)}
                    onSaved={(updated) => {
                        setProject((prev) => ({ ...prev, ...updated, tasks: prev.tasks, members: updated.members ?? prev.members }));
                        setEditing(false);
                    }}
                />
            ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                                    {project.name}
                                </h2>
                                <Badge variant={meta.variant}>{meta.label}</Badge>
                            </div>
                            <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                                {project.description || 'Brak opisu.'}
                            </p>
                        </div>
                        {canManage && (
                            <div className="flex gap-2">
                                <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                                    <Pencil className="h-4 w-4" />
                                    Edytuj
                                </Button>
                                {isOwner && (
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        onClick={handleDelete}
                                        disabled={deleting}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Usuń
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="mt-5 max-w-md">
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span>
                                Postęp · {tasks.filter((t) => t.completed).length}/{project.task_count} zadań
                            </span>
                            <span>{project.progress_percent}%</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all"
                                style={{ width: `${project.progress_percent}%` }}
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
                <TasksPanel tasks={tasks} />
                <MembersPanel
                    project={project}
                    canManage={canManage}
                    onChanged={(updated) =>
                        setProject((prev) => ({
                            ...prev,
                            ...updated,
                            tasks: prev.tasks,
                        }))
                    }
                />
            </div>
        </div>
    );
}
