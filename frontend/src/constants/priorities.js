// Wspólne metadane priorytetów zadań: etykieta PL, wariant Badge i klasy „pigułki".
export const PRIORITY_META = {
    high: {
        label: 'Wysoki',
        variant: 'danger',
        badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200',
    },
    medium: {
        label: 'Średni',
        variant: 'warning',
        badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
    },
    low: {
        label: 'Niski',
        variant: 'default',
        badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    },
};

export const PRIORITY_OPTIONS = [
    { value: 'high', label: 'Wysoki' },
    { value: 'medium', label: 'Średni' },
    { value: 'low', label: 'Niski' },
];

export const priorityMeta = (priority) => PRIORITY_META[priority] || PRIORITY_META.medium;
