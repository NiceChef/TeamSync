import { API_URL, fetchWithAuth } from './authFetch';

async function asJson(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || data.error || 'Wystąpił błąd');
    }
    return data;
}

export async function getTask(id, { includeRelations = true } = {}) {
    const r = await fetchWithAuth(
        `${API_URL}/api/tasks/${id}?include_relations=${includeRelations}`
    );
    return asJson(r);
}

export async function listTaskStatuses() {
    const r = await fetchWithAuth(`${API_URL}/api/task-statuses`);
    return asJson(r);
}

export async function listComments(id) {
    const r = await fetchWithAuth(`${API_URL}/api/tasks/${id}/comments`);
    return asJson(r);
}

export async function addComment(id, body) {
    const r = await fetchWithAuth(`${API_URL}/api/tasks/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
    });
    return asJson(r);
}

export async function listActivities(id) {
    const r = await fetchWithAuth(`${API_URL}/api/tasks/${id}/activities`);
    return asJson(r);
}

export async function listAttachments(id) {
    const r = await fetchWithAuth(`${API_URL}/api/tasks/${id}/attachments`);
    return asJson(r);
}

export async function uploadAttachment(id, file) {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetchWithAuth(`${API_URL}/api/tasks/${id}/attachments`, {
        method: 'POST',
        body: fd,
    });
    return asJson(r);
}

export async function deleteAttachment(attachmentId) {
    const r = await fetchWithAuth(`${API_URL}/api/attachments/${attachmentId}`, {
        method: 'DELETE',
    });
    return asJson(r);
}

export async function downloadAttachment(attachment) {
    const r = await fetchWithAuth(`${API_URL}/api/attachments/${attachment.id}/download`);
    if (!r.ok) throw new Error('Nie udało się pobrać pliku');
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = attachment.original_name;
    a.click();
    URL.revokeObjectURL(url);
}

export async function listRelations(id) {
    const r = await fetchWithAuth(
        `${API_URL}/api/tasks/${id}/relations?include_tasks=true&direction=both`
    );
    return asJson(r);
}
