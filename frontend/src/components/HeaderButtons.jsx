import { memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTasksContext } from '../context/tasks-context';
import { useTaskDrawer } from '../context/task-drawer-context';

const btnPrimary =
  'inline-flex h-[38px] shrink-0 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white shadow transition hover:-translate-y-px hover:shadow-md';

function HeaderButtons({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const tasksContext = useTasksContext();
  const { openCreateTask } = useTaskDrawer();

  const showTaskHeader =
    tasksContext &&
    (['/dashboard', '/tasks', '/tasks/filter', '/calendar', '/more', '/profile', '/groups'].includes(location.pathname) ||
      location.pathname.startsWith('/tasks/') ||
      location.pathname.startsWith('/categories/'));

  if (!showTaskHeader) {
    return null;
  }

  const onFilterClick = () => {
    const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
    localStorage.setItem('tasksScrollPosition', scrollPosition.toString());
    navigate('/tasks/filter');
  };

  return (
    <div className="flex max-w-[100vw] shrink-0 flex-nowrap items-center gap-2 overflow-x-auto py-1">
      <button
        type="button"
        onClick={() => navigate('/dashboard')}
        className={`${btnPrimary} bg-gradient-to-br from-indigo-500 to-blue-600`}
      >
        Dashboard
      </button>

      <button
        type="button"
        onClick={() => navigate('/tasks')}
        className={`${btnPrimary} bg-gradient-to-br from-slate-600 to-slate-800`}
      >
        Lista zadań
      </button>

      <button
        type="button"
        onClick={() => navigate('/calendar')}
        className={`${btnPrimary} bg-gradient-to-br from-violet-500 to-purple-700`}
      >
        Kalendarz
      </button>

      <button
        type="button"
        onClick={onFilterClick}
        className={`${btnPrimary} bg-gradient-to-br from-emerald-500 to-green-600`}
      >
        Filtry
      </button>

      <button
        type="button"
        onClick={() => openCreateTask()}
        className={`${btnPrimary} bg-gradient-to-br from-teal-500 to-emerald-600`}
      >
        Dodaj zadanie
      </button>

      <button
        type="button"
        onClick={() => navigate('/groups')}
        className={`${btnPrimary} bg-gradient-to-br from-amber-500 to-orange-600`}
      >
        Grupy
      </button>

      <button
        type="button"
        onClick={() => navigate('/profile')}
        className={`${btnPrimary} bg-gradient-to-br from-sky-500 to-blue-600`}
      >
        Profil
      </button>

      <button
        type="button"
        onClick={() => navigate('/more')}
        className={`${btnPrimary} bg-gradient-to-br from-purple-400 to-violet-600`}
      >
        Więcej
      </button>

      <div className="ml-2 flex shrink-0 items-center gap-2 border-l border-white/30 pl-3">
        <span className="whitespace-nowrap text-sm text-white">Witaj, {user?.username}</span>
        <button
          type="button"
          onClick={onLogout}
          className="h-[38px] rounded-lg border border-white/30 bg-white/20 px-4 text-sm text-white hover:bg-white/30"
        >
          Wyloguj
        </button>
      </div>
    </div>
  );
}

export default memo(HeaderButtons);
