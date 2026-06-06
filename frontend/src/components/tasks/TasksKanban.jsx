import { useState } from 'react';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
    useDraggable,
    useDroppable,
} from '@dnd-kit/core';
import {
    CalendarClock,
    GripVertical,
    Pencil,
    Trash2,
} from 'lucide-react';

import { formatDateOnly } from './taskUtils';
import { priorityMeta } from '../../constants/priorities';
import TaskAssignmentSummary from './TaskAssignmentSummary';

const COLUMNS = [
    {
        code: 'todo',
        label: 'Do wykonania',
        accent: 'border-t-slate-400',
        chip: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    },
    {
        code: 'in_progress',
        label: 'W trakcie',
        accent: 'border-t-indigo-500',
        chip: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200',
    },
    {
        code: 'done',
        label: 'Zakończone',
        accent: 'border-t-emerald-500',
        chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200',
    },
];

function columnCodeForTask(task) {
    const code = task.status?.code;
    if (code === 'in_progress' || code === 'done') return code;
    return 'todo';
}

function CardBody({ task, navigate, handleEdit, handleDeleteTask, dragHandle }) {
    const prio = priorityMeta(task.priority);
    return (
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start gap-2">
                <span
                    {...(dragHandle || {})}
                    className="mt-0.5 shrink-0 cursor-grab touch-none text-slate-300 hover:text-slate-500 active:cursor-grabbing dark:text-slate-600"
                    title="Przeciągnij, aby zmienić status"
                >
                    <GripVertical className="h-4 w-4" />
                </span>
                <button
                    type="button"
                    onClick={() => navigate(`/tasks/${task.id}`)}
                    className={`min-w-0 flex-1 text-left text-sm font-medium transition-colors hover:text-indigo-600 dark:hover:text-indigo-300 ${task.completed
                        ? 'text-slate-400 line-through'
                        : 'text-slate-800 dark:text-slate-100'
                        }`}
                >
                    {task.topic}
                </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${prio.badgeClass}`}>
                    {prio.label}
                </span>
                <TaskAssignmentSummary
                    task={task}
                    compact
                />
                {task.deadline && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <CalendarClock className="h-3 w-3" />
                        {formatDateOnly(task.deadline)}
                    </span>
                )}
                {(task.categories || []).map((cat) => (
                    <span
                        key={cat.id}
                        className="h-2.5 w-2.5 rounded-full border border-black/10"
                        style={{ backgroundColor: cat.color || '#6366f1' }}
                        title={cat.name}
                    />
                ))}
            </div>

            <div className="mt-2 flex justify-end gap-1 pl-6">
                <button
                    type="button"
                    onClick={() => handleEdit(task)}
                    title="Edytuj"
                    className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                >
                    <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                    type="button"
                    onClick={() => handleDeleteTask(task.id)}
                    title="Usuń"
                    className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}

function DraggableCard(props) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: props.task.id,
    });
    return (
        <div
            ref={setNodeRef}
            className={isDragging ? 'opacity-40' : ''}
            {...attributes}
        >
            <CardBody {...props} dragHandle={listeners} />
        </div>
    );
}

function Column({ column, tasks, navigate, handleEdit, handleDeleteTask }) {
    const { setNodeRef, isOver } = useDroppable({ id: column.code });
    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col rounded-xl border border-t-4 ${column.accent} bg-slate-50 p-3 transition-colors dark:bg-slate-950/60 ${isOver ? 'ring-2 ring-indigo-400' : 'border-slate-200 dark:border-slate-800'
                }`}
        >
            <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{column.label}</h3>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${column.chip}`}>
                    {tasks.length}
                </span>
            </div>
            <div className="flex min-h-[120px] flex-col gap-2">
                {tasks.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 py-6 text-center text-xs text-slate-400 dark:border-slate-700">
                        Przeciągnij tu zadanie
                    </p>
                ) : (
                    tasks.map((task) => (
                        <DraggableCard
                            key={task.id}
                            task={task}
                            navigate={navigate}
                            handleEdit={handleEdit}
                            handleDeleteTask={handleDeleteTask}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

export default function TasksKanban({
    tasks,
    statuses,
    onMove,
    navigate,
    handleEdit,
    handleDeleteTask,
}) {
    const [activeId, setActiveId] = useState(null);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    const grouped = COLUMNS.reduce((acc, col) => {
        acc[col.code] = [];
        return acc;
    }, {});
    tasks.forEach((t) => {
        grouped[columnCodeForTask(t)].push(t);
    });

    const activeTask = activeId != null ? tasks.find((t) => t.id === activeId) : null;

    const handleDragEnd = (event) => {
        setActiveId(null);
        const { active, over } = event;
        if (!over) return;
        const taskId = active.id;
        const targetCode = over.id;
        const status = statuses.find((s) => s.code === targetCode);
        if (!status) return;
        const task = tasks.find((t) => t.id === taskId);
        if (!task || task.status_id === status.id) return;
        onMove(task, status);
    };

    return (
        <DndContext
            sensors={sensors}
            onDragStart={(e) => setActiveId(e.active.id)}
            onDragCancel={() => setActiveId(null)}
            onDragEnd={handleDragEnd}
        >
            <div className="grid gap-4 md:grid-cols-3">
                {COLUMNS.map((col) => (
                    <Column
                        key={col.code}
                        column={col}
                        tasks={grouped[col.code]}
                        navigate={navigate}
                        handleEdit={handleEdit}
                        handleDeleteTask={handleDeleteTask}
                    />
                ))}
            </div>
            <DragOverlay>
                {activeTask ? (
                    <div className="w-72 rotate-2">
                        <CardBody
                            task={activeTask}
                            navigate={navigate}
                            handleEdit={handleEdit}
                            handleDeleteTask={handleDeleteTask}
                        />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
