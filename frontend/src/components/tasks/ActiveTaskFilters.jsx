import { Filter, X } from 'lucide-react';

const PRIORITY_LABELS = {
    low: 'Niski',
    medium: 'Średni',
    high: 'Wysoki',
};

const SORT_LABELS = {
    soonest_action: 'Najbliższa akcja',
    created_at: 'Data utworzenia',
    planned_date: 'Data planu',
    deadline: 'Deadline',
    status: 'Status',
    priority: 'Priorytet',
    project: 'Projekt',
};

function Chip({ children, color, onRemove }) {
    return (
        <span
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium"
            style={{
                backgroundColor: color ? `${color}20` : undefined,
                borderColor: color || undefined,
            }}
        >
            {children}
            {onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    className="rounded-full p-0.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                    aria-label="Usuń filtr"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            )}
        </span>
    );
}

export default function ActiveTaskFilters({
    searchQuery = '',
    setSearchQuery,
    selectedCategoryFilters = [],
    setSelectedCategoryFilters,
    noCategories = false,
    setNoCategories,
    categories = [],
    dateFrom = '',
    setDateFrom,
    dateTo = '',
    setDateTo,
    sortBy = 'soonest_action',
    setSortBy,
    sortOrder = 'asc',
    setSortOrder,
    projectsList = [],
    projectFilter = '',
    setProjectFilter,
    taskStatuses = [],
    statusCodeFilter = '',
    setStatusCodeFilter,
    priorityFilter = '',
    setPriorityFilter,
}) {
    const activeChips = [];

    if (searchQuery.trim()) {
        activeChips.push({
            key: 'search',
            label: `Szukaj: ${searchQuery.trim()}`,
            onRemove: () => setSearchQuery?.(''),
        });
    }

    if (dateFrom) {
        activeChips.push({
            key: 'dateFrom',
            label: `Data od: ${dateFrom}`,
            onRemove: () => setDateFrom?.(''),
        });
    }

    if (dateTo) {
        activeChips.push({
            key: 'dateTo',
            label: `Data do: ${dateTo}`,
            onRemove: () => setDateTo?.(''),
        });
    }

    if (statusCodeFilter) {
        const status = taskStatuses.find((item) => item.code === statusCodeFilter);
        activeChips.push({
            key: 'status',
            label: `Status: ${status?.label || statusCodeFilter}`,
            onRemove: () => setStatusCodeFilter?.(''),
        });
    }

    if (priorityFilter) {
        activeChips.push({
            key: 'priority',
            label: `Priorytet: ${PRIORITY_LABELS[priorityFilter] || priorityFilter}`,
            onRemove: () => setPriorityFilter?.(''),
        });
    }

    if (projectFilter) {
        const project = projectsList.find((item) => String(item.id) === String(projectFilter));
        activeChips.push({
            key: 'project',
            label: `Projekt: ${project?.name || projectFilter}`,
            onRemove: () => setProjectFilter?.(''),
        });
    }

    selectedCategoryFilters.forEach((catId) => {
        const category = categories.find((cat) => cat.id === catId);
        if (!category) return;

        activeChips.push({
            key: `category-${catId}`,
            label: `Kategoria: ${category.name}`,
            color: category.color || '#6366f1',
            onRemove: () => {
                setSelectedCategoryFilters?.((prev) => prev.filter((id) => id !== catId));
            },
        });
    });

    if (noCategories) {
        activeChips.push({
            key: 'noCategories',
            label: 'Bez kategorii',
            onRemove: () => setNoCategories?.(false),
        });
    }

    const hasCustomSort = sortBy !== 'soonest_action' || sortOrder !== 'asc';
    if (hasCustomSort) {
        activeChips.push({
            key: 'sort',
            label: `Sortowanie: ${SORT_LABELS[sortBy] || sortBy} ${sortOrder === 'asc' ? 'rosnąco' : 'malejąco'}`,
            onRemove: () => {
                setSortBy?.('soonest_action');
                setSortOrder?.('asc');
            },
        });
    }

    if (activeChips.length === 0) {
        return (
            <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <Filter className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                    Aktywne filtry
                </div>

                <div className="mt-3 rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                    Wszystkie zadania
                </div>
            </div>
        );
    }

    return (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <Filter className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                    Aktywne filtry
                </div>

                <button
                    type="button"
                    onClick={() => {
                        setSearchQuery?.('');
                        setDateFrom?.('');
                        setDateTo?.('');
                        setStatusCodeFilter?.('');
                        setPriorityFilter?.('');
                        setProjectFilter?.('');
                        setSelectedCategoryFilters?.([]);
                        setNoCategories?.(false);
                        setSortBy?.('soonest_action');
                        setSortOrder?.('asc');
                    }}
                    className="text-xs font-semibold text-slate-500 underline transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                >
                    Wyczyść wszystko
                </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {activeChips.map((chip) => (
                    <Chip
                        key={chip.key}
                        color={chip.color}
                        onRemove={chip.onRemove}
                    >
                        {chip.label}
                    </Chip>
                ))}
            </div>
        </div>
    );
}