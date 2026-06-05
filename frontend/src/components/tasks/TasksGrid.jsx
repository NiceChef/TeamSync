import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import TasksToolbar from './TasksToolbar';
import ActiveTaskFilters from './ActiveTaskFilters';
import { useTasksContext } from '../../context/tasks-context';
import { useTaskDrawer } from '../../context/task-drawer-context';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useTaskListScroll } from '../../hooks/useTaskListScroll';
import TasksTable from './TasksTable';
import TasksKanban from './TasksKanban';
import { buildTaskHierarchy, formatDateOnly } from './taskUtils';
import { LayoutGrid, Table2, Trash2 } from 'lucide-react';
import { API_URL, fetchWithAuth } from '../../api/authFetch';
import TasksHeader from './TasksHeader';
import Button from '../ui/Button';
import {
  exportTasksToJSON,
  exportTasksToXLSX,
  importTasksFromJSON,
  importTasksFromXLSX,
} from './taskImportExport';

function TasksGrid({ isAuthenticated }) {
  const navigate = useNavigate();
  const location = useLocation();
  const tasksContext = useTasksContext();
  const setTasksContext = tasksContext?.setContext;
  const { openEditTask } = useTaskDrawer();

  // Get visibleColumns from context (persists across route changes)
  const visibleColumns = tasksContext?.visibleColumns || {
    created: true,
    soonest_action: true,
    planned_date: true,
    deadline: true
  };
  const setVisibleColumns = tasksContext?.setVisibleColumns;

  // Initialize context only once
  const contextInitialized = useRef(false);
  const [tasks, setTasks] = useState([]);
  const [hierarchicalTasks, setHierarchicalTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [taskToDeleteId, setTaskToDeleteId] = useState(null);
  // Filters are now managed via context and FilterView component
  const selectedCategoryFilters = useMemo(
    () => tasksContext?.selectedCategoryFilters || [],
    [tasksContext?.selectedCategoryFilters],
  );
  const statusFilter = tasksContext?.statusFilter || 'all';
  const noCategories = tasksContext?.noCategories || false;

  // Load categories for displaying active filters
  useEffect(() => {
    if (isAuthenticated && selectedCategoryFilters.length > 0) {
      const loadCategories = async () => {
        try {
          const response = await fetchWithAuth(`${API_URL}/api/categories`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch categories');
          }
          const data = await response.json();
          setCategories(data);
        } catch (err) {
          console.error('Failed to fetch categories:', err);
        }
      };
      loadCategories();
    }
  }, [isAuthenticated, selectedCategoryFilters.length]);
  const [sortBy, setSortBy] = useState('soonest_action'); // 'created_at', 'planned_date', 'deadline', 'soonest_action'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc', 'desc'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNotesTaskId, setExpandedNotesTaskId] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'kanban'
  const [taskStatuses, setTaskStatuses] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [projectFilter, setProjectFilter] = useState(''); // '' = wszystkie

  const settingsLoaded = useUserSettings({
    isAuthenticated,
    settings: {
      selectedCategoryFilters,
      statusFilter,
      noCategories,
      sortBy,
      sortOrder,
      visibleColumns,
      dateFrom,
      dateTo,
    },
    applySettings: (s) => {
      if (s.selectedCategoryFilters && tasksContext?.setSelectedCategoryFilters) {
        tasksContext.setSelectedCategoryFilters(s.selectedCategoryFilters);
      }
      if (s.statusFilter && tasksContext?.setStatusFilter) {
        tasksContext.setStatusFilter(s.statusFilter);
      }
      if (s.noCategories !== undefined && tasksContext?.setNoCategories) {
        tasksContext.setNoCategories(s.noCategories);
      }
      if (s.sortBy) setSortBy(s.sortBy);
      if (s.sortOrder) setSortOrder(s.sortOrder);
      if (s.visibleColumns && setVisibleColumns) setVisibleColumns(s.visibleColumns);
      if (s.dateFrom) setDateFrom(s.dateFrom);
      if (s.dateTo) setDateTo(s.dateTo);
    },
  });

  // Refs for context functions - initialized with null, will be set in useEffect
  const fetchTasksRef = useRef(null);
  const exportToJSONRef = useRef(null);
  const exportToXLSXRef = useRef(null);
  const handleFileImportRef = useRef(null);
  const submittingRef = useRef(submitting);
  const prevSubmittingRef = useRef(submitting);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(''); // Clear error at start

      // Buduj URL z parametrami filtrowania - WSZYSTKIE filtry w backendzie
      let url = `${API_URL}/api/tasks?include_relations=true`;

      // Filtr kategorii
      if (selectedCategoryFilters.length > 0 || noCategories) {
        if (selectedCategoryFilters.length > 0) {
          const categoriesParam = selectedCategoryFilters.join(',');
          url += `&categories=${categoriesParam}`;
        }
        if (noCategories) {
          url += `&no_categories=true`;
        }
      }

      // Filtr statusu
      if (statusFilter !== 'all') {
        url += `&completed=${statusFilter === 'completed' ? 'true' : 'false'}`;
      }

      // Filtr dat (YYYY-MM-DD format)
      if (dateFrom) {
        url += `&date_from=${dateFrom}`;
      }
      if (dateTo) {
        url += `&date_to=${dateTo}`;
      }

      if (searchQuery.trim()) {
        url += `&q=${encodeURIComponent(searchQuery.trim())}`;
      }

      if (projectFilter) {
        url += `&project_id=${projectFilter}`;
      }

      const response = await fetchWithAuth(url);

      if (!response.ok) {
        // This is a real HTTP error
        if (response.status === 401) {
          setError('Sesja wygasła. Zaloguj się ponownie.');
          // Wyczyść localStorage
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          // Nie przeładowuj strony automatycznie - pozwól użytkownikowi zobaczyć komunikat
        } else if (response.status >= 500) {
          setError('Błąd serwera. Spróbuj ponownie później.');
        } else {
          setError('Nie udało się pobrać zadań. Spróbuj ponownie.');
        }
        setTasks([]);
        setHierarchicalTasks([]);
        setLoading(false);
        return; // Exit early - don't process
      }

      // Success! Parse data (empty array is valid)
      const data = await response.json();
      const tasksArray = Array.isArray(data) ? data : [];

      setTasks(tasksArray);
      // buildHierarchy will be called by useEffect when tasks/sortBy/sortOrder/dates change
      // Success - don't set error, even if array is empty!


      setLoading(false);

    } catch (err) {
      // Only catch network errors or JSON parsing errors
      // If we got here and response was OK, it's a real error
      if (err.message && err.message.includes('No authentication token')) {
        // Jeśli brak tokenu, nie wyświetlaj błędu - użytkownik może się jeszcze logować
        // Po prostu ustaw loading na false i nie rób nic więcej
        setError('');
        setTasks([]);
        setHierarchicalTasks([]);
        setLoading(false);
        return; // Wyjdź wcześnie, nie ustawiaj loading ponownie
      } else if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setError('Błąd sieci. Sprawdź połączenie.');
        setTasks([]);
        setHierarchicalTasks([]);
      } else {
        setError(err.message || 'An unexpected error occurred.');
        setTasks([]);
        setHierarchicalTasks([]);
      }
      setLoading(false);
    }
  };

  // Handle loading state when not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      setError('');
    }
  }, [isAuthenticated]);

  // Załaduj statusy zadań (kolumny kanban) i projekty (filtr)
  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/api/task-statuses`);
        if (res.ok) setTaskStatuses(await res.json());
        const pRes = await fetchWithAuth(`${API_URL}/api/projects`);
        if (pRes.ok) setProjectsList(await pRes.json());
      } catch {
        /* ignore */
      }
    })();
  }, [isAuthenticated]);

  // Load categories when filters are active (to display category names)
  useEffect(() => {
    if (isAuthenticated && (selectedCategoryFilters.length > 0 || noCategories)) {
      fetchCategories();
    }
  }, [isAuthenticated, selectedCategoryFilters.length, noCategories]);

  // Odśwież taski gdy zmienią się wybrane kategorie lub status (filtrowanie po stronie backendu)
  // Czekaj aż ustawienia się załadują przed pierwszym fetchTasks
  // ✅ ZAWSZE odświeżaj dane z backendu przy każdej zmianie filtrów/widoku
  useEffect(() => {
    if (isAuthenticated && settingsLoaded) {
      fetchTasks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryFilters, statusFilter, noCategories, dateFrom, dateTo, searchQuery, projectFilter, isAuthenticated, settingsLoaded]);

  // ✅ Odświeżaj dane przy powrocie do widoku (np. z EditTask, CreateTask)
  useEffect(() => {
    if (isAuthenticated && settingsLoaded && location.pathname === '/tasks') {
      fetchTasks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, isAuthenticated, settingsLoaded]);

  // ✅ Filtrowanie po datach jest teraz w backendzie - nie filtrujemy lokalnie
  // Odśwież sortowanie gdy zmienią się parametry sortowania lub taski
  // Ten useEffect jest jedynym miejscem wywołującym buildHierarchy
  useEffect(() => {
    if (tasks.length > 0) {
      // Backend już przefiltrował taski - używamy ich bezpośrednio
      setHierarchicalTasks(buildTaskHierarchy(tasks, sortBy, sortOrder));
    } else {
      // Jeśli nie ma tasków, wyczyść hierarchię
      setHierarchicalTasks([]);
    }
  }, [tasks, sortBy, sortOrder]);

  useTaskListScroll({ location, navigate, loading, hierarchicalTasks });

  const toggleComplete = async (taskId, currentStatus) => {
    try {
      const response = await fetchWithAuth(`${API_URL}/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ completed: !currentStatus }),
      });

      if (!response.ok) {
        throw new Error('Nie udało się zaktualizować zadania');
      }

      // Refresh tasks
      fetchTasks();
    } catch (err) {
      setError(err.message || 'Nie udało się zaktualizować zadania');
    }
  };



  // Przeniesienie zadania między kolumnami kanban (optimistic + optimistic locking)
  const moveTaskStatus = async (task, status) => {
    const prevTasks = tasks;
    // Optymistyczna aktualizacja lokalna
    setTasks((ts) =>
      ts.map((t) =>
        t.id === task.id
          ? { ...t, status_id: status.id, status, completed: !!status.is_terminal }
          : t
      )
    );
    setError('');
    try {
      const response = await fetchWithAuth(`${API_URL}/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status_id: status.id, expected_version: task.version }),
      });

      if (response.status === 409) {
        const errData = await response.json().catch(() => ({}));
        setError(errData.message || 'Konflikt edycji — odświeżono dane.');
        await fetchTasks();
        return;
      }
      if (!response.ok) {
        throw new Error('Nie udało się zmienić statusu zadania');
      }
      const updated = await response.json();
      // Zsynchronizuj wersję, by kolejne przeciągnięcia nie powodowały 409
      setTasks((ts) =>
        ts.map((t) => (t.id === task.id ? { ...t, version: updated.version ?? t.version } : t))
      );
    } catch (err) {
      setTasks(prevTasks); // revert
      setError(err.message || 'Nie udało się zmienić statusu zadania');
    }
  };

  const handleEdit = (task) => {
    openEditTask(task.id);
  };

  const handleDeleteTaskClick = (taskId) => {
    setTaskToDeleteId(taskId);
  };

  const handleConfirmDeleteTask = async () => {
    const taskId = taskToDeleteId;
    setTaskToDeleteId(null); 

    try {
      setError('');
      const response = await fetchWithAuth(`${API_URL}/api/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Nie udało się usunąć zadania');
      }

      fetchTasks();
    } catch (err) {
      setError(err.message || 'Nie udało się usunąć zadania');
    }
  };


  // ========== CATEGORY MANAGEMENT FUNCTIONS ==========

  const fetchCategories = async () => {
    try {
      const response = await fetchWithAuth(`${API_URL}/api/categories`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch categories');
      }
      const data = await response.json();
      setCategories(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch categories');
    }
  };


  const exportToJSON = async () => {
    try {
      setError('');
      await exportTasksToJSON(fetchWithAuth);
    } catch (err) {
      setError(err.message || 'Nie udało się wyeksportować zadań');
    }
  };

  const exportToXLSX = async () => {
    try {
      setError('');
      await exportTasksToXLSX(fetchWithAuth);
    } catch (err) {
      setError(err.message || 'Nie udało się wyeksportować zadań');
    }
  };

  const importFromJSON = async (file) => {
    try {
      setError('');
      setSubmitting(true);

      const importedCount = await importTasksFromJSON(file, fetchWithAuth);

      await fetchTasks();
      alert(`Zaimportowano zadań: ${importedCount}`);
    } catch (err) {
      setError(err.message || 'Nie udało się zaimportować zadań');
    } finally {
      setSubmitting(false);
    }
  };

  const importFromXLSX = async (file) => {
    try {
      setError('');
      setSubmitting(true);

      const importedCount = await importTasksFromXLSX(file, fetchWithAuth);

      await fetchTasks();
      alert(`Zaimportowano zadań: ${importedCount}`);
    } catch (err) {
      setError(err.message || 'Nie udało się zaimportować zadań');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.json')) {
      await importFromJSON(file);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      await importFromXLSX(file);
    } else {
      setError('Nieobsługiwany format pliku. Użyj .json lub .xlsx.');
    }

    e.target.value = '';
  };

  // Update refs when values change (no dependencies = runs every render but doesn't cause re-render)
  // This must be done after functions are defined, but refs are declared at the top
  if (fetchTasksRef.current !== fetchTasks) fetchTasksRef.current = fetchTasks;
  if (exportToJSONRef.current !== exportToJSON) exportToJSONRef.current = exportToJSON;
  if (exportToXLSXRef.current !== exportToXLSX) exportToXLSXRef.current = exportToXLSX;
  if (handleFileImportRef.current !== handleFileImport) handleFileImportRef.current = handleFileImport;
  submittingRef.current = submitting;

  // No wrapper needed - setVisibleColumns comes from context and persists

  // Expose functions to context - only set once, then always update reactive values
  // MUST be before any early returns to maintain hook order
  useEffect(() => {
    if (!setTasksContext) return;

    if (!contextInitialized.current) {
      contextInitialized.current = true;
      setTasksContext({
        onRefresh: () => fetchTasksRef.current(),
        onExportJSON: () => exportToJSONRef.current(),
        onExportXLSX: () => exportToXLSXRef.current(),
        onImport: (e) => handleFileImportRef.current(e),
        submitting: submittingRef.current,
        sortBy,
        setSortBy,
        sortOrder,
        setSortOrder,
        dateFrom,
        setDateFrom,
        dateTo,
        setDateTo,
        selectedCategoryFilters,
        statusFilter,
        noCategories
      });
    } else {
      // Always update all reactive values when any of them change
      prevSubmittingRef.current = submitting;
      setTasksContext(prev => ({
        ...prev,
        submitting,
        sortBy,
        setSortBy,
        sortOrder,
        setSortOrder,
        dateFrom,
        setDateFrom,
        dateTo,
        setDateTo,
        selectedCategoryFilters,
        statusFilter,
        noCategories,
      }));
    }
  }, [setTasksContext, submitting, sortBy, sortOrder, dateFrom, dateTo, selectedCategoryFilters, statusFilter, noCategories]);
  // visibleColumns and setVisibleColumns now come from TasksProvider context, not local state

  // Don't show error if we successfully loaded an empty list
  const shouldShowError = error && !(!loading && tasks.length === 0 && hierarchicalTasks.length === 0);

  if (loading) {
  return (
    <div className="w-full rounded-2xl bg-white py-16 px-4 text-center shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800 flex flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600 dark:border-slate-800 dark:border-t-indigo-500" />
      
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">
        Przygotowywanie zadań...
      </p>
    </div>
  );
}

  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/95 sm:p-6">
      <TasksHeader />

      {shouldShowError && (
        <div
          className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-center text-red-700"
          role="alert"
        >
          {error}
        </div>
      )}

      <TasksToolbar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        onOpenFilters={() => navigate('/tasks/filter')}
      />

      <ActiveTaskFilters
        selectedCategoryFilters={selectedCategoryFilters}
        noCategories={noCategories}
        categories={categories}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium text-slate-600 dark:text-slate-300">Projekt:</span>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">Wszystkie projekty</option>
            {projectsList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <div className="inline-flex gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              viewMode === 'table'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <Table2 className="h-4 w-4" />
            Tabela
          </button>
          <button
            type="button"
            onClick={() => setViewMode('kanban')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              viewMode === 'kanban'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            Kanban
          </button>
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <TasksKanban
          tasks={tasks}
          statuses={taskStatuses}
          onMove={moveTaskStatus}
          navigate={navigate}
          handleEdit={handleEdit}
          handleDeleteTask={handleDeleteTaskClick}
        />
      ) : (
        <TasksTable
          hierarchicalTasks={hierarchicalTasks}
          visibleColumns={visibleColumns}
          formatDateOnly={formatDateOnly}
          expandedNotesTaskId={expandedNotesTaskId}
          setExpandedNotesTaskId={setExpandedNotesTaskId}
          toggleComplete={toggleComplete}
          navigate={navigate}
          handleEdit={handleEdit}
          handleDeleteTask={handleDeleteTaskClick}
        />
      )}

      {taskToDeleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity pointer-events-auto"
            onClick={() => setTaskToDeleteId(null)}
          />
          
          <div className="relative z-10 my-auto w-full max-w-md transform overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-left align-middle shadow-xl transition-all dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold leading-6 text-slate-900 dark:text-slate-100">
                Usunąć zadanie?
              </h3>
            </div>
            
            <div className="mt-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Czy na pewno chcesz bezpowrotnie usunąć to zadanie? Tej akcji nie będzie można cofnąć.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setTaskToDeleteId(null)}
              >
                Anuluj
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleConfirmDeleteTask}
                className="bg-red-600 hover:bg-red-500 text-white border-none dark:bg-red-600 dark:hover:bg-red-500"
              >
                Usuń zadanie
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default TasksGrid;

