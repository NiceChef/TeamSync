import { useEffect } from 'react';

// Efekty scrolla listy zadań: przewinięcie do zadania po edycji oraz przywrócenie
// zapisanej pozycji po powrocie z widoku filtrów.
export function useTaskListScroll({ location, navigate, loading, hierarchicalTasks }) {
    useEffect(() => {
        if (location.state?.scrollToTaskId && hierarchicalTasks.length > 0 && !loading) {
            const taskId = location.state.scrollToTaskId;
            const taskElement = document.getElementById(`task-${taskId}`);

            if (taskElement) {
                setTimeout(() => {
                    const headerHeight = document.querySelector('.app-header')?.offsetHeight || 0;
                    const elementPosition = taskElement.getBoundingClientRect().top + window.pageYOffset;
                    const offsetPosition = elementPosition - headerHeight - 20;

                    window.scrollTo({ top: offsetPosition, behavior: 'smooth' });

                    taskElement.style.transition = 'background-color 0.3s ease';
                    taskElement.style.backgroundColor = '#fef3c7';
                    setTimeout(() => {
                        taskElement.style.backgroundColor = '';
                        setTimeout(() => {
                            taskElement.style.transition = '';
                        }, 300);
                    }, 2000);
                }, 100);
            }

            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [hierarchicalTasks, loading, location.state, location.pathname, navigate]);

    useEffect(() => {
        if (location.pathname === '/tasks' && !loading && hierarchicalTasks.length > 0) {
            const savedScrollPosition = localStorage.getItem('tasksScrollPosition');
            if (savedScrollPosition) {
                const scrollPosition = parseInt(savedScrollPosition, 10);
                setTimeout(() => {
                    window.scrollTo({ top: scrollPosition, behavior: 'auto' });
                    localStorage.removeItem('tasksScrollPosition');
                }, 100);
            }
        }
    }, [location.pathname, loading, hierarchicalTasks.length]);
}
