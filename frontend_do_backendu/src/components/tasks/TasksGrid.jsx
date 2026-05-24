import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import TasksToolbar from './TasksToolbar';
import ActiveTaskFilters from './ActiveTaskFilters';
import { useTasksContext } from '../../context/TasksContext';
import TasksTable from './TasksTable';
import { buildTaskHierarchy, formatDateOnly } from './taskUtils';
import { API_URL, fetchWithAuth } from '../../api/authFetch';
import TasksHeader from './TasksHeader';
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
  // Filters are now managed via context and FilterView component
  const selectedCategoryFilters = tasksContext?.selectedCategoryFilters || [];
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
  const [settingsLoaded, setSettingsLoaded] = useState(false); // Track if settings were loaded
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNotesTaskId, setExpandedNotesTaskId] = useState(null);
  const saveSettingsTimeoutRef = useRef(null);

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

      const response = await fetchWithAuth(url);

      if (!response.ok) {
        // This is a real HTTP error
        if (response.status === 401) {
          setError('Authentication failed. Please log in again.');
          // Wyczyść localStorage
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          // Nie przeładowuj strony automatycznie - pozwól użytkownikowi zobaczyć komunikat
        } else if (response.status >= 500) {
          setError('Server error. Please try again later.');
        } else {
          setError('Failed to fetch tasks. Please try again.');
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
        setError('Network error. Please check your connection.');
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

  // Load categories when filters are active (to display category names)
  useEffect(() => {
    if (isAuthenticated && (selectedCategoryFilters.length > 0 || noCategories)) {
      fetchCategories();
    }
  }, [isAuthenticated, selectedCategoryFilters.length, noCategories]);

  // Załaduj ustawienia użytkownika przy starcie (po zalogowaniu)
  useEffect(() => {
    if (isAuthenticated) {
      setSettingsLoaded(false); // Reset flagi przy logowaniu
      loadUserSettings();
    } else {
      // Jeśli nie zalogowany, oznacz ustawienia jako załadowane (używamy domyślnych)
      setSettingsLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Odśwież taski gdy zmienią się wybrane kategorie lub status (filtrowanie po stronie backendu)
  // Czekaj aż ustawienia się załadują przed pierwszym fetchTasks
  // ✅ ZAWSZE odświeżaj dane z backendu przy każdej zmianie filtrów/widoku
  useEffect(() => {
    if (isAuthenticated && settingsLoaded) {
      fetchTasks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryFilters, statusFilter, noCategories, dateFrom, dateTo, searchQuery, isAuthenticated, settingsLoaded]);

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

  // ✅ Przewiń do taska po edycji/dodaniu subtaska
  useEffect(() => {
    if (location.state?.scrollToTaskId && hierarchicalTasks.length > 0 && !loading) {
      const taskId = location.state.scrollToTaskId;
      const taskElement = document.getElementById(`task-${taskId}`);

      if (taskElement) {
        // Opóźnienie aby upewnić się, że DOM jest gotowy
        setTimeout(() => {
          // Uwzględnij wysokość sticky headera
          const headerHeight = document.querySelector('.app-header')?.offsetHeight || 0;
          const elementPosition = taskElement.getBoundingClientRect().top + window.pageYOffset;
          const offsetPosition = elementPosition - headerHeight - 20; // 20px dodatkowego odstępu

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });

          // Podświetl taska na chwilę
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

      // Wyczyść state po przewinięciu
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [hierarchicalTasks, loading, location.state, navigate]);

  // ✅ Przywróć pozycję scrolla po powrocie z widoku filtrów
  useEffect(() => {
    if (location.pathname === '/tasks' && !loading && hierarchicalTasks.length > 0) {
      const savedScrollPosition = localStorage.getItem('tasksScrollPosition');
      if (savedScrollPosition) {
        const scrollPosition = parseInt(savedScrollPosition, 10);
        // Użyj setTimeout aby upewnić się, że DOM jest gotowy
        setTimeout(() => {
          window.scrollTo({
            top: scrollPosition,
            behavior: 'auto' // Użyj 'auto' zamiast 'smooth' dla natychmiastowego przywrócenia
          });
          // Wyczyść zapisaną pozycję po przywróceniu
          localStorage.removeItem('tasksScrollPosition');
        }, 100);
      }
    }
  }, [location.pathname, loading, hierarchicalTasks.length]);

  // Automatyczne zapisywanie ustawień przy zmianach (z debounce)
  useEffect(() => {
    if (isAuthenticated) {
      saveUserSettings();
    }

    // Cleanup: wyczyść timeout przy unmount lub zmianie zależności
    return () => {
      if (saveSettingsTimeoutRef.current) {
        clearTimeout(saveSettingsTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryFilters, statusFilter, noCategories, sortBy, sortOrder, visibleColumns, dateFrom, dateTo, isAuthenticated]);

  // Funkcja kompresji obrazu
  const compressImage = (file, maxWidth = 1920, maxHeight = 1080, quality = 0.75) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Oblicz nowe wymiary zachowując proporcje
          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Konwertuj na base64 z kompresją
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  // Funkcja do ładowania ustawień użytkownika
  const loadUserSettings = async () => {
    if (!isAuthenticated) {
      setSettingsLoaded(true);
      return;
    }

    try {
      const response = await fetchWithAuth(`${API_URL}/api/user/settings`);

      if (!response.ok) {
        console.warn('Failed to load user settings, using defaults');
        setSettingsLoaded(true);
        return;
      }

      const data = await response.json();
      if (data.settings && Object.keys(data.settings).length > 0) {
        // Załaduj ustawienia do contextu
        if (data.settings.selectedCategoryFilters && tasksContext?.setSelectedCategoryFilters) {
          tasksContext.setSelectedCategoryFilters(data.settings.selectedCategoryFilters);
        }
        if (data.settings.statusFilter && tasksContext?.setStatusFilter) {
          tasksContext.setStatusFilter(data.settings.statusFilter);
        }
        if (data.settings.noCategories !== undefined && tasksContext?.setNoCategories) {
          tasksContext.setNoCategories(data.settings.noCategories);
        }
        if (data.settings.sortBy) {
          setSortBy(data.settings.sortBy);
        }
        if (data.settings.sortOrder) {
          setSortOrder(data.settings.sortOrder);
        }
        if (data.settings.visibleColumns) {
          setVisibleColumns(data.settings.visibleColumns);
        }
        if (data.settings.dateFrom) {
          setDateFrom(data.settings.dateFrom);
        }
        if (data.settings.dateTo) {
          setDateTo(data.settings.dateTo);
        }
      }
      setSettingsLoaded(true);
    } catch (err) {
      console.warn('Error loading user settings:', err);
      setSettingsLoaded(true);
      // Nie pokazuj błędu użytkownikowi, po prostu użyj domyślnych ustawień
    }
  };

  // Funkcja do zapisywania ustawień użytkownika (z debounce)
  const saveUserSettings = () => {
    if (!isAuthenticated) return;

    // Wyczyść poprzedni timeout
    if (saveSettingsTimeoutRef.current) {
      clearTimeout(saveSettingsTimeoutRef.current);
    }

    // Ustaw nowy timeout - zapisz po 1 sekundzie od ostatniej zmiany
    saveSettingsTimeoutRef.current = setTimeout(async () => {
      try {
        const settings = {
          selectedCategoryFilters,
          statusFilter,
          sortBy,
          sortOrder,
          visibleColumns,
          dateFrom,
          dateTo
        };

        const response = await fetchWithAuth(`${API_URL}/api/user/settings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            settings: settings
          })
        });

        if (!response.ok) {
          console.warn('Failed to save user settings');
        }
      } catch (err) {
        console.warn('Error saving user settings:', err);
        // Nie pokazuj błędu użytkownikowi
      }
    }, 1000); // 1 sekunda debounce
  };

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
        throw new Error('Failed to update task');
      }

      // Refresh tasks
      fetchTasks();
    } catch (err) {
      setError(err.message || 'Failed to update task');
    }
  };



  const handleEdit = (task) => {
    navigate(`/tasks/${task.id}/edit`);
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) {
      return;
    }

    try {
      setError('');
      const response = await fetchWithAuth(`${API_URL}/api/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete task');
      }

      // Refresh tasks
      fetchTasks();
    } catch (err) {
      setError(err.message || 'Failed to delete task');
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


  // ========== TASK CATEGORY MANAGEMENT FUNCTIONS ==========

  const handleToggleTaskCategory = async (taskId, categoryId, isAssigned) => {
    try {
      if (isAssigned) {
        // Remove category - check if task has subtasks that have this category
        const currentTask = tasks.find(t => t.id === taskId);
        const outgoingRelations = currentTask?.related_tasks?.outgoing || [];
        const subtaskIds = outgoingRelations.map(rel => rel.target_task_id);

        let shouldRemoveFromSubtasks = false;

        if (subtaskIds.length > 0) {
          // Check if any subtasks have this category
          const subtasksWithCategory = subtaskIds.filter(subtaskId => {
            const subtask = tasks.find(t => t.id === subtaskId);
            if (!subtask) return false;
            const subtaskCategories = subtask.categories || [];
            return subtaskCategories.some(cat => cat.id === categoryId);
          });

          if (subtasksWithCategory.length > 0) {
            // Ask user if they want to remove category from all subtasks
            const categoryName = categories.find(cat => cat.id === categoryId)?.name || 'this category';
            const confirmMessage = `This task has ${subtasksWithCategory.length} subtask(s) that have ${categoryName}. Do you want to remove ${categoryName} from all subtasks as well?`;
            shouldRemoveFromSubtasks = window.confirm(confirmMessage);
          }
        }

        // Remove category from main task
        const response = await fetchWithAuth(`${API_URL}/api/tasks/${taskId}/categories/${categoryId}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to remove category');
        }

        // If user confirmed, remove category from all subtasks that have it
        if (shouldRemoveFromSubtasks && subtaskIds.length > 0) {
          const removePromises = subtaskIds.map(subtaskId => {
            const subtask = tasks.find(t => t.id === subtaskId);
            if (!subtask) return Promise.resolve();
            const subtaskCategories = subtask.categories || [];
            const hasCategory = subtaskCategories.some(cat => cat.id === categoryId);
            if (hasCategory) {
              return fetchWithAuth(`${API_URL}/api/tasks/${subtaskId}/categories/${categoryId}`, {
                method: 'DELETE',
              });
            }
            return Promise.resolve();
          });

          // Wait for all removals to complete
          const results = await Promise.allSettled(removePromises);
          const failed = results.filter(r => r.status === 'rejected' || (r.value && !r.value.ok));
          if (failed.length > 0) {
            console.warn(`Failed to remove category from ${failed.length} subtask(s)`);
          }
        }

      } else {
        // Add category - check if task has subtasks that don't have this category
        const currentTask = tasks.find(t => t.id === taskId);
        const outgoingRelations = currentTask?.related_tasks?.outgoing || [];
        const subtaskIds = outgoingRelations.map(rel => rel.target_task_id);

        let shouldAssignToSubtasks = false;

        if (subtaskIds.length > 0) {
          // Check if all subtasks have this category
          const subtasksWithoutCategory = subtaskIds.filter(subtaskId => {
            const subtask = tasks.find(t => t.id === subtaskId);
            if (!subtask) return false;
            const subtaskCategories = subtask.categories || [];
            return !subtaskCategories.some(cat => cat.id === categoryId);
          });

          if (subtasksWithoutCategory.length > 0) {
            // Ask user if they want to assign category to all subtasks
            const categoryName = categories.find(cat => cat.id === categoryId)?.name || 'this category';
            const confirmMessage = `This task has ${subtasksWithoutCategory.length} subtask(s) that don't have ${categoryName}. Do you want to assign ${categoryName} to all subtasks as well?`;
            shouldAssignToSubtasks = window.confirm(confirmMessage);
          }
        }

        // Add category to main task
        const response = await fetchWithAuth(`${API_URL}/api/tasks/${taskId}/categories`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ category_id: categoryId }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to add category');
        }

        // If user confirmed, assign category to all subtasks
        if (shouldAssignToSubtasks && subtaskIds.length > 0) {
          const assignPromises = subtaskIds.map(subtaskId =>
            fetchWithAuth(`${API_URL}/api/tasks/${subtaskId}/categories`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ category_id: categoryId }),
            })
          );

          // Wait for all assignments to complete
          const results = await Promise.allSettled(assignPromises);
          const failed = results.filter(r => r.status === 'rejected' || (r.value && !r.value.ok));
          if (failed.length > 0) {
            console.warn(`Failed to assign category to ${failed.length} subtask(s)`);
          }
        }

      }
      fetchTasks(); // Refresh tasks to update categories
    } catch (err) {
      setError(err.message || 'Failed to update task category');
    }
  };

  const exportToJSON = async () => {
    try {
      setError('');
      await exportTasksToJSON(fetchWithAuth);
    } catch (err) {
      setError(err.message || 'Failed to export tasks');
    }
  };

  const exportToXLSX = async () => {
    try {
      setError('');
      await exportTasksToXLSX(fetchWithAuth);
    } catch (err) {
      setError(err.message || 'Failed to export tasks');
    }
  };

  const importFromJSON = async (file) => {
    try {
      setError('');
      setSubmitting(true);

      const importedCount = await importTasksFromJSON(file, fetchWithAuth);

      await fetchTasks();
      alert(`Successfully imported ${importedCount} task(s)`);
    } catch (err) {
      setError(err.message || 'Failed to import tasks');
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
      alert(`Successfully imported ${importedCount} task(s)`);
    } catch (err) {
      setError(err.message || 'Failed to import tasks');
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
      setError('Unsupported file format. Please use .json or .xlsx files.');
    }

    e.target.value = '';
  };

  // Get available tasks for subtask selection (exclude current task and its children)
  const getAvailableTasksForSubtask = (parentTaskId) => {
    if (!parentTaskId) return [];

    // Find the parent task
    const parentTask = tasks.find(t => t.id === parentTaskId);
    if (!parentTask) return [];

    // Get all child IDs recursively
    const getAllChildIds = (taskId, visited = new Set()) => {
      if (visited.has(taskId)) return []; // Prevent cycles
      visited.add(taskId);

      const task = tasks.find(t => t.id === taskId);
      if (!task) return [];

      const relations = task.related_tasks || {};
      const outgoing = relations.outgoing || [];
      const incoming = relations.incoming || [];

      let childIds = [];
      outgoing.forEach(rel => {
        childIds.push(rel.target_task_id);
        childIds = childIds.concat(getAllChildIds(rel.target_task_id, visited));
      });
      incoming.forEach(rel => {
        childIds.push(rel.source_task_id);
        childIds = childIds.concat(getAllChildIds(rel.source_task_id, visited));
      });

      return childIds;
    };

    const excludeIds = new Set([parentTaskId, ...getAllChildIds(parentTaskId)]);

    // Filter out: current task, its children, and tasks that would create cycles
    return tasks.filter(task => {
      // Don't include the parent task itself
      if (task.id === parentTaskId) return false;
      // Don't include children (would create cycle)
      if (excludeIds.has(task.id)) return false;
      // Don't include tasks that already have this task as a child (would create cycle)
      const taskRelations = task.related_tasks || {};
      const taskOutgoing = taskRelations.outgoing || [];
      const taskIncoming = taskRelations.incoming || [];
      const hasRelation = taskOutgoing.some(rel => rel.target_task_id === parentTaskId) ||
        taskIncoming.some(rel => rel.source_task_id === parentTaskId);
      return !hasRelation;
    });
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
      <div className="w-full rounded-xl bg-white p-8 text-center text-slate-600 shadow-md">
        <p>Ładowanie zadań…</p>
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

      <TasksTable
        hierarchicalTasks={hierarchicalTasks}
        visibleColumns={visibleColumns}
        formatDateOnly={formatDateOnly}
        expandedNotesTaskId={expandedNotesTaskId}
        setExpandedNotesTaskId={setExpandedNotesTaskId}
        toggleComplete={toggleComplete}
        navigate={navigate}
        handleEdit={handleEdit}
        handleDeleteTask={handleDeleteTask}
      />
    </div>
  );
}

export default TasksGrid;

