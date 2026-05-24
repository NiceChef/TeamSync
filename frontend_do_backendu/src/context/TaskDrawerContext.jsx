import { useState, useCallback, useMemo } from 'react';
import Drawer from '../components/ui/Drawer';
import CreateTask from '../components/tasks/CreateTask';
import EditTask from '../components/EditTask';
import { useTasksContext } from './tasks-context';
import { TaskDrawerContext } from './task-drawer-context';

const EMPTY = { mode: null, taskId: null, parentId: null };

export function TaskDrawerProvider({ children }) {
    const tasksContext = useTasksContext();
    const [state, setState] = useState(EMPTY);
    // Rośnie po każdym zapisie — widoki (np. szczegóły zadania) mogą się na nim odświeżać.
    const [refreshSignal, setRefreshSignal] = useState(0);

    const openCreateTask = useCallback(
        (parentId = null) =>
            setState({ mode: 'create', taskId: null, parentId: parentId ? String(parentId) : null }),
        [],
    );
    const openEditTask = useCallback(
        (taskId) => setState({ mode: 'edit', taskId, parentId: null }),
        [],
    );
    const closeTaskDrawer = useCallback(() => setState(EMPTY), []);

    // Po zapisie odśwież listę zadań (jeśli zamontowana) i zamknij panel.
    const handleSaved = useCallback(() => {
        try {
            tasksContext?.onRefresh?.();
        } catch {
            /* lista może nie być zamontowana — odświeży się przy wejściu na /tasks */
        }
        setRefreshSignal((n) => n + 1);
        closeTaskDrawer();
    }, [tasksContext, closeTaskDrawer]);

    const value = useMemo(
        () => ({ openCreateTask, openEditTask, closeTaskDrawer, refreshSignal }),
        [openCreateTask, openEditTask, closeTaskDrawer, refreshSignal],
    );

    const open = state.mode !== null;
    const title = state.mode === 'edit' ? 'Edytuj zadanie' : 'Nowe zadanie';

    return (
        <TaskDrawerContext.Provider value={value}>
            {children}
            <Drawer open={open} onClose={closeTaskDrawer} title={title}>
                {state.mode === 'create' && (
                    <CreateTask
                        isAuthenticated
                        drawer
                        parentId={state.parentId}
                        onClose={closeTaskDrawer}
                        onSaved={handleSaved}
                    />
                )}
                {state.mode === 'edit' && (
                    <EditTask
                        key={state.taskId}
                        isAuthenticated
                        drawer
                        taskId={state.taskId}
                        onClose={closeTaskDrawer}
                        onSaved={handleSaved}
                    />
                )}
            </Drawer>
        </TaskDrawerContext.Provider>
    );
}
