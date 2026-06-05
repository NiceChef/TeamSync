import { useState } from 'react';
import {
    ArrowDownAZ,
    ArrowUpAZ,
    CalendarRange,
    ChevronDown,
    Columns3,
    ListFilter,
    Search,
    SlidersHorizontal,
} from 'lucide-react';

const COLUMN_OPTIONS = [
    { key: 'created', label: 'Utworzono' },
    { key: 'soonest_action', label: 'Najbliższa akcja' },
    { key: 'planned_date', label: 'Plan' },
    { key: 'deadline', label: 'Deadline' },
];

export default function TasksToolbar({
    searchQuery,
    setSearchQuery,
    onApplySearch,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    projectsList = [],
    projectFilter,
    setProjectFilter,
    taskStatuses = [],
    statusCodeFilter,
    setStatusCodeFilter,
    priorityFilter,
    setPriorityFilter,
    categories = [],
    selectedCategoryFilters = [],
    setSelectedCategoryFilters,
    noCategories = false,
    setNoCategories,
    visibleColumns = {},
    setVisibleColumns,
    onApplyFilters,
    onClearFilters,
}) {
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [columnsOpen, setColumnsOpen] = useState(false);

    const toggleCategory = (categoryId, checked) => {
        if (checked) {
            setSelectedCategoryFilters?.([
                ...selectedCategoryFilters,
                categoryId,
            ]);
            return;
        }

        setSelectedCategoryFilters?.(
            selectedCategoryFilters.filter((id) => id !== categoryId)
        );
    };

    const handleSearchSubmit = (event) => {
        event.preventDefault();
        onApplySearch?.();
    };

    return (
        <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <label className="min-w-0 flex-1">
                    <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        <Search className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                        Szukaj
                    </span>
                    <input
                        id="task-search"
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Temat lub notatki..."
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                </label>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                    >
                        <Search className="h-4 w-4" />
                        Szukaj
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setFiltersOpen((value) => !value);
                            setColumnsOpen(false);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                    >
                        <SlidersHorizontal className="h-4 w-4" />
                        Filtry
                        <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setColumnsOpen((value) => !value);
                            setFiltersOpen(false);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                    >
                        <Columns3 className="h-4 w-4" />
                        Kolumny
                        <ChevronDown className={`h-4 w-4 transition-transform ${columnsOpen ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </form>

            {filtersOpen && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        <CalendarRange className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                        Filtry i sortowanie
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <label className="block">
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Data od</span>
                            <input
                                id="date-from"
                                type="date"
                                value={dateFrom || ''}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            />
                        </label>

                        <label className="block">
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Data do</span>
                            <input
                                id="date-to"
                                type="date"
                                value={dateTo || ''}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            />
                        </label>

                        <label className="block">
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Status</span>
                            <select
                                value={statusCodeFilter || ''}
                                onChange={(e) => setStatusCodeFilter(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            >
                                <option value="">Wszystkie statusy</option>
                                {taskStatuses.map((status) => (
                                    <option key={status.code} value={status.code}>
                                        {status.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Priorytet</span>
                            <select
                                value={priorityFilter || ''}
                                onChange={(e) => setPriorityFilter(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            >
                                <option value="">Wszystkie priorytety</option>
                                <option value="low">Niski</option>
                                <option value="medium">Średni</option>
                                <option value="high">Wysoki</option>
                            </select>
                        </label>

                        <label className="block sm:col-span-2">
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Projekt</span>
                            <select
                                value={projectFilter || ''}
                                onChange={(e) => setProjectFilter(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            >
                                <option value="">Wszystkie projekty</option>
                                {projectsList.map((project) => (
                                    <option key={project.id} value={project.id}>
                                        {project.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Sortuj według</span>
                            <select
                                id="sort-by"
                                value={sortBy || 'soonest_action'}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            >
                                <option value="soonest_action">Najbliższa akcja</option>
                                <option value="created_at">Data utworzenia</option>
                                <option value="planned_date">Data planu</option>
                                <option value="deadline">Deadline</option>
                                <option value="status">Status</option>
                                <option value="priority">Priorytet</option>
                                <option value="project">Projekt</option>
                            </select>
                        </label>

                        <button
                            type="button"
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                            className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
                        >
                            {sortOrder === 'asc' ? (
                                <>
                                    <ArrowUpAZ className="h-4 w-4" />
                                    Rosnąco
                                </>
                            ) : (
                                <>
                                    <ArrowDownAZ className="h-4 w-4" />
                                    Malejąco
                                </>
                            )}
                        </button>
                    </div>

                    <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
                        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                            <ListFilter className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                            Kategorie
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            <label className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${noCategories
                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-900 dark:bg-indigo-500/15 dark:text-indigo-100'
                                    : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800'
                                }`}>
                                <input
                                    type="checkbox"
                                    checked={noCategories}
                                    onChange={(e) => setNoCategories?.(e.target.checked)}
                                    className="accent-indigo-600"
                                />
                                <span>Zadania bez kategorii</span>
                            </label>

                            {categories.map((category) => {
                                const isSelected = selectedCategoryFilters.includes(category.id);

                                return (
                                    <label
                                        key={category.id}
                                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${isSelected
                                                ? 'border-indigo-500 bg-indigo-50 text-indigo-900 dark:bg-indigo-500/15 dark:text-indigo-100'
                                                : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800'
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={(e) => toggleCategory(category.id, e.target.checked)}
                                            className="accent-indigo-600"
                                        />
                                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color || '#6366f1' }} />
                                        <span>{category.name}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-5 flex flex-wrap justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClearFilters}
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
                        >
                            Wyczyść
                        </button>

                        <button
                            type="button"
                            onClick={onApplyFilters}
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                        >
                            Filtruj
                        </button>
                    </div>
                </div>
            )}

            {columnsOpen && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        <Columns3 className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                        Widoczne kolumny
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {COLUMN_OPTIONS.map((column) => (
                            <label
                                key={column.key}
                                className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                <input
                                    type="checkbox"
                                    checked={!!visibleColumns?.[column.key]}
                                    onChange={(e) => {
                                        setVisibleColumns?.((prev) => ({
                                            ...prev,
                                            [column.key]: e.target.checked,
                                        }));
                                    }}
                                    className="accent-indigo-600"
                                />
                                <span>{column.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}