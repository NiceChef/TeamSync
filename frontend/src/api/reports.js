import { API_URL, fetchWithAuth } from './authFetch';

async function getJson(path) {
    const res = await fetchWithAuth(`${API_URL}${path}`);
    if (res.status === 403) {
        const err = new Error('forbidden');
        err.code = 403;
        throw err;
    }
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || 'Nie udało się pobrać raportu.');
    }
    return res.json();
}

export function fetchTasksSummary() {
    return getJson('/api/reports/tasks-summary?format=json');
}

export function fetchProjectProgress() {
    return getJson('/api/reports/project-progress?format=json');
}

export function fetchUserActivity() {
    return getJson('/api/reports/user-activity?format=json');
}
