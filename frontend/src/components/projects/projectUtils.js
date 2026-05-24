export const PROJECT_STATUSES = [
    { code: 'active', label: 'Aktywny', variant: 'success' },
    { code: 'draft', label: 'Szkic', variant: 'default' },
    { code: 'archived', label: 'Zarchiwizowany', variant: 'warning' },
];

export function statusMeta(code) {
    return PROJECT_STATUSES.find((s) => s.code === code) || PROJECT_STATUSES[1];
}

export function initials(user) {
    const name = (user?.username || user?.email || '?').trim();
    const parts = name.split(/[\s._-]+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}
