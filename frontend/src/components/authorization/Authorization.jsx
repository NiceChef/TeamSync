import { useEffect, useMemo, useState } from 'react';
import {
    Check,
    Plus,
    RefreshCw,
    Search,
    ShieldCheck,
    Undo2,
    UserCheck,
    X,
} from 'lucide-react';
import {
    approveUser,
    createOrganization,
    fetchAuthorizationUsers,
    fetchOrganizations,
    markUserPending,
    rejectUser,
    updateUserOrganization,
} from '../../api/authorization';
import { useMe } from '../../context/auth-context';

const ROLE_OPTIONS = [
    { value: 'client', label: 'Klient' },
    { value: 'internal', label: 'TeamSync' },
];

const TABS = [
    { id: 'pending', label: 'Do autoryzacji' },
    { id: 'approved', label: 'Autoryzowani' },
    { id: 'rejected', label: 'Odrzuceni' },
];

function isInternal(user) {
    return user?.role === 'internal' && user?.approval_status === 'approved';
}

function roleLabel(role) {
    return ROLE_OPTIONS.find((item) => item.value === role)?.label || role || '-';
}

function formatDate(value) {
    if (!value) return '-';

    return new Intl.DateTimeFormat('pl-PL', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(new Date(value));
}

function getOrganizationName(user, organizations) {
    const org = organizations.find((item) => item.id === user.organization_id);
    return org?.name || '-';
}

function normalizeOrgName(value) {
    return String(value || '').trim().toUpperCase();
}

function findOrganizationByName(organizations, name) {
    const normalized = normalizeOrgName(name);
    if (!normalized) return null;

    return organizations.find((org) => normalizeOrgName(org.name) === normalized) || null;
}

function getInitialSelection(user, organizations = []) {
    const role = user.role === 'internal' ? 'internal' : 'client';

    if (user.organization_id) {
        return {
            role,
            organization_id: String(user.organization_id),
        };
    }

    const suggestedOrg = findOrganizationByName(organizations, user.suggested_organization_name);

    return {
        role,
        organization_id: role === 'client' && suggestedOrg ? String(suggestedOrg.id) : '',
    };
}

export default function Authorization({ isAuthenticated }) {
    const me = useMe();

    const [activeTab, setActiveTab] = useState('pending');
    const [users, setUsers] = useState([]);
    const [organizations, setOrganizations] = useState([]);
    const [newOrgName, setNewOrgName] = useState('');
    const [selection, setSelection] = useState({});
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState(null);
    const [error, setError] = useState('');

    const canView = isAuthenticated && isInternal(me);

    const visibleUsers = useMemo(() => {
        const phrase = search.trim().toLowerCase();

        if (!phrase) return users;

        return users.filter((user) => {
            const orgName = getOrganizationName(user, organizations).toLowerCase();

            return [
                user.username,
                user.email,
                user.role,
                user.approval_status,
                orgName,
            ]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(phrase));
        });
    }, [users, organizations, search]);

    const load = async () => {
        if (!canView) return;

        setError('');
        setLoading(true);

        try {
            const [usersData, orgsData] = await Promise.all([
                fetchAuthorizationUsers(activeTab),
                fetchOrganizations(),
            ]);

            const nextUsers = Array.isArray(usersData) ? usersData : [];
            const nextOrganizations = Array.isArray(orgsData) ? orgsData : [];

            setUsers(nextUsers);
            setOrganizations(nextOrganizations);

            const nextSelection = {};
            nextUsers.forEach((user) => {
                nextSelection[user.id] = getInitialSelection(user, nextOrganizations);
            });
            setSelection(nextSelection);
        } catch (err) {
            setError(err.message || 'Nie udalo sie pobrac danych autoryzacji.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canView, activeTab]);

    const getUserSelection = (user) => {
        return selection[user.id] || getInitialSelection(user);
    };

    const setUserSelection = (userId, patch) => {
        setSelection((prev) => ({
            ...prev,
            [userId]: {
                ...(prev[userId] || {}),
                ...patch,
            },
        }));
    };

    const handleCreateOrganization = async (e) => {
        e.preventDefault();

        const name = newOrgName.trim();
        if (!name) return;

        setError('');

        try {
            const org = await createOrganization(name);
            setOrganizations((prev) => [...prev, org].sort((a, b) => a.name.localeCompare(b.name)));
            setNewOrgName('');
        } catch (err) {
            setError(err.message || 'Nie udalo sie utworzyc organizacji.');
        }
    };

    const handleCreateSuggestedOrganization = async (user) => {
        const suggestedName = normalizeOrgName(user.suggested_organization_name);
        if (!suggestedName) return;

        setSavingId(user.id);
        setError('');

        try {
            const existingOrg = findOrganizationByName(organizations, suggestedName);

            if (existingOrg) {
                setUserSelection(user.id, { organization_id: String(existingOrg.id) });
                return;
            }

            const org = await createOrganization(suggestedName);
            const nextOrganizations = [...organizations, org].sort((a, b) => a.name.localeCompare(b.name));

            setOrganizations(nextOrganizations);
            setUserSelection(user.id, { organization_id: String(org.id) });
        } catch (err) {
            setError(err.message || 'Nie udalo sie utworzyc organizacji z propozycji.');
        } finally {
            setSavingId(null);
        }
    };

    const handleApprove = async (user) => {
        const current = getUserSelection(user);

        if (current.role === 'client' && !current.organization_id) {
            setError('Dla klienta wybierz organizacje.');
            return;
        }

        setSavingId(user.id);
        setError('');

        try {
            await approveUser(user.id, {
                role: current.role,
                organization_id: current.role === 'client' ? Number(current.organization_id) : null,
            });
            setUsers((prev) => prev.filter((item) => item.id !== user.id));
        } catch (err) {
            setError(err.message || 'Nie udalo sie zatwierdzic uzytkownika.');
        } finally {
            setSavingId(null);
        }
    };

    const handleReject = async (user) => {
        if (!window.confirm(`Odrzucic uzytkownika ${user.username}?`)) return;

        setSavingId(user.id);
        setError('');

        try {
            await rejectUser(user.id);
            setUsers((prev) => prev.filter((item) => item.id !== user.id));
        } catch (err) {
            setError(err.message || 'Nie udalo sie odrzucic uzytkownika.');
        } finally {
            setSavingId(null);
        }
    };

    const handleSaveUser = async (user) => {
        const current = getUserSelection(user);

        if (current.role === 'client' && !current.organization_id) {
            setError('Dla klienta wybierz organizacje.');
            return;
        }

        setSavingId(user.id);
        setError('');

        try {
            const updated = await updateUserOrganization(user.id, {
                role: current.role,
                organization_id: current.role === 'client' ? Number(current.organization_id) : null,
            });

            setUsers((prev) => prev.map((item) => (item.id === user.id ? updated : item)));
        } catch (err) {
            setError(err.message || 'Nie udalo sie zapisac uzytkownika.');
        } finally {
            setSavingId(null);
        }
    };

    const handleMoveToPending = async (user) => {
        if (!window.confirm(`Przeniesc uzytkownika ${user.username} do oczekujacych?`)) return;

        setSavingId(user.id);
        setError('');

        try {
            await markUserPending(user.id);
            setUsers((prev) => prev.filter((item) => item.id !== user.id));
        } catch (err) {
            setError(err.message || 'Nie udalo sie przeniesc uzytkownika do oczekujacych.');
        } finally {
            setSavingId(null);
        }
    };

    if (!isAuthenticated) return null;

    if (!canView) {
        return (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                Nie masz dostepu do autoryzacji uzytkownikow.
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-7xl space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                        Autoryzacje
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Zatwierdzaj nowych uzytkownikow i zarzadzaj przypisaniem do organizacji.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={load}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                    <RefreshCw className="h-4 w-4" />
                    Odswiez
                </button>
            </div>

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {error}
                </div>
            )}

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 flex items-center gap-2">
                    <Plus className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                        Organizacje
                    </h3>
                </div>

                <form onSubmit={handleCreateOrganization} className="flex flex-col gap-2 sm:flex-row">
                    <input
                        value={newOrgName}
                        onChange={(e) => setNewOrgName(e.target.value)}
                        placeholder="Nazwa organizacji"
                        className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                    <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                    >
                        <Plus className="h-4 w-4" />
                        Dodaj organizacje
                    </button>
                </form>

                <div className="mt-4 flex flex-wrap gap-2">
                    {organizations.map((org) => (
                        <span
                            key={org.id}
                            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                        >
                            {org.name} ({org.user_count})
                        </span>
                    ))}
                </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap gap-2">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${activeTab === tab.id
                                    ? 'bg-indigo-600 text-white'
                                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <label className="relative block w-full lg:w-80">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Szukaj uzytkownika, emaila, organizacji..."
                            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        />
                    </label>
                </div>

                {loading ? (
                    <div className="p-6 text-sm text-slate-500">Ladowanie...</div>
                ) : visibleUsers.length === 0 ? (
                    <div className="p-6 text-sm text-slate-500">
                        Brak uzytkownikow w tej zakladce.
                    </div>
                ) : (
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                        {visibleUsers.map((user) => {
                            const current = getUserSelection(user);
                            const selectedOrg = getOrganizationName(user, organizations);
                            const suggestedOrgName = normalizeOrgName(user.suggested_organization_name);
                            const suggestedOrgExists = findOrganizationByName(organizations, suggestedOrgName);

                            return (
                                <div
                                    key={user.id}
                                    className="grid gap-4 p-5 xl:grid-cols-[minmax(220px,1.4fr)_150px_240px_170px_auto] xl:items-center"
                                >
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                                                {user.username}
                                            </p>
                                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                {roleLabel(user.role)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            {user.email}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-400">
                                            Utworzono: {formatDate(user.created_at)}
                                        </p>
                                        {suggestedOrgName && current.role === 'client' && (
                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                <span className="text-xs font-medium text-indigo-600 dark:text-indigo-300">
                                                    Propozycja organizacji: {suggestedOrgName}
                                                    {suggestedOrgExists ? ' (znaleziona)' : ' (nowa)'}
                                                </span>

                                                {!suggestedOrgExists && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCreateSuggestedOrganization(user)}
                                                        disabled={savingId === user.id}
                                                        className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300"
                                                    >
                                                        <Plus className="h-3 w-3" />
                                                        Utworz
                                                    </button>
                                                )}

                                                {suggestedOrgExists && !current.organization_id && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setUserSelection(user.id, { organization_id: String(suggestedOrgExists.id) })}
                                                        className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                                                    >
                                                        <Check className="h-3 w-3" />
                                                        Wybierz
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <label className="block">
                                        <span className="mb-1 block text-xs font-semibold text-slate-500">
                                            Rola
                                        </span>
                                        <select
                                            value={current.role}
                                            onChange={(e) => setUserSelection(user.id, { role: e.target.value })}
                                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                        >
                                            {ROLE_OPTIONS.map((role) => (
                                                <option key={role.value} value={role.value}>
                                                    {role.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className="block">
                                        <span className="mb-1 block text-xs font-semibold text-slate-500">
                                            Organizacja
                                        </span>
                                        <select
                                            value={current.organization_id}
                                            onChange={(e) => setUserSelection(user.id, { organization_id: e.target.value })}
                                            disabled={current.role === 'internal'}
                                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                        >
                                            <option value="">
                                                {current.role === 'internal' ? 'TEAMSYNC' : 'Wybierz organizacje'}
                                            </option>
                                            {organizations.map((org) => (
                                                <option key={org.id} value={org.id}>
                                                    {org.name}
                                                </option>
                                            ))}
                                        </select>
                                        <span className="mt-1 block text-xs text-slate-400">
                                            Aktualnie: {selectedOrg}
                                        </span>
                                    </label>

                                    <div>
                                        <span className="mb-1 block text-xs font-semibold text-slate-500">
                                            Status
                                        </span>
                                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                            {user.approval_status}
                                        </span>
                                        <p className="mt-1 text-xs text-slate-400">
                                            Zatwierdzono: {formatDate(user.approved_at)}
                                        </p>
                                    </div>

                                    {activeTab === 'pending' && (
                                        <div className="flex flex-wrap gap-2 xl:justify-end">
                                            <button
                                                type="button"
                                                onClick={() => handleApprove(user)}
                                                disabled={savingId === user.id}
                                                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                            >
                                                <Check className="h-4 w-4" />
                                                Zatwierdz
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleReject(user)}
                                                disabled={savingId === user.id}
                                                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                                            >
                                                <X className="h-4 w-4" />
                                                Odrzuc
                                            </button>
                                        </div>
                                    )}

                                    {activeTab === 'approved' && (
                                        <div className="flex flex-wrap gap-2 xl:justify-end">
                                            <button
                                                type="button"
                                                onClick={() => handleSaveUser(user)}
                                                disabled={savingId === user.id}
                                                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                                            >
                                                <UserCheck className="h-4 w-4" />
                                                Zapisz
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleMoveToPending(user)}
                                                disabled={savingId === user.id}
                                                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                            >
                                                <Undo2 className="h-4 w-4" />
                                                Do autoryzacji
                                            </button>
                                        </div>
                                    )}

                                    {activeTab === 'rejected' && (
                                        <div className="flex flex-wrap gap-2 xl:justify-end">
                                            <button
                                                type="button"
                                                onClick={() => handleMoveToPending(user)}
                                                disabled={savingId === user.id}
                                                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                                            >
                                                <Undo2 className="h-4 w-4" />
                                                Przywroc
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}