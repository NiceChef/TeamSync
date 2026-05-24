import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, FolderKanban, Search, UserRound, Users, X } from 'lucide-react';
import { globalSearch } from '../../api/search';

const GROUPS = [
    { key: 'tasks', label: 'Zadania', icon: CheckSquare },
    { key: 'projects', label: 'Projekty', icon: FolderKanban },
    { key: 'users', label: 'Użytkownicy', icon: UserRound },
    { key: 'groups', label: 'Grupy', icon: Users },
];

const EMPTY = { tasks: [], projects: [], users: [], groups: [] };

export default function GlobalSearch() {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    // Trzymamy wyniki razem z zapytaniem, dla którego powstały — dzięki temu
    // „loading" i czyszczenie wyliczamy podczas renderu zamiast setState w efekcie.
    const [results, setResults] = useState({ q: '', data: EMPTY });
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        const onKey = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
                setOpen(true);
            }
            if (e.key === 'Escape') {
                setOpen(false);
                inputRef.current?.blur();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

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

    useEffect(() => {
        const q = query.trim();
        if (!q) return undefined;
        const handle = setTimeout(async () => {
            const data = await globalSearch(q);
            setResults({ q, data });
        }, 250);
        return () => clearTimeout(handle);
    }, [query]);

    const q = query.trim();
    const fresh = results.q === q;
    const data = fresh ? results.data : EMPTY;
    const loading = Boolean(q) && !fresh;
    const total =
        data.tasks.length +
        data.projects.length +
        data.users.length +
        data.groups.length;

    const go = useCallback(
        (path) => {
            setOpen(false);
            setQuery('');
            navigate(path);
        },
        [navigate],
    );

    const renderItem = (groupKey, item) => {
        switch (groupKey) {
            case 'tasks':
                return (
                    <button
                        key={`t-${item.id}`}
                        type="button"
                        onClick={() => go(`/tasks/${item.id}`)}
                        className="block w-full truncate px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        {item.topic}
                    </button>
                );
            case 'projects':
                return (
                    <button
                        key={`p-${item.id}`}
                        type="button"
                        onClick={() => go(`/projects/${item.id}`)}
                        className="block w-full truncate px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        {item.name}
                    </button>
                );
            case 'groups':
                return (
                    <button
                        key={`g-${item.id}`}
                        type="button"
                        onClick={() => go('/groups')}
                        className="block w-full truncate px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        {item.name}
                    </button>
                );
            case 'users':
                return (
                    <div
                        key={`u-${item.id}`}
                        className="truncate px-3 py-2 text-sm text-slate-600 dark:text-slate-300"
                    >
                        {item.username}{' '}
                        <span className="text-slate-400">({item.email})</span>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div ref={containerRef} className="relative w-full max-w-md">
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                    ref={inputRef}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setOpen(true)}
                    placeholder="Szukaj zadań, projektów, osób... (Ctrl+K)"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-8 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                {query && (
                    <button
                        type="button"
                        onClick={() => {
                            setQuery('');
                            inputRef.current?.focus();
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        aria-label="Wyczyść"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {open && query.trim() && (
                <div className="absolute left-0 right-0 top-12 z-50 max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
                    {loading ? (
                        <p className="px-4 py-6 text-center text-sm text-slate-400">Szukam…</p>
                    ) : total === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-slate-400">
                            Brak wyników dla „{query.trim()}”.
                        </p>
                    ) : (
                        GROUPS.map(({ key, label, icon: Icon }) => {
                            const items = data[key];
                            if (!items.length) return null;
                            return (
                                <div key={key} className="border-b border-slate-100 py-1 last:border-0 dark:border-slate-800">
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        <Icon className="h-3.5 w-3.5" />
                                        {label}
                                    </div>
                                    {items.map((item) => renderItem(key, item))}
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
