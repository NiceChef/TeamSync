import { API_URL, fetchWithAuth } from './authFetch';

async function parseResponse(res, fallback) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || fallback);
    return data;
}

export async function fetchAuthorizationUsers(status = '') {
    const params = new URLSearchParams();

    if (status) {
        params.set('status', status);
    }

    const query = params.toString();
    const url = query
        ? `${API_URL}/api/authorization/users?${query}`
        : `${API_URL}/api/authorization/users`;

    const res = await fetchWithAuth(url);
    return parseResponse(res, 'Nie udalo sie pobrac uzytkownikow.');
}

export async function fetchPendingUsers() {
    const res = await fetchWithAuth(`${API_URL}/api/authorization/pending-users`);
    return parseResponse(res, 'Nie udalo sie pobrac oczekujacych uzytkownikow.');
}

export async function fetchOrganizations() {
    const res = await fetchWithAuth(`${API_URL}/api/authorization/organizations`);
    return parseResponse(res, 'Nie udalo sie pobrac organizacji.');
}

export async function createOrganization(name) {
    const res = await fetchWithAuth(`${API_URL}/api/authorization/organizations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });

    return parseResponse(res, 'Nie udalo sie utworzyc organizacji.');
}

export async function approveUser(userId, payload) {
    const res = await fetchWithAuth(`${API_URL}/api/authorization/users/${userId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    return parseResponse(res, 'Nie udalo sie zatwierdzic uzytkownika.');
}

export async function rejectUser(userId) {
    const res = await fetchWithAuth(`${API_URL}/api/authorization/users/${userId}/reject`, {
        method: 'POST',
    });

    return parseResponse(res, 'Nie udalo sie odrzucic uzytkownika.');
}

export async function markUserPending(userId) {
    const res = await fetchWithAuth(`${API_URL}/api/authorization/users/${userId}/pending`, {
        method: 'POST',
    });

    return parseResponse(res, 'Nie udalo sie przeniesc uzytkownika do oczekujacych.');
}

export async function updateUserOrganization(userId, payload) {
    const res = await fetchWithAuth(`${API_URL}/api/authorization/users/${userId}/organization`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    return parseResponse(res, 'Nie udalo sie zaktualizowac uzytkownika.');
}