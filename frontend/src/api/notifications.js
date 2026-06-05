import { API_URL, fetchWithAuth } from './authFetch';

export async function listNotifications() {
    const res = await fetchWithAuth(`${API_URL}/api/notifications`);
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Nie udało się pobrać powiadomień.');
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

export async function markRead(id) {
    const res = await fetchWithAuth(`${API_URL}/api/notifications/${id}/read`, {
        method: 'POST',
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Nie udało się oznaczyć powiadomienia.');
    }
    return res.json();
}

export async function markAllRead(notifications) {
    const unread = notifications.filter((n) => !n.read);
    await Promise.allSettled(unread.map((n) => markRead(n.id)));
}
