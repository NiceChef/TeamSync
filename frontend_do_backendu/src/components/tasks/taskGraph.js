// Pomocnicze funkcje na grafie relacji zadań (rodzic ← → podzadanie) z wykrywaniem cykli.

function relatedOutgoing(task) {
    return task?.related_tasks?.outgoing || [];
}

function relatedIncoming(task) {
    return task?.related_tasks?.incoming || [];
}

// Czy dodanie krawędzi targetId → currentId utworzyłoby cykl (podążając za outgoing).
function wouldCreateCycle(tasks, targetId, currentId, visited = new Set()) {
    if (visited.has(targetId)) return true;
    if (targetId === currentId) return true;
    visited.add(targetId);
    const target = tasks.find((t) => t.id === targetId);
    for (const rel of relatedOutgoing(target)) {
        if (wouldCreateCycle(tasks, rel.target_task_id, currentId, visited)) return true;
    }
    return false;
}

// Wszyscy przodkowie (rekurencyjnie po incoming) danego zadania, łącznie z nim.
function collectAncestors(tasks, taskId, visited = new Set()) {
    if (visited.has(taskId)) return visited;
    visited.add(taskId);
    const task = tasks.find((t) => t.id === taskId);
    for (const rel of relatedIncoming(task)) {
        collectAncestors(tasks, rel.source_task_id, visited);
    }
    return visited;
}

// Zadania, które można dodać jako podzadanie `parentTaskId`.
export function getSubtaskCandidates(tasks, parentTaskId) {
    if (!tasks || tasks.length === 0) return [];
    const parentTask = tasks.find((t) => t.id === parentTaskId);
    if (!parentTask) return [];
    const existingOutgoing = relatedOutgoing(parentTask);
    return tasks.filter((t) => {
        if (t.id === parentTaskId) return false;
        if (existingOutgoing.some((rel) => rel.target_task_id === t.id)) return false;
        if (wouldCreateCycle(tasks, t.id, parentTaskId)) return false;
        return true;
    });
}

// Zadania, które można ustawić jako nadrzędne dla `childTaskId`.
export function getParentCandidates(tasks, childTaskId, incomingRelations = []) {
    if (!tasks || tasks.length === 0) return [];
    const childTask = tasks.find((t) => t.id === childTaskId);
    if (!childTask) return [];
    const excludeIds = collectAncestors(tasks, childTaskId);
    return tasks.filter((task) => {
        if (task.id === childTaskId) return false;
        if (incomingRelations.some((rel) => rel.source_task_id === task.id)) return false;
        if (wouldCreateCycle(tasks, task.id, childTaskId)) return false;
        if (excludeIds.has(task.id)) return false;
        return true;
    });
}
