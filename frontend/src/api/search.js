import { API_URL, fetchWithAuth } from './authFetch';

async function safeGet(url) {
    try {
        const res = await fetchWithAuth(url);
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

// Wyszukiwanie globalne — agreguje 4 endpointy z parametrem ?q=.
// Backend sam zawęża wyniki po roli (np. client nie dostaje użytkowników/grup).
export async function globalSearch(query, { perGroup = 5 } = {}) {
    const q = query.trim();
    if (!q) {
        return { tasks: [], projects: [], users: [], groups: [] };
    }
    const enc = encodeURIComponent(q);
    const [tasks, projects, users, groups] = await Promise.all([
        safeGet(`${API_URL}/api/tasks?q=${enc}`),
        safeGet(`${API_URL}/api/projects?q=${enc}`),
        safeGet(`${API_URL}/api/users?q=${enc}`),
        safeGet(`${API_URL}/api/groups?q=${enc}`),
    ]);
    return {
        tasks: tasks.slice(0, perGroup),
        projects: projects.slice(0, perGroup),
        users: users.slice(0, perGroup),
        groups: groups.slice(0, perGroup),
    };
}
