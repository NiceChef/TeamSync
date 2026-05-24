import {
    ArrowDownAZ,
    ArrowUpAZ,
    CalendarRange,
    ListFilter,
    Search,
} from 'lucide-react';

export default function TasksToolbar({
    searchQuery,
    setSearchQuery,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    onOpenFilters,
}) {
    return (
        <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <label
                htmlFor="task-search"
                className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"
            >
                <Search className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                Szukaj
            </label>

            <input
                id="task-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Temat lub notatki..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />

            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        <CalendarRange className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                        Zakres dat i sortowanie
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        <label className="block">
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                Od
                            </span>
                            <input
                                id="date-from"
                                type="date"
                                value={dateFrom || ''}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            />
                        </label>

                        <label className="block">
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                Do
                            </span>
                            <input
                                id="date-to"
                                type="date"
                                value={dateTo || ''}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            />
                        </label>

                        <label className="block sm:col-span-2 xl:col-span-1">
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                Sortuj według
                            </span>
                            <select
                                id="sort-by"
                                value={sortBy || 'soonest_action'}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            >
                                <option value="soonest_action">Najbliższa akcja</option>
                                <option value="created_at">Data utworzenia</option>
                                <option value="planned_date">Data planu</option>
                                <option value="deadline">Deadline</option>
                            </select>
                        </label>

                        <button
                            type="button"
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                            className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
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
                </div>

                <button
                    type="button"
                    onClick={onOpenFilters}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:shadow-md"
                >
                    <ListFilter className="h-4 w-4" />
                    Filtry
                </button>
            </div>
        </div>
    );
}