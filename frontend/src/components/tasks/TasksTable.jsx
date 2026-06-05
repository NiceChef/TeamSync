import TaskRow from './TaskRow';

const thBase =
    'whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white';

export default function TasksTable({
    hierarchicalTasks,
    visibleColumns,
    formatDateOnly,
    expandedNotesTaskId,
    setExpandedNotesTaskId,
    toggleComplete,
    navigate,
    handleEdit,
    handleDeleteTask,
}) {
    return (
        <div className="w-full max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full min-w-[760px] border-collapse text-sm text-slate-800 dark:text-slate-100">
                <thead className="sticky top-0 z-10 bg-gradient-to-r from-indigo-600 to-purple-700 shadow-md">
                    <tr>
                        {visibleColumns.created && (
                            <th className={`${thBase} min-w-[140px] w-[14%]`}>Utworzono</th>
                        )}
                        {visibleColumns.soonest_action && (
                            <th className={`${thBase} min-w-[140px] w-[14%]`}>
                                Najbliższa akcja
                            </th>
                        )}
                        {visibleColumns.planned_date && (
                            <th className={`${thBase} min-w-[130px] w-[12%]`}>Plan</th>
                        )}
                        {visibleColumns.deadline && (
                            <th className={`${thBase} min-w-[130px] w-[12%]`}>Deadline</th>
                        )}
                        <th className={`${thBase} min-w-[240px] w-[28%]`}>Temat</th>
                        <th className={`${thBase} min-w-[100px] w-[8%] text-center`}>
                            Status
                        </th>
                        <th className={`${thBase} min-w-[200px] w-[18%] text-center`}>
                            Akcje
                        </th>
                    </tr>
                </thead>

                <tbody>
                    {hierarchicalTasks.length === 0 ? (
                        <tr>
                            <td
                                colSpan={3 + Object.values(visibleColumns).filter((v) => v).length}
                                className="py-12 text-center italic text-slate-500 dark:text-slate-400"
                            >
                                <p className="mb-2 text-base font-bold not-italic text-slate-700 dark:text-slate-200">
                                    Nie masz jeszcze żadnych zadań.
                                </p>
                                <p className="text-sm not-italic text-slate-600 dark:text-slate-400">
                                    Użyj przycisku „Dodaj zadanie” w nagłówku, aby dodać pierwsze zadanie.
                                </p>
                            </td>
                        </tr>
                    ) : (
                        hierarchicalTasks.map((task) => (
                            <TaskRow
                                key={task.id}
                                task={task}
                                visibleColumns={visibleColumns}
                                formatDateOnly={formatDateOnly}
                                expandedNotesTaskId={expandedNotesTaskId}
                                setExpandedNotesTaskId={setExpandedNotesTaskId}
                                toggleComplete={toggleComplete}
                                navigate={navigate}
                                handleEdit={handleEdit}
                                handleDeleteTask={handleDeleteTask}
                            />
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}