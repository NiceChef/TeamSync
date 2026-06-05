import { FieldLabel } from '../../ui/Field';

export default function CreateTaskCategories({
    categories,
    newTask,
    setNewTask,
    submitting,
}) {
    return (
        <div className="border-t border-slate-200 pt-6 dark:border-slate-800">
            <FieldLabel>Kategorie</FieldLabel>

            {categories.length === 0 ? (
                <p className="text-sm italic text-slate-500 dark:text-slate-400">
                    Brak kategorii. Kategorie możesz utworzyć w widoku kategorii.
                </p>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => {
                        const isSelected = (newTask.selectedCategories || []).includes(cat.id);

                        return (
                            <label
                                key={cat.id}
                                className={[
                                    'inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition',
                                    isSelected
                                        ? 'bg-indigo-50 font-semibold text-slate-900 dark:bg-indigo-500/15 dark:text-slate-100'
                                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800',
                                ].join(' ')}
                                style={{ borderColor: isSelected ? cat.color || '#6366f1' : undefined }}
                            >
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {
                                        setNewTask((prev) => ({
                                            ...prev,
                                            selectedCategories: isSelected
                                                ? (prev.selectedCategories || []).filter((id) => id !== cat.id)
                                                : [...(prev.selectedCategories || []), cat.id],
                                        }));
                                    }}
                                    disabled={submitting}
                                    className="accent-indigo-600"
                                />

                                <span
                                    className="h-3 w-3 shrink-0 rounded-full"
                                    style={{ backgroundColor: cat.color || '#667eea' }}
                                />

                                <span>{cat.name}</span>
                            </label>
                        );
                    })}
                </div>
            )}
        </div>
    );
}