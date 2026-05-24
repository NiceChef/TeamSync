import { useNavigate } from 'react-router-dom';
import { formatDate } from './calendarUtils';

export default function CalendarTaskList({
    selectedDate,
    selectedRange,
    filteredTasks,
    error,
}) {
    const navigate = useNavigate();

    return (
        <div className="min-h-[320px] rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950 sm:min-h-[500px] sm:p-6">
            <div className="mb-4 flex flex-col gap-2 border-b border-slate-200 pb-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                    {selectedRange.start && selectedRange.end
                        ? `Zadania: ${formatDate(selectedRange.start)} - ${formatDate(selectedRange.end)}`
                        : selectedDate
                            ? `Zadania: ${formatDate(selectedDate)}`
                            : 'Wybierz dzień lub zakres w kalendarzu'}
                </h3>

                {filteredTasks.length > 0 && (
                    <span className="w-fit rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">
                        {filteredTasks.length} zadań
                    </span>
                )}
            </div>

            {error && (
                <div
                    className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-center text-red-700"
                    role="alert"
                >
                    {error}
                </div>
            )}

            {!selectedDate && !selectedRange.start ? (
                <p className="py-12 text-center italic text-slate-500 dark:text-slate-400">
                    Wybierz datę lub zakres dat w kalendarzu, aby zobaczyć zadania.
                </p>
            ) : filteredTasks.length === 0 ? (
                <p className="py-12 text-center italic text-slate-500 dark:text-slate-400">
                    Brak zadań w wybranym okresie.
                </p>
            ) : (
                <div className="flex flex-col gap-4">
                    {filteredTasks.map((task) => (
                        <div
                            key={task.id}
                            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"                        >
                            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                                <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                                    {task.topic}
                                </h4>
                                <span
                                    className={`rounded-full px-3 py-0.5 text-xs font-semibold ${task.completed
                                        ? 'bg-emerald-100 text-emerald-900'
                                        : 'bg-rose-100 text-rose-900'
                                        }`}
                                >
                                    {task.completed ? 'Zrobione' : 'Otwarte'}
                                </span>
                            </div>

                            <div className="mb-3 flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-300">
                                {task.created_at && (
                                    <div className="flex gap-2">
                                        <span className="font-semibold text-slate-600 dark:text-slate-400">Utworzono:</span>
                                        <span>{formatDate(task.created_at)}</span>
                                    </div>
                                )}

                                {task.soonest_action && (
                                    <div className="flex gap-2">
                                        <span className="font-semibold text-slate-600 dark:text-slate-400">Najbliższa akcja:</span>
                                        <span>{formatDate(task.soonest_action)}</span>
                                    </div>
                                )}

                                {task.planned_date && (
                                    <div className="flex gap-2">
                                        <span className="font-semibold text-slate-600 dark:text-slate-400">Plan:</span>
                                        <span>{formatDate(task.planned_date)}</span>
                                    </div>
                                )}

                                {task.deadline && (
                                    <div className="flex gap-2">
                                        <span className="font-semibold text-slate-600 dark:text-slate-400">Deadline:</span>
                                        <span>{formatDate(task.deadline)}</span>
                                    </div>
                                )}
                            </div>

                            {task.categories && task.categories.length > 0 && (
                                <div className="mb-3 flex flex-wrap gap-2">
                                    {task.categories.map((cat) => (
                                        <span
                                            key={cat.id}
                                            className="rounded-full border px-2.5 py-0.5 text-xs font-medium"
                                            style={{
                                                backgroundColor: cat.color ? `${cat.color}25` : '#f1f5f9',
                                                borderColor: cat.color || '#6366f1',
                                                color: cat.color || '#4f46e5',
                                            }}
                                        >
                                            {cat.name}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => navigate(`/tasks/${task.id}/edit`)}
                                    className="flex-1 rounded-md bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:-translate-y-px hover:shadow-md sm:flex-none sm:px-6"
                                >
                                    Edytuj
                                </button>

                                <button
                                    type="button"
                                    onClick={() => navigate(`/tasks/new?parent_id=${task.id}`)}
                                    className="flex-1 rounded-md bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow hover:-translate-y-px hover:shadow-md sm:flex-none sm:px-6"
                                >
                                    + Podzadanie
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}