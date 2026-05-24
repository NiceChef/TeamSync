import { useState, useEffect } from 'react';
import { Building2, Plus, Search, ShieldAlert, UserPlus, Users } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Groups({ isAuthenticated }) {
  const [groups, setGroups] = useState([]);
  const [q, setQ] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [members, setMembers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userHits, setUserHits] = useState([]);
  const [error, setError] = useState('');
  const [me, setMe] = useState(null);

  const token = () => localStorage.getItem('access_token');

  const loadGroups = async () => {
    setError('');
    try {
      const url = q.trim()
        ? `${API_URL}/api/groups?q=${encodeURIComponent(q.trim())}`
        : `${API_URL}/api/groups`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Błąd');
      setGroups(Array.isArray(d) ? d : []);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      const r = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (r.ok) setMe(await r.json());
    })();
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && me && me.role !== 'client') loadGroups();
  }, [isAuthenticated, me, q]);

  const createGroup = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const r = await fetch(`${API_URL}/api/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ name, department }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Błąd');
      setName('');
      setDepartment('');
      await loadGroups();
    } catch (e) {
      setError(e.message);
    }
  };

  const openGroup = async (g) => {
    setExpanded(g.id);
    setError('');
    try {
      const r = await fetch(`${API_URL}/api/groups/${g.id}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Błąd');
      setMembers(d.members || []);
    } catch (e) {
      setError(e.message);
    }
  };

  const searchUsers = async () => {
    if (!userSearch.trim()) {
      setUserHits([]);
      return;
    }
    const r = await fetch(`${API_URL}/api/users?q=${encodeURIComponent(userSearch.trim())}`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (r.ok) setUserHits(await r.json());
  };

  const addMember = async (gid, userId) => {
    const r = await fetch(`${API_URL}/api/groups/${gid}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify({ user_id: userId }),
    });
    if (r.ok) await openGroup({ id: gid });
  };

  if (!isAuthenticated) return null;
  if (me?.role === 'client') {
    return (
      <div className="mx-auto w-full max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">Brak dostępu do grup</h2>
            <p className="mt-1 text-sm">
              Grupy są dostępne dla kont pracowniczych.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <h2 className="bg-gradient-to-r from-indigo-600 to-purple-700 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
          Grupy i zespoły
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Twórz zespoły, przeglądaj członków i przypisuj użytkowników do grup.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <section className="space-y-6">
          <form
            onSubmit={createGroup}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Nowa grupa
              </h3>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Nazwa
              </span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Dział opcjonalnie
              </span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </label>

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:shadow-md"
            >
              <Plus className="h-4 w-4" />
              Utwórz grupę
            </button>
          </form>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2">
              <Search className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Szukaj
              </h3>
            </div>

            <input
              type="search"
              placeholder="Szukaj grupy..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </section>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Lista grup
              </h3>
            </div>

            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200">
              {groups.length} grup
            </span>
          </div>

          {groups.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Brak grup do wyświetlenia.
            </div>
          ) : (
            <ul className="space-y-3">
              {groups.map((g) => (
                <li
                  key={g.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10"
                >
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 text-left"
                    onClick={() => openGroup(g)}
                  >
                    <span>
                      <span className="block font-semibold text-slate-900 dark:text-slate-100">
                        {g.name}
                      </span>

                      <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">
                        {g.department || 'Brak działu'}
                      </span>
                    </span>

                    {g.member_count != null && (
                      <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                        {g.member_count} os.
                      </span>
                    )}
                  </button>

                  {expanded === g.id && (
                    <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                      <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Członkowie
                      </p>

                      {members.length === 0 ? (
                        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
                          Ta grupa nie ma jeszcze członków.
                        </p>
                      ) : (
                        <ul className="mb-4 space-y-2">
                          {members.map((u) => (
                            <li
                              key={u.id}
                              className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200"
                            >
                              {u.username} <span className="text-slate-400">({u.email})</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="search"
                          placeholder="Szukaj użytkownika..."
                          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                        />

                        <button
                          type="button"
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                          onClick={searchUsers}
                        >
                          <Search className="h-4 w-4" />
                          Szukaj
                        </button>
                      </div>

                      {userHits.length > 0 && (
                        <ul className="mt-3 space-y-2">
                          {userHits.map((u) => (
                            <li
                              key={u.id}
                              className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm dark:bg-slate-900"
                            >
                              <span className="min-w-0 truncate text-slate-700 dark:text-slate-200">
                                {u.username} - {u.email}
                              </span>

                              <button
                                type="button"
                                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
                                onClick={() => addMember(g.id, u.id)}
                              >
                                <UserPlus className="h-3.5 w-3.5" />
                                Dodaj
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
