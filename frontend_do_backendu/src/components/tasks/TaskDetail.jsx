import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
    ArrowLeft,
    CalendarClock,
    CalendarRange,
    CheckCircle2,
    Circle,
    Download,
    FileText,
    FolderKanban,
    GitBranch,
    History,
    MessageSquare,
    Paperclip,
    Pencil,
    Send,
    Trash2,
    UserRound,
    Users,
} from 'lucide-react';
import {
    getTask,
    listComments,
    addComment,
    listActivities,
    listAttachments,
    uploadAttachment,
    deleteAttachment,
    downloadAttachment,
    listRelations,
} from '../../api/tasks';
import { getProject } from '../../api/projects';
import Badge from '../ui/Badge';
import Button from '../ui/Button';

const PRIORITY_META = {
    high: { label: 'Wysoki', variant: 'danger' },
    medium: { label: 'Średni', variant: 'warning' },
    low: { label: 'Niski', variant: 'default' },
};

function formatDate(value) {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleDateString('pl-PL', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    } catch {
        return value;
    }
}

function formatDateTime(value) {
    if (!value) return '';
    try {
        return new Date(value).toLocaleString('pl-PL', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return value;
    }
}

const ACTION_LABELS = {
    create: 'utworzył(a) zadanie',
    update: 'zaktualizował(a) zadanie',
    status: 'zmienił(a) status',
    comment: 'dodał(a) komentarz',
    attachment_upload: 'dodał(a) załącznik',
};

function MetaItem({ icon: Icon, label, children }) {
    return (
        <div className="flex items-start gap-2.5">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
                <div className="text-sm text-slate-700 dark:text-slate-200">{children}</div>
            </div>
        </div>
    );
}

function SectionCard({ icon: Icon, title, count, children }) {
    return (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2">
                <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
                {count != null && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                        {count}
                    </span>
                )}
            </div>
            {children}
        </section>
    );
}

function RelationLink({ task }) {
    if (!task) return null;
    return (
        <Link
            to={`/tasks/${task.id}`}
            className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm transition hover:bg-indigo-50 dark:bg-slate-950 dark:hover:bg-indigo-500/10"
        >
            <span className="flex min-w-0 items-center gap-2">
                {task.completed ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                    <Circle className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
                )}
                <span
                    className={[
                        'min-w-0 truncate',
                        task.completed
                            ? 'text-slate-400 line-through'
                            : 'text-slate-700 dark:text-slate-200',
                    ].join(' ')}
                >
                    {task.topic}
                </span>
            </span>
        </Link>
    );
}

export default function TaskDetail({ isAuthenticated }) {
    const { id } = useParams();
    const navigate = useNavigate();

    const [task, setTask] = useState(null);
    const [projectName, setProjectName] = useState(null);
    const [comments, setComments] = useState([]);
    const [activities, setActivities] = useState([]);
    const [attachments, setAttachments] = useState([]);
    const [relations, setRelations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [commentBody, setCommentBody] = useState('');
    const [posting, setPosting] = useState(false);
    const [uploading, setUploading] = useState(false);

    const loadSecondary = async () => {
        const [c, a, at, rel] = await Promise.allSettled([
            listComments(id),
            listActivities(id),
            listAttachments(id),
            listRelations(id),
        ]);
        if (c.status === 'fulfilled') setComments(c.value);
        if (a.status === 'fulfilled') setActivities(a.value);
        if (at.status === 'fulfilled') setAttachments(at.value);
        if (rel.status === 'fulfilled') setRelations(rel.value);
    };

    useEffect(() => {
        if (!isAuthenticated) return;
        let active = true;
        setLoading(true);
        setError('');
        (async () => {
            try {
                const t = await getTask(id, { includeRelations: true });
                if (!active) return;
                setTask(t);
                if (t.project_id) {
                    getProject(t.project_id)
                        .then((p) => active && setProjectName(p.name))
                        .catch(() => {});
                } else {
                    setProjectName(null);
                }
                await loadSecondary();
            } catch (err) {
                if (active) setError(err.message);
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => {
            active = false;
        };
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

    if (error || !task) {
        return (
            <div className="mx-auto w-full max-w-5xl space-y-4">
                <Button variant="ghost" onClick={() => navigate('/tasks')}>
                    <ArrowLeft className="h-4 w-4" />
                    Wróć do zadań
                </Button>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
                    {error || 'Nie znaleziono zadania.'}
                </div>
            </div>
        );
    }

    const prio = PRIORITY_META[task.priority] || PRIORITY_META.medium;
    const subtasks = relations
        .filter((r) => r.source_task_id === task.id)
        .map((r) => r.target_task)
        .filter(Boolean);
    const parents = relations
        .filter((r) => r.target_task_id === task.id)
        .map((r) => r.source_task)
        .filter(Boolean);

    const handleAddComment = async (e) => {
        e.preventDefault();
        const body = commentBody.trim();
        if (!body) return;
        setPosting(true);
        setError('');
        try {
            await addComment(id, body);
            setCommentBody('');
            await loadSecondary();
        } catch (err) {
            setError(err.message);
        } finally {
            setPosting(false);
        }
    };

    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setUploading(true);
        setError('');
        try {
            await uploadAttachment(id, file);
            await loadSecondary();
        } catch (err) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteAttachment = async (attId) => {
        if (!window.confirm('Usunąć ten załącznik?')) return;
        setError('');
        try {
            await deleteAttachment(attId);
            setAttachments((prev) => prev.filter((a) => a.id !== attId));
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDownload = async (att) => {
        try {
            await downloadAttachment(att);
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="mx-auto w-full max-w-5xl space-y-6">
            <Button variant="ghost" onClick={() => navigate('/tasks')}>
                <ArrowLeft className="h-4 w-4" />
                Zadania
            </Button>

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
                    {error}
                </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            {task.completed ? (
                                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
                            ) : (
                                <Circle className="h-6 w-6 shrink-0 text-slate-300 dark:text-slate-600" />
                            )}
                            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                                {task.topic}
                            </h2>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Badge variant={task.completed ? 'success' : 'warning'}>
                                {task.completed ? 'Zrobione' : 'Otwarte'}
                            </Badge>
                            {task.status?.label && <Badge variant="primary">{task.status.label}</Badge>}
                            <Badge variant={prio.variant}>Priorytet: {prio.label}</Badge>
                            {(task.categories || []).map((cat) => (
                                <span
                                    key={cat.id}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                >
                                    <span
                                        className="h-2.5 w-2.5 rounded-full"
                                        style={{ backgroundColor: cat.color || '#6366f1' }}
                                    />
                                    {cat.name}
                                </span>
                            ))}
                        </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => navigate(`/tasks/${task.id}/edit`)}>
                        <Pencil className="h-4 w-4" />
                        Edytuj
                    </Button>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <MetaItem icon={CalendarRange} label="Plan">
                        {formatDate(task.planned_date)}
                    </MetaItem>
                    <MetaItem icon={CalendarClock} label="Deadline">
                        {formatDate(task.deadline)}
                    </MetaItem>
                    <MetaItem icon={UserRound} label="Przypisany">
                        {task.assignee?.username || '—'}
                    </MetaItem>
                    <MetaItem icon={Users} label="Grupa">
                        {task.group?.name || '—'}
                    </MetaItem>
                    <MetaItem icon={FolderKanban} label="Projekt">
                        {task.project_id ? (
                            <Link
                                to={`/projects/${task.project_id}`}
                                className="text-indigo-600 hover:underline dark:text-indigo-300"
                            >
                                {projectName || `Projekt #${task.project_id}`}
                            </Link>
                        ) : (
                            '—'
                        )}
                    </MetaItem>
                    <MetaItem icon={History} label="Utworzono">
                        {formatDate(task.created_at)}
                    </MetaItem>
                </div>
            </div>

            {task.notes && task.notes.trim() && (
                <SectionCard icon={FileText} title="Notatki">
                    <div
                        className="text-sm leading-relaxed text-slate-700 dark:text-slate-200 [&_a]:text-indigo-600 [&_a]:underline [&_img]:my-2 [&_img]:max-h-80 [&_img]:max-w-full [&_img]:rounded"
                        dangerouslySetInnerHTML={{ __html: task.notes }}
                    />
                </SectionCard>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
                <SectionCard icon={GitBranch} title="Zadanie nadrzędne" count={parents.length}>
                    {parents.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">Brak zadania nadrzędnego.</p>
                    ) : (
                        <div className="space-y-2">
                            {parents.map((t) => (
                                <RelationLink key={t.id} task={t} />
                            ))}
                        </div>
                    )}
                </SectionCard>

                <SectionCard icon={GitBranch} title="Podzadania" count={subtasks.length}>
                    {subtasks.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">Brak podzadań.</p>
                    ) : (
                        <div className="space-y-2">
                            {subtasks.map((t) => (
                                <RelationLink key={t.id} task={t} />
                            ))}
                        </div>
                    )}
                </SectionCard>
            </div>

            <SectionCard icon={MessageSquare} title="Komentarze" count={comments.length}>
                {comments.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Brak komentarzy.</p>
                ) : (
                    <ul className="space-y-3">
                        {comments.map((c) => (
                            <li
                                key={c.id}
                                className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                        {c.author_username || 'Użytkownik'}
                                    </span>
                                    <span className="text-xs text-slate-400">{formatDateTime(c.created_at)}</span>
                                </div>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                                    {c.body}
                                </p>
                            </li>
                        ))}
                    </ul>
                )}

                <form onSubmit={handleAddComment} className="mt-4 flex gap-2">
                    <input
                        type="text"
                        value={commentBody}
                        onChange={(e) => setCommentBody(e.target.value)}
                        placeholder="Napisz komentarz..."
                        className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                    <Button type="submit" variant="primary" disabled={posting || !commentBody.trim()}>
                        <Send className="h-4 w-4" />
                        {posting ? 'Wysyłanie...' : 'Dodaj'}
                    </Button>
                </form>
            </SectionCard>

            <SectionCard icon={Paperclip} title="Załączniki" count={attachments.length}>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                    <Paperclip className="h-4 w-4" />
                    {uploading ? 'Wysyłanie...' : 'Dodaj plik'}
                    <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>

                {attachments.length > 0 && (
                    <ul className="mt-3 space-y-2">
                        {attachments.map((at) => (
                            <li
                                key={at.id}
                                className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950"
                            >
                                <button
                                    type="button"
                                    onClick={() => handleDownload(at)}
                                    className="flex min-w-0 items-center gap-2 text-left text-sm text-indigo-600 hover:underline dark:text-indigo-300"
                                >
                                    <Download className="h-4 w-4 shrink-0" />
                                    <span className="min-w-0 truncate">{at.original_name}</span>
                                    <span className="shrink-0 text-xs text-slate-400">
                                        {Math.round((at.size_bytes || 0) / 1024)} KB
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDeleteAttachment(at.id)}
                                    title="Usuń załącznik"
                                    className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </SectionCard>

            <SectionCard icon={History} title="Historia aktywności" count={activities.length}>
                {activities.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Brak zarejestrowanej aktywności.</p>
                ) : (
                    <ul className="space-y-2">
                        {activities.map((a) => (
                            <li key={a.id} className="flex items-start gap-3 text-sm">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                                <span className="text-slate-600 dark:text-slate-300">
                                    <span className="font-medium text-slate-800 dark:text-slate-100">
                                        {a.username || 'Użytkownik'}
                                    </span>{' '}
                                    {ACTION_LABELS[a.action] || a.action}
                                    <span className="ml-1 text-xs text-slate-400">
                                        · {formatDateTime(a.created_at)}
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </SectionCard>
        </div>
    );
}
