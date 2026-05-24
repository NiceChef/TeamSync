import { Tags } from 'lucide-react';

export default function ActiveTaskFilters({
    selectedCategoryFilters,
    noCategories,
    categories,
}) {
    return (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <Tags className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                Aktywne filtry kategorii
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {selectedCategoryFilters.length === 0 && !noCategories ? (
                    <div className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                        Wszystkie zadania
                    </div>
                ) : (
                    <>
                        {selectedCategoryFilters.map((catId) => {
                            const category = categories.find((cat) => cat.id === catId);
                            if (!category) return null;

                            return (
                                <div
                                    key={catId}
                                    className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm"
                                    style={{
                                        backgroundColor: category.color ? `${category.color}20` : '#f8fafc',
                                        borderColor: category.color || '#6366f1',
                                    }}
                                >
                                    <span
                                        className="inline-block h-3 w-3 shrink-0 rounded-full"
                                        style={{ backgroundColor: category.color || '#6366f1' }}
                                    />
                                    <span className="font-medium">{category.name}</span>
                                </div>
                            );
                        })}

                        {noCategories && (
                            <div className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                                Bez kategorii
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}