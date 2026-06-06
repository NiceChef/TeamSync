import { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  Plus,
  Search,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';

import { API_URL, fetchWithAuth } from '../api/authFetch';
import { isInternal } from '../constants/roles';
import { useMe } from '../context/auth-context';

export default function Groups({ isAuthenticated }) {
  const me = useMe();

  const [activeTab, setActiveTab] = useState('groups');
  const [groups, setGroups] = useState([]);
  const [organizations, setOrganizations] = useState([]);

  const [selectedOrganizationId, setSelectedOrganizationId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [department, setDepartment] = useState('');

  const [searchDraft, setSearchDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [expandedGroupId, setExpandedGroupId] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);

  const [userSearch, setUserSearch] = useState('');
  const [userHits, setUserHits] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadOrganizations = useCallback(async () => {
    const response = await fetchWithAuth(`${API_URL}/api/organizations`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Nie udało się pobrać organizacji.');
    }

    setOrganizations(Array.isArray(data) ? data : []);

    if (!selectedOrganizationId && Array.isArray(data) && data.length > 0) {
      const ownOrganization = data.find(
        (organization) => organization.id === me?.organization_id,
      );

      setSelectedOrganizationId(
        String(ownOrganization?.id || data[0].id),
      );
    }
  }, [me?.organization_id, selectedOrganizationId]);

  const loadGroups = useCallback(async () => {
    const params = new URLSearchParams();

    if (searchQuery) {
      params.set('q', searchQuery);
    }

    if (isInternal(me) && selectedOrganizationId) {
      params.set('organization_id', selectedOrganizationId);
    }

    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetchWithAuth(`${API_URL}/api/groups${suffix}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Nie udało się pobrać działów.');
    }

    setGroups(Array.isArray(data) ? data : []);
  }, [me, searchQuery, selectedOrganizationId]);

  const refreshData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      await Promise.all([
        loadOrganizations(),
        loadGroups(),
      ]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [loadGroups, loadOrganizations]);

  useEffect(() => {
    if (isAuthenticated && me) {
      refreshData();
    }
  }, [isAuthenticated, me, refreshData]);
  useEffect(() => {
    if (
      isAuthenticated &&
      me &&
      isInternal(me) &&
      selectedOrganizationId
    ) {
      loadGroups().catch((requestError) => {
        setError(requestError.message);
      });
    }
  }, [
    isAuthenticated,
    me,
    selectedOrganizationId,
    loadGroups,
  ]);

  const createGroup = async (event) => {
    event.preventDefault();
    setError('');

    const payload = {
      name: groupName.trim(),
      department: department.trim() || null,
    };

    if (isInternal(me) && selectedOrganizationId) {
      payload.organization_id = Number(selectedOrganizationId);
    }

    try {
      const response = await fetchWithAuth(`${API_URL}/api/groups`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Nie udało się utworzyć działu.');
      }

      setGroupName('');
      setDepartment('');
      await loadGroups();
      await loadOrganizations();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const openGroup = async (group) => {
    if (expandedGroupId === group.id) {
      setExpandedGroupId(null);
      setGroupMembers([]);
      setUserHits([]);
      return;
    }

    setError('');
    setExpandedGroupId(group.id);
    setUserHits([]);
    setUserSearch('');

    try {
      const response = await fetchWithAuth(
        `${API_URL}/api/groups/${group.id}`,
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Nie udało się pobrać działu.');
      }

      setGroupMembers(data.members || []);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const searchUsers = async (group) => {
    if (!userSearch.trim()) {
      setUserHits([]);
      return;
    }

    setError('');

    try {
      const response = await fetchWithAuth(
        `${API_URL}/api/users?q=${encodeURIComponent(userSearch.trim())}`,
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Nie udało się wyszukać użytkowników.');
      }

      const memberIds = new Set(groupMembers.map((member) => member.id));

      setUserHits(
        (Array.isArray(data) ? data : []).filter(
          (user) =>
            user.organization_id === group.organization_id &&
            !memberIds.has(user.id),
        ),
      );
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const addMember = async (groupId, userId) => {
    setError('');

    try {
      const response = await fetchWithAuth(
        `${API_URL}/api/groups/${groupId}/members`,
        {
          method: 'POST',
          body: JSON.stringify({ user_id: userId }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Nie udało się dodać użytkownika.');
      }

      setGroupMembers(data.members || []);
      setUserHits((current) =>
        current.filter((user) => user.id !== userId),
      );
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const removeMember = async (groupId, userId) => {
    setError('');

    try {
      const response = await fetchWithAuth(
        `${API_URL}/api/groups/${groupId}/members/${userId}`,
        { method: 'DELETE' },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Nie udało się usunąć użytkownika.');
      }

      setGroupMembers(data.members || []);
      await loadGroups();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const deleteGroup = async (group) => {
    const confirmed = window.confirm(
      `Czy na pewno chcesz usunąć dział „${group.name}”?`,
    );

    if (!confirmed) return;

    setError('');

    try {
      const response = await fetchWithAuth(
        `${API_URL}/api/groups/${group.id}`,
        { method: 'DELETE' },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Nie udało się usunąć działu.');
      }

      setExpandedGroupId(null);
      setGroupMembers([]);
      await loadGroups();
      await loadOrganizations();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const submitSearch = (event) => {
    event.preventDefault();
    setSearchQuery(searchDraft.trim());
  };

  if (!isAuthenticated || !me) return null;

  const selectedOrganization = organizations.find(
    (organization) =>
      String(organization.id) === String(selectedOrganizationId),
  );

  const organizationTabLabel = isInternal(me)
    ? 'Organizacje'
    : 'Organizacja';

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Działy i organizacje
          </h1>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isInternal(me)
              ? 'Zarządzaj strukturą wszystkich organizacji i ich działami.'
              : 'Zarządzaj członkami oraz działami swojej organizacji.'}
          </p>
        </div>

        {selectedOrganization && (
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
              <Building2 className="h-5 w-5" />
            </span>

            <span>
              <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                Wybrana organizacja
              </span>

              <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                {selectedOrganization.name}
              </span>
            </span>
          </div>
        )}
      </header>

      <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setActiveTab('groups')}
          className={[
            'inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-semibold transition',
            activeTab === 'groups'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
          ].join(' ')}
        >
          <Users className="h-4 w-4" />
          Działy
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('organizations')}
          className={[
            'inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-semibold transition',
            activeTab === 'organizations'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
          ].join(' ')}
        >
          <Building2 className="h-4 w-4" />
          {organizationTabLabel}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {activeTab === 'organizations' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {organizations.map((organization) => (
            <article
              key={organization.id}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <Building2 className="mb-4 h-6 w-6 text-indigo-600" />

              <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                {organization.name}
              </h2>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500">Użytkownicy</p>
                  <p className="font-semibold">{organization.user_count}</p>
                </div>

                <div>
                  <p className="text-slate-500">Działy</p>
                  <p className="font-semibold">{organization.group_count}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {activeTab === 'groups' && (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <aside className="space-y-5">
            <form
              onSubmit={createGroup}
              className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <h2 className="font-semibold">Nowy dział</h2>

              {isInternal(me) && (
                <select
                  value={selectedOrganizationId}
                  onChange={(event) =>
                    setSelectedOrganizationId(event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  required
                >
                  <option value="">Wybierz organizację</option>

                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              )}

              <input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="Nazwa działu"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                required
              />

              <input
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
                placeholder="Opis lub specjalizacja"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              />

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Utwórz dział
              </button>
            </form>

            <form
              onSubmit={submitSearch}
              className="flex gap-2 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <input
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Szukaj działu"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              />

              <button
                type="submit"
                title="Szukaj"
                className="rounded-lg border border-slate-300 p-2 dark:border-slate-700"
              >
                <Search className="h-5 w-5" />
              </button>
            </form>
          </aside>

          <section className="space-y-3">
            {loading && (
              <p className="text-sm text-slate-500">Ładowanie działów...</p>
            )}

            {!loading && groups.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                Brak działów do wyświetlenia.
              </div>
            )}

            {groups.map((group) => (
              <article
                key={group.id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => openGroup(group)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <h3 className="font-semibold">{group.name}</h3>

                    <p className="mt-1 text-sm text-slate-500">
                      {group.organization_name}
                      {group.department ? ` · ${group.department}` : ''}
                    </p>
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">
                      {group.member_count} os.
                    </span>

                    <button
                      type="button"
                      title="Usuń dział"
                      onClick={() => deleteGroup(group)}
                      className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {expandedGroupId === group.id && (
                  <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                    <h4 className="mb-3 text-sm font-semibold">Członkowie</h4>

                    <div className="space-y-2">
                      {groupMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950"
                        >
                          <span className="text-sm">
                            {member.username}
                            <span className="ml-2 text-slate-400">
                              {member.email}
                            </span>
                          </span>

                          <button
                            type="button"
                            title="Usuń z działu"
                            onClick={() => removeMember(group.id, member.id)}
                            className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                          >
                            <UserMinus className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex gap-2">
                      <input
                        value={userSearch}
                        onChange={(event) => setUserSearch(event.target.value)}
                        placeholder="Szukaj użytkownika"
                        className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                      />

                      <button
                        type="button"
                        onClick={() => searchUsers(group)}
                        className="rounded-lg border border-slate-300 px-4 py-2 dark:border-slate-700"
                      >
                        Szukaj
                      </button>
                    </div>

                    {userHits.map((user) => (
                      <div
                        key={user.id}
                        className="mt-2 flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
                      >
                        <span className="text-sm">
                          {user.username} · {user.email}
                        </span>

                        <button
                          type="button"
                          title="Dodaj do działu"
                          onClick={() => addMember(group.id, user.id)}
                          className="rounded-lg bg-indigo-600 p-2 text-white hover:bg-indigo-700"
                        >
                          <UserPlus className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}