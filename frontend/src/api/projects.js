import { API_URL, fetchWithAuth } from './authFetch';

async function asJson(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || 'Wystąpił błąd');
    }
    return data;
}

export async function listProjects({ q = '', status = '' } = {}) {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (status) params.set('status', status);
    const query = params.toString();
    const r = await fetchWithAuth(`${API_URL}/api/projects${query ? `?${query}` : ''}`);
    return asJson(r);
}

export async function getProject(id) {
    const r = await fetchWithAuth(`${API_URL}/api/projects/${id}`);
    return asJson(r);
}

export async function createProject(payload) {
    const r = await fetchWithAuth(`${API_URL}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return asJson(r);
}

export async function updateProject(id, payload) {
    const r = await fetchWithAuth(`${API_URL}/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return asJson(r);
}

export async function deleteProject(id) {
    const r = await fetchWithAuth(`${API_URL}/api/projects/${id}`, {
        method: 'DELETE',
    });
    return asJson(r);
}

export async function addProjectMember(id, userId) {
    const r = await fetchWithAuth(`${API_URL}/api/projects/${id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
    });
    return asJson(r);
}

export async function removeProjectMember(id, userId) {
    const r = await fetchWithAuth(`${API_URL}/api/projects/${id}/members/${userId}`, {
        method: 'DELETE',
    });
    return asJson(r);
}

export async function searchUsers(q) {
    if (!q.trim()) return [];
    const r = await fetchWithAuth(`${API_URL}/api/users?q=${encodeURIComponent(q.trim())}`);
    return asJson(r);
}
