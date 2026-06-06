import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, MessageSquare, Paperclip, Plus, Search, X } from 'lucide-react';
import { listProjects, createProject } from '../../api/projects';
import { useMe } from '../../context/auth-context';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { PROJECT_STATUSES, statusMeta, initials } from './projectUtils';
import ProjectAssignment from './ProjectAssignment';
import { API_URL, fetchWithAuth } from '../../api/authFetch';

function toLocalDateTimeInputValue(date = new Date(), hour = null) {
    const value = new Date(date);

    if (hour !== null) {
        value.setHours(hour, 0, 0, 0);
    }

    const pad = (number) => String(number).padStart(2, '0');

    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function formatDateTime(value) {
    if (!value) return null;

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.toLocaleString('pl-PL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

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
    const me = useMe();

    const [form, setForm] = useState({
        name: '',
        description: '',
        status: 'draft',
        planned_start: toLocalDateTimeInputValue(new Date(), 7),
        deadline: toLocalDateTimeInputValue(new Date(), 16),
        member_ids: [],
        assigned_group_ids: [],
        assigned_organization_ids: [],
    });

    const [users, setUsers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [organizations, setOrganizations] = useState([]);
    const [loadingAssignments, setLoadingAssignments] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;

        let cancelled = false;

        setForm({
            name: '',
            description: '',
            status: 'draft',
            planned_start: toLocalDateTimeInputValue(new Date(), 7),
            deadline: toLocalDateTimeInputValue(new Date(), 16),
            member_ids: [],
            assigned_group_ids: [],
            assigned_organization_ids: [],
        });

        setUsers([]);
        setGroups([]);
        setOrganizations([]);
        setError('');
        setLoadingAssignments(true);

        const loadAssignments = async () => {
            try {
                const [
                    usersResponse,
                    groupsResponse,
                    organizationsResponse,
                ] = await Promise.all([
                    fetchWithAuth(`${API_URL}/api/users`),
                    fetchWithAuth(`${API_URL}/api/groups`),
                    fetchWithAuth(`${API_URL}/api/organizations`),
                ]);

                const usersData = usersResponse.ok
                    ? await usersResponse.json()
                    : [];

                const groupsData = groupsResponse.ok
                    ? await groupsResponse.json()
                    : [];

                const organizationsData = organizationsResponse.ok
                    ? await organizationsResponse.json()
                    : [];

                const groupsWithMembers = await Promise.all(
                    (Array.isArray(groupsData) ? groupsData : []).map(
                        async (group) => {
                            const response = await fetchWithAuth(
                                `${API_URL}/api/groups/${group.id}`
                            );

                            if (!response.ok) {
                                return {
                                    ...group,
                                    members: [],
                                };
                            }

                            const details = await response.json();

                            return {
                                ...group,
                                ...details,
                                members: details.members || [],
                            };
                        }
                    )
                );

                if (cancelled) return;

                setUsers(
                    Array.isArray(usersData)
                        ? usersData
                        : []
                );

                setGroups(groupsWithMembers);

                setOrganizations(
                    Array.isArray(organizationsData)
                        ? organizationsData
                        : []
                );
            } catch (loadError) {
                if (!cancelled) {
                    setError(
                        loadError.message ||
                        'Nie udało się pobrać danych przypisań.'
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoadingAssignments(false);
                }
            }
        };

        loadAssignments();

        return () => {
            cancelled = true;
        };
    }, [open, me]);

    if (!open) return null;

    const updateField = (field, value) => {
        setForm((previous) => ({
            ...previous,
            [field]: value,
        }));

        setError('');
    };

    const submit = async (event) => {
        event.preventDefault();
        setError('');

        if (!form.name.trim()) {
            setError('Nazwa projektu jest wymagana.');
            return;
        }

        if (
            form.deadline &&
            form.planned_start &&
            new Date(form.deadline) < new Date(form.planned_start)
        ) {
            setError(
                'Deadline projektu nie może być wcześniejszy niż data rozpoczęcia.'
            );
            return;
        }

        setSaving(true);

        try {
            const project = await createProject({
                name: form.name.trim(),
                description: form.description.trim(),
                status: form.status,
                planned_start: form.planned_start || null,
                deadline: form.deadline || null,
                member_ids: form.member_ids,
                assigned_group_ids: form.assigned_group_ids,
                assigned_organization_ids:
                    form.assigned_organization_ids,
            });

            onCreated(project);
        } catch (submitError) {
            setError(
                submitError.message ||
                'Nie udało się utworzyć projektu.'
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
                <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                            Nowy projekt
                        </h3>

                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Utwórz projekt i określ osoby posiadające pełny dostęp.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        title="Zamknij"
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-800"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form
                    onSubmit={submit}
                    className="flex min-h-0 flex-1 flex-col"
                >
                    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
                        {error && (
                            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
                                {error}
                            </div>
                        )}

                        <label className="block">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                Nazwa projektu
                            </span>

                            <input
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                value={form.name}
                                onChange={(event) =>
                                    updateField('name', event.target.value)
                                }
                                disabled={saving}
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
                                className="mt-1 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                value={form.description}
                                onChange={(event) =>
                                    updateField(
                                        'description',
                                        event.target.value
                                    )
                                }
                                disabled={saving}
                            />
                        </label>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block">
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                    Data rozpoczęcia
                                </span>

                                <input
                                    type="datetime-local"
                                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                    value={form.planned_start}
                                    onChange={(event) =>
                                        updateField(
                                            'planned_start',
                                            event.target.value
                                        )
                                    }
                                    disabled={saving}
                                />
                            </label>

                            <label className="block">
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                    Deadline
                                </span>

                                <input
                                    type="datetime-local"
                                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                    value={form.deadline}
                                    onChange={(event) =>
                                        updateField(
                                            'deadline',
                                            event.target.value
                                        )
                                    }
                                    disabled={saving}
                                />
                            </label>
                        </div>

                        <label className="block">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                Status
                            </span>

                            <select
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                value={form.status}
                                onChange={(event) =>
                                    updateField(
                                        'status',
                                        event.target.value
                                    )
                                }
                                disabled={saving}
                            >
                                {PROJECT_STATUSES.map((projectStatus) => (
                                    <option
                                        key={projectStatus.code}
                                        value={projectStatus.code}
                                    >
                                        {projectStatus.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        {loadingAssignments ? (
                            <div className="h-36 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                        ) : (
                            <ProjectAssignment
                                users={users}
                                groups={groups}
                                organizations={organizations}
                                memberIds={form.member_ids}
                                groupIds={form.assigned_group_ids}
                                organizationIds={
                                    form.assigned_organization_ids
                                }
                                allowOrganizations
                                disabled={saving}
                                onChange={(assignments) => {
                                    setForm((previous) => ({
                                        ...previous,
                                        ...assignments,
                                    }));

                                    setError('');
                                }}
                            />
                        )}
                    </div>

                    <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            disabled={saving}
                        >
                            Anuluj
                        </Button>

                        <Button
                            type="submit"
                            variant="primary"
                            disabled={saving || loadingAssignments}
                        >
                            {saving
                                ? 'Tworzenie...'
                                : 'Utwórz projekt'}
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
    const me = useMe();
    const [dialogOpen, setDialogOpen] = useState(false);

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

    const canCreate = !!me;

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
                                <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                                    <div>
                                        Start: <span className="font-medium text-slate-700 dark:text-slate-200">{formatDateTime(p.planned_start) || '-'}</span>
                                    </div>
                                    <div>
                                        Deadline: <span className="font-medium text-slate-700 dark:text-slate-200">{formatDateTime(p.deadline) || '-'}</span>
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                        <span>Postęp · {p.task_count} zad.</span>
                                        <span>{p.progress_percent}%</span>
                                    </div>
                                    <ProgressBar value={p.progress_percent} />
                                </div>
                                <div className="mt-4 flex items-center justify-between gap-3">
                                    {p.partial_access ? (
                                        <Badge variant="warning">
                                            Dostęp przez zadanie
                                        </Badge>
                                    ) : (
                                        <MemberAvatars count={p.effective_member_count} />
                                    )}

                                    <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-slate-400">
                                        {!p.partial_access && (
                                            <span>
                                                {p.effective_member_count || 0}{' '}
                                                {p.effective_member_count === 1
                                                    ? 'osoba z dostępem'
                                                    : 'osób z dostępem'}
                                            </span>
                                        )}

                                        {Number(p.comment_count || 0) > 0 && (
                                            <span
                                                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800"
                                                title={`Komentarze: ${p.comment_count}`}
                                            >
                                                <MessageSquare className="h-3.5 w-3.5" />
                                                {p.comment_count}
                                            </span>
                                        )}

                                        {Number(p.attachment_count || 0) > 0 && (
                                            <span
                                                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800"
                                                title={`Pliki: ${p.attachment_count}`}
                                            >
                                                <Paperclip className="h-3.5 w-3.5" />
                                                {p.attachment_count}
                                            </span>
                                        )}
                                    </div>
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
