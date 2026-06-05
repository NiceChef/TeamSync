import { useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../ui/Card';
import { Field, FieldLabel } from '../../ui/Field';
import Select from '../../ui/Select';
import Button from '../../ui/Button';
import { getSubtaskCandidates, getParentCandidates } from '../taskGraph';

export default function TaskRelationsCard({
    editingTaskId,
    tasks,
    incomingRelations,
    outgoingRelations,
    submitting,
    onError,
    onAddSubtask,
    onRemoveSubtask,
    onAddParent,
    onRemoveParent,
}) {
    const [selectedSubtaskId, setSelectedSubtaskId] = useState('');
    const [selectedParentTaskId, setSelectedParentTaskId] = useState('');

    const subtaskCandidates = useMemo(
        () => getSubtaskCandidates(tasks, editingTaskId),
        [tasks, editingTaskId],
    );
    const parentCandidates = useMemo(
        () => getParentCandidates(tasks, editingTaskId, incomingRelations),
        [tasks, editingTaskId, incomingRelations],
    );

    const handleSetParent = async () => {
        if (!selectedParentTaskId) return;
        if (incomingRelations.length > 0) {
            const removed = await onRemoveParent(incomingRelations[0].id);
            if (!removed) return;
        }
        await onAddParent(selectedParentTaskId);
        setSelectedParentTaskId('');
    };

    const handleAddSubtask = async () => {
        if (!selectedSubtaskId) return;
        await onAddSubtask(selectedSubtaskId);
        setSelectedSubtaskId('');
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Relacje</CardTitle>
                <CardDescription>Zadanie nadrzędne i podzadania.</CardDescription>
            </CardHeader>

            <div className="space-y-6">
                <div>
                    <FieldLabel>Zadanie nadrzędne</FieldLabel>
                    {incomingRelations.length > 0 && (
                        <div className="mb-3 space-y-2">
                            {incomingRelations.map((rel) => {
                                const parentTask = tasks.find((t) => t.id === rel.source_task_id);
                                return parentTask ? (
                                    <div
                                        key={rel.id}
                                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                                    >
                                        <span className="text-slate-800 dark:text-slate-200">{parentTask.topic}</span>
                                        <Button
                                            type="button"
                                            variant="danger"
                                            size="sm"
                                            onClick={() => onRemoveParent(rel.id)}
                                            disabled={submitting}
                                        >
                                            Usuń
                                        </Button>
                                    </div>
                                ) : null;
                            })}
                        </div>
                    )}
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Select
                            id="parent-task-select"
                            value={selectedParentTaskId}
                            onChange={(e) => {
                                setSelectedParentTaskId(e.target.value);
                                onError?.('');
                            }}
                            disabled={submitting || parentCandidates.length === 0}
                        >
                            <option value="">— Wybierz zadanie —</option>
                            {parentCandidates.length === 0 ? (
                                <option value="" disabled>Brak dostępnych zadań</option>
                            ) : (
                                parentCandidates.map((task) => (
                                    <option key={task.id} value={task.id}>
                                        {task.topic} {task.completed ? '(zakończone)' : ''}
                                    </option>
                                ))
                            )}
                        </Select>
                        <Button
                            type="button"
                            variant="primary"
                            onClick={handleSetParent}
                            disabled={submitting || !selectedParentTaskId || parentCandidates.length === 0}
                        >
                            {incomingRelations.length > 0 ? 'Zmień' : 'Dodaj'}
                        </Button>
                    </div>
                    {parentCandidates.length === 0 && (
                        <p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">
                            Wszystkie zadania są już powiązane albo utworzyłyby zapętloną relację.
                        </p>
                    )}
                </div>

                <div className="border-t border-slate-200 pt-6 dark:border-slate-800">
                    <FieldLabel>Podzadania</FieldLabel>
                    {outgoingRelations.length > 0 && (
                        <div className="mb-3 space-y-2">
                            {outgoingRelations.map((rel) => {
                                const subtask = tasks.find((t) => t.id === rel.target_task_id);
                                return subtask ? (
                                    <div
                                        key={rel.id}
                                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                                    >
                                        <span className="text-slate-800 dark:text-slate-200">{subtask.topic}</span>
                                        <Button
                                            type="button"
                                            variant="danger"
                                            size="sm"
                                            onClick={() => onRemoveSubtask(rel.id)}
                                            disabled={submitting}
                                        >
                                            Usuń
                                        </Button>
                                    </div>
                                ) : null;
                            })}
                        </div>
                    )}
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Select
                            id="subtask-select"
                            value={selectedSubtaskId}
                            onChange={(e) => {
                                setSelectedSubtaskId(e.target.value);
                                onError?.('');
                            }}
                            disabled={submitting || subtaskCandidates.length === 0}
                        >
                            <option value="">— Wybierz zadanie —</option>
                            {subtaskCandidates.length === 0 ? (
                                <option value="" disabled>Brak dostępnych zadań</option>
                            ) : (
                                subtaskCandidates.map((task) => (
                                    <option key={task.id} value={task.id}>
                                        {task.topic} {task.completed ? '(zakończone)' : ''}
                                    </option>
                                ))
                            )}
                        </Select>
                        <Button
                            type="button"
                            variant="primary"
                            onClick={handleAddSubtask}
                            disabled={submitting || !selectedSubtaskId || subtaskCandidates.length === 0}
                        >
                            Dodaj
                        </Button>
                    </div>
                    {subtaskCandidates.length === 0 && (
                        <p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">
                            Wszystkie zadania są już powiązane albo utworzyłyby zapętloną relację.
                        </p>
                    )}
                </div>
            </div>
        </Card>
    );
}
