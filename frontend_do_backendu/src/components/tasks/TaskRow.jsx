import React from 'react';
import { taskRowClassName } from './taskUtils';
import { useTaskDrawer } from '../../context/TaskDrawerContext';

export default function TaskRow({
    task,
    visibleColumns,
    formatDateOnly,
    expandedNotesTaskId,
    setExpandedNotesTaskId,
    toggleComplete,
    navigate,
    handleEdit,
    handleDeleteTask,
}) {
    const { openCreateTask } = useTaskDrawer();
    return (
        <React.Fragment>
            <tr
                id={`task-${task.id}`}
                className={taskRowClassName(task)}
                data-level={task.displayLevel}
                data-color-group={task.colorGroup !== undefined ? task.colorGroup : null}
                data-has-children={task.hasChildren || false}
                data-is-child={task.parentId !== undefined && task.parentId !== null}
            >
                {visibleColumns.created && (
                    <td className="px-4 py-3 align-middle" data-label="Utworzono">
                        {formatDateOnly(task.created_at)}
                    </td>
                )}

                {visibleColumns.soonest_action && (
                    <td className="px-4 py-3 align-middle" data-label="Najbliższa akcja">
                        {formatDateOnly(task.soonest_action)}
                    </td>
                )}

                {visibleColumns.planned_date && (
                    <td className="px-4 py-3 align-middle" data-label="Plan">
                        {formatDateOnly(task.effective_planned_date || task.planned_date)}
                    </td>
                )}

                {visibleColumns.deadline && (
                    <td className="px-4 py-3 align-middle" data-label="Deadline">
                        {formatDateOnly(task.deadline)}
                    </td>
                )}

                <td className="px-4 py-3 align-middle" data-label="Temat">
                    <div
                        className="flex flex-wrap items-center gap-2"
                        style={{ paddingLeft: `${task.displayLevel * 24}px` }}
                    >
                        {task.displayLevel > 0 && (
                            <span className="shrink-0 text-sm text-slate-300 dark:text-slate-600">
                                └─
                            </span>
                        )}

                        <button
                            type="button"
                            onClick={() => navigate(`/tasks/${task.id}`)}
                            title="Pokaż szczegóły zadania"
                            className={`flex-1 break-words text-left transition-colors hover:text-indigo-600 hover:underline dark:hover:text-indigo-300 ${task.completed
                                ? 'font-medium text-slate-500 line-through dark:text-slate-500'
                                : task.displayLevel === 0
                                    ? 'font-semibold text-slate-900 dark:text-slate-100'
                                    : 'font-medium text-slate-800 dark:text-slate-200'
                                }`}
                        >
                            {task.topic}
                        </button>

                        {task.notes && task.notes.trim() && (
                            <button
                                type="button"
                                onClick={() => {
                                    setExpandedNotesTaskId(expandedNotesTaskId === task.id ? null : task.id);
                                }}
                                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-indigo-500 text-xs transition hover:scale-110 ${expandedNotesTaskId === task.id
                                    ? 'bg-indigo-200 dark:bg-indigo-500/30'
                                    : 'bg-indigo-50 dark:bg-indigo-500/10'
                                    }`}
                                title={expandedNotesTaskId === task.id ? 'Ukryj notatki' : 'Pokaż notatki'}
                            >
                                i
                            </button>
                        )}

                        {task.categories && task.categories.length > 0 && (
                            <div className="ml-2 flex items-center gap-1.5">
                                {task.categories.map((cat) => (
                                    <span
                                        key={cat.id}
                                        className="inline-block h-3 w-3 shrink-0 rounded-full border border-black/10"
                                        style={{ backgroundColor: cat.color || '#6366f1' }}
                                        title={cat.name}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </td>

                <td className="px-4 py-3 align-middle">
                    <button
                        type="button"
                        className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${task.completed
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:hover:bg-emerald-500/25'
                                : 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:hover:bg-amber-500/25'
                            }`}
                        onClick={() => toggleComplete(task.id, task.completed)}
                        title={task.completed ? 'Oznacz jako otwarte' : 'Oznacz jako zrobione'}
                    >
                        {task.completed ? 'Zrobione' : 'Otwarte'}
                    </button>
                </td>

                <td className="px-4 py-3 align-middle">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                            type="button"
                            className="shrink-0 rounded-md border border-emerald-400 px-3 py-1.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50 dark:border-emerald-500/50 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
                            onClick={() => openCreateTask(task.id)}
                            title="Dodaj podzadanie"
                        >
                            + Podzadanie
                        </button>

                        <button
                            type="button"
                            className="shrink-0 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            onClick={() => handleEdit(task)}
                        >
                            Edytuj
                        </button>

                        <button
                            type="button"
                            className="shrink-0 rounded-md border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-500/50 dark:text-rose-200 dark:hover:bg-rose-500/10"
                            onClick={() => handleDeleteTask(task.id)}
                        >
                            Usuń
                        </button>
                    </div>
                </td>
            </tr>

            {expandedNotesTaskId === task.id && task.notes && task.notes.trim() && (
                <tr className="border-0 bg-transparent">
                    <td
                        colSpan={1 + 1 + 1 + Object.values(visibleColumns).filter((v) => v).length}
                        className="border-0 bg-transparent px-4 pb-3 pt-1"
                    >
                        <div
                            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 [&_a]:text-indigo-600 [&_a]:underline [&_img]:my-2 [&_img]:max-h-48 [&_img]:max-w-full [&_img]:rounded"
                            style={{ marginLeft: `${task.displayLevel * 24 + 12}px` }}
                            dangerouslySetInnerHTML={{ __html: task.notes }}
                        />
                    </td>
                </tr>
            )}
        </React.Fragment>
    );
}