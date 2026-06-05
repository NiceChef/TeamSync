export function taskRowClassName(task) {
    const level = task.displayLevel ?? 0;

    const parts = [
        'border-b border-slate-200 transition-colors dark:border-slate-800',
    ];

    if (task.completed) {
        parts.push(
            'bg-emerald-50/80 text-slate-500 hover:bg-emerald-100/80 dark:bg-emerald-950/20 dark:text-slate-400 dark:hover:bg-emerald-950/35'
        );
    } else if (level === 0) {
        parts.push(
            'bg-indigo-50/70 text-slate-900 hover:bg-indigo-100/70 dark:bg-indigo-950/20 dark:text-slate-100 dark:hover:bg-indigo-950/35'
        );
    } else if (level % 2 === 0) {
        parts.push(
            'bg-slate-50 text-slate-800 hover:bg-slate-100 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800/70'
        );
    } else {
        parts.push(
            'bg-white text-slate-800 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800/70'
        );
    }

    return parts.join(' ');
}

const PRIORITY_ORDER = {
    low: 1,
    medium: 2,
    high: 3,
    urgent: 4,
};

const STATUS_ORDER = {
    todo: 1,
    new: 1,
    open: 1,
    in_progress: 2,
    progress: 2,
    review: 3,
    done: 4,
    completed: 4,
    closed: 4,
};

function getDateValue(task, sortField) {
    if (sortField === 'created_at') {
        return task.created_at ? new Date(task.created_at) : null;
    }

    if (sortField === 'planned_date') {
        return task.planned_date ? new Date(task.planned_date) : null;
    }

    if (sortField === 'deadline') {
        return task.deadline ? new Date(task.deadline) : null;
    }

    if (sortField === 'soonest_action') {
        return task.soonest_action ? new Date(task.soonest_action) : null;
    }

    return null;
}

function getStatusSortValue(task) {
    const code = task.status?.code || task.status_code || '';
    const normalizedCode = String(code).trim().toLowerCase();

    if (STATUS_ORDER[normalizedCode] !== undefined) {
        return STATUS_ORDER[normalizedCode];
    }

    if (task.completed) {
        return STATUS_ORDER.done;
    }

    return 999;
}

function getPrioritySortValue(task) {
    const priority = String(task.priority || '').trim().toLowerCase();
    return PRIORITY_ORDER[priority] || 999;
}

function getProjectSortValue(task) {
    return String(
        task.project?.name ||
        task.project_name ||
        task.project_title ||
        task.project_id ||
        ''
    )
        .trim()
        .toLowerCase();
}

function compareText(a, b, order) {
    const result = a.localeCompare(b, 'pl', {
        sensitivity: 'base',
        numeric: true,
    });

    return order === 'asc' ? result : -result;
}

function compareNumbers(a, b, order) {
    const result = a - b;
    return order === 'asc' ? result : -result;
}

function compareDates(a, b, order) {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;

    return order === 'asc' ? a - b : b - a;
}

function compareTasks(a, b, sortField, order) {
    if (sortField === 'status') {
        const statusCompare = compareNumbers(
            getStatusSortValue(a),
            getStatusSortValue(b),
            order
        );

        if (statusCompare !== 0) return statusCompare;

        return compareDates(
            getDateValue(a, 'soonest_action'),
            getDateValue(b, 'soonest_action'),
            'asc'
        );
    }

    if (sortField === 'priority') {
        const priorityCompare = compareNumbers(
            getPrioritySortValue(a),
            getPrioritySortValue(b),
            order
        );

        if (priorityCompare !== 0) return priorityCompare;

        return compareDates(
            getDateValue(a, 'soonest_action'),
            getDateValue(b, 'soonest_action'),
            'asc'
        );
    }

    if (sortField === 'project') {
        const projectCompare = compareText(
            getProjectSortValue(a),
            getProjectSortValue(b),
            order
        );

        if (projectCompare !== 0) return projectCompare;

        return compareDates(
            getDateValue(a, 'soonest_action'),
            getDateValue(b, 'soonest_action'),
            'asc'
        );
    }

    return compareDates(
        getDateValue(a, sortField),
        getDateValue(b, sortField),
        order
    );
}

export function buildTaskHierarchy(allTasks, sortBy = 'created_at', sortOrder = 'desc') {
    const taskMap = new Map();

    allTasks.forEach((task) => {
        taskMap.set(task.id, { ...task, children: [] });
    });

    const childMap = new Map();
    const parentMap = new Map();

    allTasks.forEach((task) => {
        const relations = task.related_tasks || {};
        const outgoing = relations.outgoing || [];
        const incoming = relations.incoming || [];

        outgoing.forEach((rel) => {
            const childId = rel.target_task_id;

            if (!childMap.has(task.id)) {
                childMap.set(task.id, []);
            }

            if (!childMap.get(task.id).includes(childId)) {
                childMap.get(task.id).push(childId);
            }

            parentMap.set(childId, task.id);
        });

        incoming.forEach((rel) => {
            const parentId = rel.source_task_id;

            if (!childMap.has(parentId)) {
                childMap.set(parentId, []);
            }

            if (!childMap.get(parentId).includes(task.id)) {
                childMap.get(parentId).push(task.id);
            }

            parentMap.set(task.id, parentId);
        });
    });

    const rootTasks = allTasks.filter((task) => !parentMap.has(task.id));

    const buildTree = (taskId, level = 0) => {
        const task = taskMap.get(taskId);
        if (!task) return null;

        const children = childMap.get(taskId) || [];
        const childTasks = children
            .map((childId) => buildTree(childId, level + 1))
            .filter(Boolean);

        const sortedChildTasks = childTasks.sort((a, b) =>
            compareTasks(a, b, sortBy, sortOrder)
        );

        return {
            ...task,
            displayLevel: level,
            effective_planned_date: task.planned_date,
            children: sortedChildTasks,
        };
    };

    const sortedRootTasks = rootTasks.sort((a, b) =>
        compareTasks(a, b, sortBy, sortOrder)
    );

    const flattened = [];
    let colorGroupCounter = 0;

    const flatten = (task, parentId = null, colorGroup = null) => {
        if (!task) return;

        const { children, ...taskWithoutChildren } = task;
        const taskColorGroup = colorGroup !== null ? colorGroup : colorGroupCounter++;
        const hasChildren = task.children && task.children.length > 0;

        flattened.push({
            ...taskWithoutChildren,
            parentId,
            hasChildren,
            colorGroup: taskColorGroup,
        });

        if (hasChildren) {
            task.children.forEach((child) => flatten(child, task.id, taskColorGroup));
        }
    };

    sortedRootTasks.forEach((rootTask) => {
        const tree = buildTree(rootTask.id, 0);
        if (tree) flatten(tree);
    });

    return flattened;
}

export function formatDateOnly(dateString) {
    if (!dateString) return '-';

    const date = new Date(dateString);

    return date.toLocaleString('pl-PL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function formatDateTime(dateString) {
    if (!dateString) return '-';

    const date = new Date(dateString);

    return date.toLocaleString('pl-PL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}