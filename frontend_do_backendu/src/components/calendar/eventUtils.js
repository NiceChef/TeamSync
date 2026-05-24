import { API_URL, fetchWithAuth } from '../../api/authFetch';

// ─── Kolory typów wydarzeń (paleta slate + akcenty) ──────────────────────
export const EVENT_DOT = {
    meeting: 'bg-blue-500',
    deadline: 'bg-rose-500',
    reminder: 'bg-amber-500',
};

export const EVENT_CHIP = {
    meeting: 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300',
    deadline: 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300',
    reminder: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
};

export const EVENT_LABEL = {
    meeting: 'Spotkanie',
    deadline: 'Termin',
    reminder: 'Przypomnienie',
};

// ─── Parsowanie / serializacja UTC ───────────────────────────────────────
// Backend zwraca naive UTC ISO (bez strefy). Traktujemy brak strefy jako UTC.
export function parseUTC(value) {
    if (!value) return new Date(NaN);
    const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value);
    return new Date(hasZone ? value : `${value}Z`);
}

export function toUTCString(date) {
    return date.toISOString();
}

// ─── Operacje na datach ──────────────────────────────────────────────────
export function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
}

export function subDays(date, n) {
    return addDays(date, -n);
}

export function addWeeks(date, n) {
    return addDays(date, n * 7);
}

export function subWeeks(date, n) {
    return addDays(date, -n * 7);
}

export function addMonths(date, n) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + n);
    return d;
}

export function subMonths(date, n) {
    return addMonths(date, -n);
}

export function startOfWeek(date) {
    const d = startOfDay(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // poniedziałek = początek tygodnia
    return addDays(d, diff);
}

export function endOfWeek(date) {
    return addDays(startOfWeek(date), 6);
}

export function isSameDay(a, b) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

export function isSameMonth(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function isToday(date) {
    return isSameDay(date, new Date());
}

export function getHours(date) {
    return date.getHours();
}

export function getMinutes(date) {
    return date.getMinutes();
}

export function setHours(date, hours) {
    const d = new Date(date);
    d.setHours(hours);
    return d;
}

export function setMinutes(date, minutes) {
    const d = new Date(date);
    d.setMinutes(minutes);
    return d;
}

export function differenceInMinutes(a, b) {
    return Math.round((a.getTime() - b.getTime()) / 60000);
}

// 42-dniowa siatka miesiąca (od poniedziałku)
export function getMonthGrid(date) {
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const gridStart = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function getHourSlots() {
    return Array.from({ length: 24 }, (_, i) => i);
}

// ─── Formatowanie (pl-PL) ────────────────────────────────────────────────
export function formatMonthYear(date) {
    return date.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
}

export function formatWeekRange(start, end) {
    const s = start.toLocaleDateString('pl-PL', { day: '2-digit', month: 'short' });
    const e = end.toLocaleDateString('pl-PL', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${s} – ${e}`;
}

export function formatDayFull(date) {
    return date.toLocaleDateString('pl-PL', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
}

export function formatDayShort(date) {
    return date.toLocaleDateString('pl-PL', { weekday: 'short', day: '2-digit', month: 'short' });
}

export function formatTime(date) {
    return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

export function formatTimeRange(start, end) {
    return `${formatTime(start)} – ${formatTime(end)}`;
}

export function formatHourLabel(hour) {
    return `${String(hour).padStart(2, '0')}:00`;
}

// ─── API wydarzeń ────────────────────────────────────────────────────────
export async function fetchEvents() {
    const res = await fetchWithAuth(`${API_URL}/api/events`);
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Nie udało się pobrać wydarzeń.');
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

export async function createEvent(payload) {
    const res = await fetchWithAuth(`${API_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Nie udało się utworzyć wydarzenia.');
    }
    return res.json();
}

export async function updateEvent(id, payload) {
    const res = await fetchWithAuth(`${API_URL}/api/events/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (res.status === 409) {
        const conflict = new Error('conflict');
        conflict.code = 409;
        throw conflict;
    }
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Nie udało się zaktualizować wydarzenia.');
    }
    return res.json();
}

export async function deleteEvent(id) {
    const res = await fetchWithAuth(`${API_URL}/api/events/${id}`, { method: 'DELETE' });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Nie udało się usunąć wydarzenia.');
    }
    return res.json();
}

// Zadania z terminem (deadline) do nakładki na kalendarzu (read-only).
export async function fetchTasksWithDeadline() {
    const res = await fetchWithAuth(`${API_URL}/api/tasks`);
    if (!res.ok) return [];
    const data = await res.json();
    return (Array.isArray(data) ? data : []).filter((t) => t.deadline);
}

// Konwersja Date -> wartość dla <input type="datetime-local"> (czas lokalny).
export function toLocalInputValue(date) {
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
