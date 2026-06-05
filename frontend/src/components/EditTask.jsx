import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Button from './ui/Button';
import { Card, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { Field, FieldLabel, FieldError } from './ui/Field';
import TextInput from './ui/TextInput';
import Select from './ui/Select';
import { API_URL, fetchWithAuth } from '../api/authFetch';
import { isClient, canManage } from '../constants/roles';
import { PRIORITY_OPTIONS } from '../constants/priorities';
import { compressImage } from '../utils/image';
import TaskCommentsCard from './tasks/edit/TaskCommentsCard';
import TaskActivityCard from './tasks/edit/TaskActivityCard';
import TaskAttachmentsCard from './tasks/edit/TaskAttachmentsCard';
import TaskRelationsCard from './tasks/edit/TaskRelationsCard';

function formatDateTimeForInput(value) {
  if (!value) return '';

  const rawValue = String(value);

  if (rawValue.includes('T')) {
    return rawValue.slice(0, 16);
  }

  return `${rawValue}T00:00`;
}

function parseDateTimeInput(value) {
  if (!value) return null;

  const rawValue = String(value);
  const parsed = new Date(rawValue.includes('T') ? rawValue : `${rawValue}T00:00`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function EditTask({ isAuthenticated, drawer = false, taskId = null, onClose, onSaved }) {
  const params = useParams();
  const id = taskId ?? params.id;
  const navigate = useNavigate();

  // W trybie drawer zamykanie/zapis idą przez callbacki zamiast nawigacji.
  const closeView = useCallback(
    () => (onClose ? onClose() : navigate('/tasks')),
    [onClose, navigate],
  );
  const finishSaved = (savedId) =>
    onSaved ? onSaved(savedId) : navigate('/tasks', { state: { scrollToTaskId: savedId } });
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [tasks, setTasks] = useState([]);
  const editNotesRef = useRef(null);

  const [editingTask, setEditingTask] = useState({
    id: null,
    topic: '',
    notes: '',
    deadline: '',
    planned_date: '',
    completed: false,
    categories: [],
    related_tasks: {},
    status_id: '',
    priority: 'medium',
    assignee_user_id: '',
    group_id: '',
    project_id: '',
    version: 1,
  });

  const [taskStatuses, setTaskStatuses] = useState([]);
  const [assignUsers, setAssignUsers] = useState([]);
  const [groupsList, setGroupsList] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [comments, setComments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [meUser, setMeUser] = useState(null);


  // Pobierz taska
  const fetchTask = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetchWithAuth(`${API_URL}/api/tasks/${id}?include_relations=true`);

      if (!response.ok) {
        if (response.status === 404) {
          setError('Nie znaleziono zadania');
          closeView();
          return;
        }
        if (response.status === 401) {
          setError('Sesja wygasła. Zaloguj się ponownie.');
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          navigate('/');
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Nie udało się pobrać zadania');
      }

      const taskData = await response.json();
      setTask(taskData);

      setEditingTask({
        id: taskData.id,
        topic: taskData.topic || '',
        notes: taskData.notes || '',
        deadline: formatDateTimeForInput(taskData.deadline),
        planned_date: formatDateTimeForInput(taskData.planned_date),
        completed: taskData.completed || false,
        categories: taskData.categories || [],
        related_tasks: taskData.related_tasks || {},
        status_id: taskData.status?.id ?? taskData.status_id ?? '',
        priority: taskData.priority || 'medium',
        assignee_user_id:
          taskData.assignee_user_id != null ? taskData.assignee_user_id : '',
        group_id: taskData.group_id != null ? taskData.group_id : '',
        project_id: taskData.project_id != null ? taskData.project_id : '',
        version: taskData.version ?? 1,
      });
    } catch (err) {
      setError(err.message || 'Nie udało się pobrać zadania');
    } finally {
      setLoading(false);
    }
  }, [id, closeView, navigate]);

  // Pobierz wszystkie taski (dla subtasków)
  const fetchAllTasks = useCallback(async () => {
    try {
      const response = await fetchWithAuth(`${API_URL}/api/tasks?include_relations=true`);
      if (response.ok) {
        const data = await response.json();
        setTasks(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    }
  }, []);

  // Pobierz kategorie
  const fetchCategories = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (isAuthenticated && id) {
      fetchTask();
      fetchAllTasks();
      fetchCategories();
    }
  }, [id, isAuthenticated, fetchTask, fetchAllTasks, fetchCategories]);

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      const [stRes, pRes, meRes] = await Promise.all([
        fetchWithAuth(`${API_URL}/api/task-statuses`),
        fetchWithAuth(`${API_URL}/api/projects`),
        fetchWithAuth(`${API_URL}/api/auth/me`),
      ]);
      if (stRes.ok) setTaskStatuses(await stRes.json());
      if (pRes.ok) setProjectsList(await pRes.json());
      if (!meRes.ok) return;
      const me = await meRes.json();
      setMeUser(me);
      if (isClient(me)) {
        setAssignUsers([]);
        setGroupsList([]);
        return;
      }
      const [uRes, gRes] = await Promise.all([
        fetchWithAuth(`${API_URL}/api/users`),
        fetchWithAuth(`${API_URL}/api/groups`),
      ]);
      if (uRes.ok) setAssignUsers(await uRes.json());
      if (gRes.ok) setGroupsList(await gRes.json());
    })();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !id) return;
    (async () => {
      const [cRes, aRes, atRes] = await Promise.all([
        fetchWithAuth(`${API_URL}/api/tasks/${id}/comments`),
        fetchWithAuth(`${API_URL}/api/tasks/${id}/activities`),
        fetchWithAuth(`${API_URL}/api/tasks/${id}/attachments`),
      ]);
      if (cRes.ok) setComments(await cRes.json());
      if (aRes.ok) setActivities(await aRes.json());
      if (atRes.ok) setAttachments(await atRes.json());
    })();
  }, [isAuthenticated, id, task?.id, task?.version]);

  // Ustaw zawartość contentEditable dla notes po załadowaniu taska
  useEffect(() => {
    if (task && editNotesRef.current) {
      editNotesRef.current.innerHTML = task.notes || '';
    }
  }, [task]);

  const handleEditInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditingTask(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setError('');
  };

  const parseDateOnly = (value) => parseDateTimeInput(value);

  const validateDeadlineHierarchyBeforeUpdate = () => {
    const editedDeadline = parseDateOnly(editingTask.deadline);
    const outgoingRelations = editingTask.related_tasks?.outgoing || [];
    const incomingRelations = editingTask.related_tasks?.incoming || [];

    if (editedDeadline && incomingRelations.length > 0) {
      const violatingParent = incomingRelations
        .map((rel) => tasks.find((item) => item.id === rel.source_task_id))
        .find((parentTask) => {
          const parentDeadline = parseDateOnly(parentTask?.deadline);
          return parentDeadline && editedDeadline > parentDeadline;
        });

      if (violatingParent) {
        return `Podzadanie nie może mieć deadline późniejszego niż zadanie nadrzędne "${violatingParent.topic}".`;
      }
    }

    if (editedDeadline && outgoingRelations.length > 0) {
      const violatingSubtask = outgoingRelations
        .map((rel) => tasks.find((item) => item.id === rel.target_task_id))
        .find((subtask) => {
          const subtaskDeadline = parseDateOnly(subtask?.deadline);
          return subtaskDeadline && subtaskDeadline > editedDeadline;
        });

      if (violatingSubtask) {
        return `Zadanie podrzędne "${violatingSubtask.topic}" ma deadline późniejszy niż deadline tego zadania.`;
      }
    }

    return null;
  };

  const handleUpdateTask = async (e) => {
    e.preventDefault();

    if (!editingTask.topic.trim()) {
      setError('Temat jest wymagany');
      return;
    }

    const deadlineHierarchyError = validateDeadlineHierarchyBeforeUpdate();
    if (deadlineHierarchyError) {
      setError(deadlineHierarchyError);
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const notesHtml = editNotesRef.current
        ? editNotesRef.current.innerHTML
        : editingTask.notes || '';

      const taskData = {
        topic: editingTask.topic,
        notes: notesHtml,
        completed: editingTask.completed,
        expected_version: editingTask.version,
        priority: editingTask.priority,
      };

      const outgoingRelations = editingTask.related_tasks?.outgoing || [];
      const openSubtasks = outgoingRelations
        .map((rel) => tasks.find((item) => item.id === rel.target_task_id))
        .filter((item) => item && !item.completed);

      const selectedStatus = taskStatuses.find((status) => String(status.id) === String(editingTask.status_id));
      const willCloseTask = !task.completed && (editingTask.completed || selectedStatus?.is_terminal);

      if (willCloseTask && openSubtasks.length > 0) {
        const confirmed = window.confirm(
          `Czy na pewno chcesz zamknąć zadanie? Wszystkie otwarte podzadania tego zadania zostaną zamknięte. Liczba podzadań: ${openSubtasks.length}`
        );

        if (!confirmed) {
          setSubmitting(false);
          return;
        }

        taskData.cascade_subtasks = true;
      }

      if (editingTask.deadline) {
        taskData.deadline = editingTask.deadline;
      } else {
        taskData.deadline = null;
      }

      if (editingTask.planned_date) {
        taskData.planned_date = editingTask.planned_date;
      } else {
        taskData.planned_date = null;
      }

      if (editingTask.status_id !== '' && editingTask.status_id != null) {
        taskData.status_id = Number(editingTask.status_id);
      }

      if (editingTask.assignee_user_id === '' || editingTask.assignee_user_id == null) {
        taskData.assignee_user_id = null;
      } else {
        taskData.assignee_user_id = Number(editingTask.assignee_user_id);
      }

      if (editingTask.group_id === '' || editingTask.group_id == null) {
        taskData.group_id = null;
      } else {
        taskData.group_id = Number(editingTask.group_id);
      }

      if (editingTask.project_id === '' || editingTask.project_id == null) {
        taskData.project_id = null;
      } else {
        taskData.project_id = Number(editingTask.project_id);
      }

      const response = await fetchWithAuth(`${API_URL}/api/tasks/${editingTask.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      });

      if (response.status === 409) {
        const errData = await response.json().catch(() => ({}));

        if (errData.error === 'open_subtasks') {
          const confirmed = window.confirm(
            errData.message || 'To zadanie ma otwarte podzadania. Zamknąć je razem z zadaniem?'
          );

          if (!confirmed) {
            return;
          }

          const retryResponse = await fetchWithAuth(`${API_URL}/api/tasks/${editingTask.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...taskData,
              cascade_subtasks: true,
            }),
          });

          if (!retryResponse.ok) {
            const retryError = await retryResponse.json().catch(() => ({}));
            throw new Error(retryError.error || 'Nie udało się zamknąć zadania z podzadaniami');
          }

          const updated = await retryResponse.json();
          setEditingTask((prev) => ({ ...prev, version: updated.version ?? prev.version }));
          finishSaved(editingTask.id);
          return;
        }

        throw new Error(errData.message || errData.error || 'Konflikt wersji — odśwież stronę.');
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Nie udało się zaktualizować zadania');
      }
      const updated = await response.json();
      setEditingTask((prev) => ({ ...prev, version: updated.version ?? prev.version }));

      const originalCategories = task.categories || [];
      const newCategories = editingTask.categories || [];

      const originalCategoryIds = new Set(originalCategories.map(cat => cat.id));
      const newCategoryIds = new Set(newCategories.map(cat => cat.id));

      const categoriesToAdd = newCategories.filter(cat => !originalCategoryIds.has(cat.id));

      const categoriesToRemove = originalCategories.filter(cat => !newCategoryIds.has(cat.id));

      const categoryPromises = [];

      for (const category of categoriesToAdd) {
        categoryPromises.push(
          fetchWithAuth(`${API_URL}/api/tasks/${editingTask.id}/categories`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ category_id: category.id }),
          })
        );
      }

      for (const category of categoriesToRemove) {
        categoryPromises.push(
          fetchWithAuth(`${API_URL}/api/tasks/${editingTask.id}/categories/${category.id}`, {
            method: 'DELETE',
          })
        );
      }

      const categoryResults = await Promise.allSettled(categoryPromises);

      const failed = categoryResults.filter(r => r.status === 'rejected' || (r.value && !r.value.ok));
      if (failed.length > 0) {
        console.warn(`Failed to update ${failed.length} category/categories`);
      }

      finishSaved(editingTask.id);
    } catch (err) {
      setError(err.message || 'Nie udało się zaktualizować zadania');
    } finally {
      setSubmitting(false);
    }
  };

  const refreshCommentSide = async () => {
    if (!id) return;
    const [cRes, aRes, atRes] = await Promise.all([
      fetchWithAuth(`${API_URL}/api/tasks/${id}/comments`),
      fetchWithAuth(`${API_URL}/api/tasks/${id}/activities`),
      fetchWithAuth(`${API_URL}/api/tasks/${id}/attachments`),
    ]);
    if (cRes.ok) setComments(await cRes.json());
    if (aRes.ok) setActivities(await aRes.json());
    if (atRes.ok) setAttachments(await atRes.json());
  };

  const handleCancelEdit = () => {
    closeView();
  };

  const handleToggleTaskCategory = (categoryId, isAssigned) => {
    setEditingTask(prev => {
      const currentCategories = prev.categories || [];

      if (isAssigned) {
        return {
          ...prev,
          categories: currentCategories.filter(cat => cat.id !== categoryId)
        };
      } else {
        const category = categories.find(cat => cat.id === categoryId);
        if (category) {
          return {
            ...prev,
            categories: [...currentCategories, category]
          };
        }
      }
      return prev;
    });
    setError('');
  };

  const handleCreateSubtaskRelation = async (taskId, targetTaskId) => {
    try {
      setError('');

      const response = await fetchWithAuth(`${API_URL}/api/tasks/${taskId}/relations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target_task_id: parseInt(targetTaskId)
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Nie udało się dodać podzadania');
      }

      await fetchTask();
      await fetchAllTasks();
      finishSaved(parseInt(targetTaskId));
    } catch (err) {
      setError(err.message || 'Nie udało się dodać podzadania');
    }
  };

  const handleRemoveSubtaskRelation = async (taskId, relationId) => {
    if (!window.confirm('Czy na pewno usunąć to podzadanie?')) {
      return;
    }

    try {
      setError('');

      const response = await fetchWithAuth(`${API_URL}/api/relations/${relationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Nie udało się usunąć podzadania');
      }

      await fetchTask();
      await fetchAllTasks();
    } catch (err) {
      setError(err.message || 'Nie udało się usunąć podzadania');
    }
  };

  if (loading) {
    return (
      <div className={drawer ? 'w-full' : 'mx-auto w-full max-w-4xl'}>
        <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className={drawer ? 'w-full space-y-4' : 'mx-auto w-full max-w-4xl space-y-4'}>
        <Button variant="ghost" onClick={closeView}>
          <ArrowLeft className="h-4 w-4" />
          Wróć do zadań
        </Button>
        <FieldError>Nie znaleziono zadania.</FieldError>
      </div>
    );
  }

  const outgoingRelations = editingTask.related_tasks?.outgoing || [];
  const incomingRelations = editingTask.related_tasks?.incoming || [];

  const handleCreateParentRelation = async (parentTaskId, childTaskId) => {
    try {
      setError('');

      const response = await fetchWithAuth(`${API_URL}/api/tasks/${parentTaskId}/relations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target_task_id: parseInt(childTaskId)
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Nie udało się dodać zadania nadrzędnego');
      }

      await fetchTask();
      await fetchAllTasks();
      finishSaved(parseInt(childTaskId));
    } catch (err) {
      setError(err.message || 'Nie udało się dodać zadania nadrzędnego');
    }
  };

  // Funkcja do usuwania parent taska
  const handleRemoveParentRelation = async (relationId) => {
    if (!window.confirm('Czy na pewno usunąć zadanie nadrzędne?')) {
      return false;
    }

    try {
      setError('');

      const response = await fetchWithAuth(`${API_URL}/api/relations/${relationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Nie udało się usunąć zadania nadrzędnego');
      }

      await fetchTask();
      await fetchAllTasks();
      return true;
    } catch (err) {
      setError(err.message || 'Nie udało się usunąć zadania nadrzędnego');
      return false;
    }
  };

  return (
    <div className={drawer ? 'w-full space-y-6' : 'mx-auto w-full max-w-4xl space-y-6'}>
      {!drawer && (
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="bg-gradient-to-r from-indigo-600 to-purple-700 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
              Edytuj zadanie
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Zmień szczegóły, status i relacje; zarządzaj komentarzami oraz załącznikami.
            </p>
          </div>
          <Button onClick={() => navigate('/tasks')}>
            <ArrowLeft className="h-4 w-4" />
            Wróć do zadań
          </Button>
        </div>
      )}

      <FieldError>{error}</FieldError>

      <Card>
        <CardHeader>
          <CardTitle>Szczegóły zadania</CardTitle>
          <CardDescription>Podstawowe informacje, daty i status.</CardDescription>
        </CardHeader>
        <form onSubmit={handleUpdateTask} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Data planu</FieldLabel>
              <TextInput
                type="datetime-local"
                id="edit-planned_date"
                name="planned_date"
                value={editingTask.planned_date}
                onChange={handleEditInputChange}
                disabled={submitting}
              />
            </Field>
            <Field>
              <FieldLabel>Deadline</FieldLabel>
              <TextInput
                type="datetime-local"
                id="edit-deadline"
                name="deadline"
                value={editingTask.deadline}
                onChange={handleEditInputChange}
                disabled={submitting}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel>Temat *</FieldLabel>
            <TextInput
              type="text"
              id="edit-topic"
              name="topic"
              value={editingTask.topic}
              onChange={handleEditInputChange}
              placeholder="Wpisz temat zadania"
              required
              disabled={submitting}
            />
          </Field>

          <Field>
            <FieldLabel>Notatki</FieldLabel>
            <div
              ref={editNotesRef}
              contentEditable={!submitting}
              id="edit-notes"
              onInput={(e) => {
                setEditingTask({
                  ...editingTask,
                  notes: e.target.innerHTML
                });
              }}
              onPaste={async (e) => {
                e.preventDefault();
                const items = e.clipboardData.items;
                for (let i = 0; i < items.length; i++) {
                  const item = items[i];
                  if (item.type.indexOf('image') !== -1) {
                    const blob = item.getAsFile();
                    const compressedDataUrl = await compressImage(blob, 1920, 1080, 0.75);
                    const selection = window.getSelection();
                    const range = selection.getRangeAt(0);
                    range.deleteContents();
                    const img = document.createElement('img');
                    img.src = compressedDataUrl;
                    img.style.maxWidth = '100%';
                    img.style.height = 'auto';
                    range.insertNode(img);
                    setEditingTask({
                      ...editingTask,
                      notes: editNotesRef.current.innerHTML
                    });
                  } else if (item.type === 'text/plain' || item.type === 'text/html') {
                    item.getAsString((str) => {
                      const selection = window.getSelection();
                      const range = selection.getRangeAt(0);
                      range.deleteContents();
                      const textNode = document.createTextNode(str);
                      range.insertNode(textNode);
                      setEditingTask({
                        ...editingTask,
                        notes: editNotesRef.current.innerHTML
                      });
                    });
                  }
                }
              }}
              className="min-h-[150px] w-full overflow-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition empty:before:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              data-placeholder="Dodaj notatki, linki, daty, obrazki..."
            />
            <style>{`
              #edit-notes:empty:before {
                content: attr(data-placeholder);
                color: #9ca3af;
                pointer-events: none;
              }
              #edit-notes img {
                max-width: 100%;
                height: auto;
                margin: 0.5rem 0;
                border-radius: 0.5rem;
              }
            `}</style>
          </Field>

          <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800">
            <input
              type="checkbox"
              name="completed"
              checked={editingTask.completed}
              onChange={handleEditInputChange}
              disabled={submitting}
              className="accent-indigo-600"
            />
            Oznacz jako zakończone
          </label>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field>
              <FieldLabel>Status</FieldLabel>
              <Select
                id="edit-status"
                value={editingTask.status_id === '' ? '' : String(editingTask.status_id)}
                onChange={(e) =>
                  setEditingTask((p) => ({
                    ...p,
                    status_id: e.target.value === '' ? '' : Number(e.target.value),
                  }))
                }
                disabled={submitting}
              >
                <option value="">—</option>
                {taskStatuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <FieldLabel>Priorytet</FieldLabel>
              <Select
                id="edit-priority"
                name="priority"
                value={editingTask.priority}
                onChange={handleEditInputChange}
                disabled={submitting}
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </Select>
            </Field>
            <Field>
              <FieldLabel>Projekt</FieldLabel>
              <Select
                id="edit-project"
                value={editingTask.project_id === '' ? '' : String(editingTask.project_id)}
                onChange={(e) =>
                  setEditingTask((p) => ({
                    ...p,
                    project_id: e.target.value === '' ? '' : Number(e.target.value),
                  }))
                }
                disabled={submitting}
              >
                <option value="">—</option>
                {projectsList.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name}
                  </option>
                ))}
              </Select>
            </Field>
            {canManage(meUser) && (
              <>
                <Field>
                  <FieldLabel>Przypisany</FieldLabel>
                  <Select
                    id="edit-assignee"
                    value={
                      editingTask.assignee_user_id === ''
                        ? ''
                        : String(editingTask.assignee_user_id)
                    }
                    onChange={(e) =>
                      setEditingTask((p) => ({
                        ...p,
                        assignee_user_id:
                          e.target.value === '' ? '' : Number(e.target.value),
                      }))
                    }
                    disabled={submitting}
                  >
                    <option value="">—</option>
                    {assignUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.username}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Grupa</FieldLabel>
                  <Select
                    id="edit-group"
                    value={editingTask.group_id === '' ? '' : String(editingTask.group_id)}
                    onChange={(e) =>
                      setEditingTask((p) => ({
                        ...p,
                        group_id: e.target.value === '' ? '' : Number(e.target.value),
                      }))
                    }
                    disabled={submitting}
                  >
                    <option value="">—</option>
                    {groupsList.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Wersja optymistyczna: {editingTask.version} (przy zapisie wykrywany konflikt edycji)
          </p>

          <div className="border-t border-slate-200 pt-6 dark:border-slate-800">
            <FieldLabel>Kategorie</FieldLabel>
            {categories.length === 0 ? (
              <p className="text-sm italic text-slate-500 dark:text-slate-400">
                Brak kategorii. Kategorie możesz utworzyć w widoku kategorii.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map(cat => {
                  const taskCategories = editingTask.categories || [];
                  const isAssigned = taskCategories.some(tc => tc.id === cat.id);
                  return (
                    <label
                      key={cat.id}
                      className={[
                        'inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition',
                        isAssigned
                          ? 'bg-indigo-50 font-semibold text-slate-900 dark:bg-indigo-500/15 dark:text-slate-100'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800',
                      ].join(' ')}
                      style={{ borderColor: isAssigned ? cat.color || '#6366f1' : undefined }}
                    >
                      <input
                        type="checkbox"
                        checked={isAssigned}
                        onChange={() => handleToggleTaskCategory(cat.id, isAssigned)}
                        disabled={submitting}
                        className="accent-indigo-600"
                      />
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: cat.color || '#667eea' }}
                      />
                      <span>{cat.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-200 pt-6 dark:border-slate-800 sm:flex-row">
            <Button type="submit" variant="primary" size="lg" disabled={submitting}>
              {submitting ? 'Zapisywanie...' : 'Zapisz zmiany'}
            </Button>
            <Button type="button" size="lg" onClick={handleCancelEdit} disabled={submitting}>
              Anuluj
            </Button>
          </div>
        </form>
      </Card>

      <TaskRelationsCard
        editingTaskId={editingTask.id}
        tasks={tasks}
        incomingRelations={incomingRelations}
        outgoingRelations={outgoingRelations}
        submitting={submitting}
        onError={setError}
        onAddSubtask={(targetId) => handleCreateSubtaskRelation(editingTask.id, targetId)}
        onRemoveSubtask={(relId) => handleRemoveSubtaskRelation(editingTask.id, relId)}
        onAddParent={(parentId) => handleCreateParentRelation(parentId, editingTask.id)}
        onRemoveParent={(relId) => handleRemoveParentRelation(relId)}
      />

      <TaskCommentsCard
        taskId={id}
        comments={comments}
        onChanged={refreshCommentSide}
        onError={setError}
        disabled={submitting}
      />

      <TaskActivityCard activities={activities} />

      <TaskAttachmentsCard
        taskId={id}
        attachments={attachments}
        onChanged={refreshCommentSide}
        onError={setError}
      />
    </div>
  );
}

export default EditTask;
