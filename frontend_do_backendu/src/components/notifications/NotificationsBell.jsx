import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bell,
    CheckCheck,
    CheckSquare,
    MessageSquare,
    RefreshCw,
} from 'lucide-react';
import { listNotifications, markRead, markAllRead } from '../../api/notifications';

const KIND_ICON = {
    comment: MessageSquare,
    status: RefreshCw,
    task: CheckSquare,
};

function timeAgo(value) {
    if (!value) return '';
    const date = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`);
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return 'przed chwilą';
    if (diff < 3600) return `${Math.floor(diff / 60)} min temu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} godz. temu`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} dni temu`;
    return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

export default function NotificationsBell() {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    const unread = items.filter((n) => !n.read).length;

    const load = useCallback(async () => {
        try {
            setItems(await listNotifications());
        } catch {
            /* cicho — powiadomienia są nieblokujące */
        }
    }, []);

    useEffect(() => {
        load();
        const interval = setInterval(load, 60000);
        return () => clearInterval(interval);
    }, [load]);

    useEffect(() => {
        if (!open) return undefined;
        const onClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, [open]);

    const handleItemClick = async (n) => {
        if (!n.read) {
            setItems((curr) => curr.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
            markRead(n.id).catch(() => load());
        }
        if (n.task_id) {
            setOpen(false);
            navigate(`/tasks/${n.task_id}`);
        }
    };

    const handleMarkAll = async () => {
        if (unread === 0) return;
        const snapshot = items;
        setItems((curr) => curr.map((x) => ({ ...x, read: true })));
        try {
            await markAllRead(snapshot);
        } catch {
            load();
        }
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                aria-label="Powiadomienia"
                title="Powiadomienia"
            >
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-12 z-50 w-80 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            Powiadomienia
                        </h3>
                        {unread > 0 && (
                            <button
                                type="button"
                                onClick={handleMarkAll}
                                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-300"
                            >
                                <CheckCheck className="h-3.5 w-3.5" />
                                Oznacz wszystkie
                            </button>
                        )}
                    </div>

                    <div className="max-h-96 overflow-auto">
                        {items.length === 0 ? (
                            <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                                Brak powiadomień.
                            </p>
                        ) : (
                            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                {items.map((n) => {
                                    const Icon = KIND_ICON[n.kind] || Bell;
                                    return (
                                        <li key={n.id}>
                                            <button
                                                type="button"
                                                onClick={() => handleItemClick(n)}
                                                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                                                    n.read ? '' : 'bg-indigo-50/50 dark:bg-indigo-500/5'
                                                }`}
                                            >
                                                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                                    <Icon className="h-3.5 w-3.5" />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-sm text-slate-700 dark:text-slate-200">
                                                        {n.message}
                                                    </span>
                                                    <span className="mt-0.5 block text-xs text-slate-400">
                                                        {timeAgo(n.created_at)}
                                                    </span>
                                                </span>
                                                {!n.read && (
                                                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                                                )}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
