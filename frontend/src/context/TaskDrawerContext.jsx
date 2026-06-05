import { useState, useCallback, useMemo } from 'react';
import Drawer from '../components/ui/Drawer';
import CreateTask from '../components/tasks/CreateTask';
import EditTask from '../components/EditTask';
import { useTasksContext } from './tasks-context';
import { TaskDrawerContext } from './task-drawer-context';

const EMPTY = {
    mode: null,
    taskId: null,
    parentId: null,
    projectId: null,
    defaults: null,
};

export function TaskDrawerProvider({ children }) {
    const tasksContext = useTasksContext();
    const [state, setState] = useState(EMPTY);
    const [refreshSignal, setRefreshSignal] = useState(0);

    const openCreateTask = useCallback((options = null) => {
        if (options && typeof options === 'object') {
            setState({
                mode: 'create',
                taskId: null,
                parentId: options.parentId ? String(options.parentId) : null,
                projectId: options.projectId ? String(options.projectId) : null,
                defaults: options.defaults || null,
            });
            return;
        }

        setState({
            ...EMPTY,
            mode: 'create',
            parentId: options ? String(options) : null,
        });
    }, []);

    const openEditTask = useCallback(
        (taskId) => setState({ ...EMPTY, mode: 'edit', taskId }),
        [],
    );

    const closeTaskDrawer = useCallback(() => setState(EMPTY), []);

    const handleSaved = useCallback(() => {
        try {
            tasksContext?.onRefresh?.();
        } catch {
            /* lista może nie być zamontowana */
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
                        projectId={state.projectId}
                        defaults={state.defaults}
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