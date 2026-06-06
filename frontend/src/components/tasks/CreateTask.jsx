import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../ui/Button';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Field, FieldLabel, FieldError } from '../ui/Field';
import TextInput from '../ui/TextInput';
import Select from '../ui/Select';
import CreateTaskCategories from './create/CreateTaskCategories';
import CreateTaskActions from './create/CreateTaskActions';
import { API_URL, fetchWithAuth } from '../../api/authFetch';
import { canManage } from '../../constants/roles';
import { PRIORITY_OPTIONS } from '../../constants/priorities';
import { compressImage } from '../../utils/image';
import CreateTaskAssignment from './create/CreateTaskAssignment';
import { fetchOrganizations } from '../../api/authorization';

function toLocalDateTimeInputValue(date = new Date(), fallbackHour = null) {
  const value = new Date(date);

  if (fallbackHour !== null) {
    value.setHours(fallbackHour, 0, 0, 0);
  }

  const pad = (number) => String(number).padStart(2, '0');

  return [
    value.getFullYear(),
    pad(value.getMonth() + 1),
    pad(value.getDate()),
  ].join('-') + `T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function normalizeDateTimeInputValue(value, fallbackHour = null) {
  if (!value) {
    return toLocalDateTimeInputValue(new Date(), fallbackHour);
  }

  if (String(value).includes('T')) {
    return String(value).slice(0, 16);
  }

  return `${value}T${String(fallbackHour ?? 0).padStart(2, '0')}:00`;
}

function parseDateTimeInput(value) {
  if (!value) return null;

  const parsed = new Date(String(value).includes('T') ? value : `${value}T00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function CreateTask({
  isAuthenticated,
  drawer = false,
  parentId = null,
  projectId = null,
  defaults = null,
  onClose,
  onSaved,
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // W trybie drawer zamykanie/zapis idą przez callbacki zamiast nawigacji.
  const closeView = () => (onClose ? onClose() : navigate('/tasks'));
  const finishSaved = (taskId) =>
    onSaved ? onSaved(taskId) : navigate('/tasks', { state: { scrollToTaskId: taskId } });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [tasks, setTasks] = useState([]);
  const addNotesRef = useRef(null);

  // parent_id z propa (drawer) lub z URL (samodzielna trasa)
  const parentIdFromUrl = parentId || searchParams.get('parent_id') || '';
  const projectIdFromProps = projectId || searchParams.get('project_id') || '';
  const isProjectTaskMode = !!projectIdFromProps && !parentIdFromUrl;

  const [newTask, setNewTask] = useState({
    topic: '',
    notes: '',
    deadline: normalizeDateTimeInputValue(defaults?.deadline, 16),
    planned_date: normalizeDateTimeInputValue(defaults?.planned_date, 7),
    completed: false,
    selectedCategories: [],
    parentTaskId: parentIdFromUrl,
    selectedSubtaskIds: [],
    priority: 'medium',
    assigned_user_ids: [],
    assigned_group_ids: [],
    assigned_organization_ids: [],
    status_id: '',
    project_id: projectIdFromProps,
  });

  const [taskStatuses, setTaskStatuses] = useState([]);
  const [assignUsers, setAssignUsers] = useState([]);
  const [groupsList, setGroupsList] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [meUser, setMeUser] = useState(null);
  const [organizationsList, setOrganizationsList] = useState([]);


  // Pobierz wszystkie taski (dla parent task selection)
  const fetchAllTasks = async () => {
    try {
      const response = await fetchWithAuth(`${API_URL}/api/tasks?include_relations=true`);
      if (response.ok) {
        const data = await response.json();
        setTasks(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    }
  };

  // Pobierz kategorie
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
      console.error('Failed to fetch categories:', err);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    const loadFormData = async () => {
      try {
        await Promise.all([
          fetchAllTasks(),
          fetchCategories(),
        ]);

        const [statusResponse, projectsResponse, meResponse] = await Promise.all([
          fetchWithAuth(`${API_URL}/api/task-statuses`),
          fetchWithAuth(`${API_URL}/api/projects`),
          fetchWithAuth(`${API_URL}/api/auth/me`),
        ]);

        if (cancelled) return;

        if (statusResponse.ok) {
          setTaskStatuses(await statusResponse.json());
        }

        if (projectsResponse.ok) {
          setProjectsList(await projectsResponse.json());
        }

        if (!meResponse.ok) return;

        const me = await meResponse.json();

        if (cancelled) return;

        setMeUser(me);

        if (!canManage(me)) {
          setAssignUsers([]);
          setGroupsList([]);
          setOrganizationsList([]);
          return;
        }

        const [usersResponse, groupsResponse, organizations] = await Promise.all([
          fetchWithAuth(`${API_URL}/api/users`),
          fetchWithAuth(`${API_URL}/api/groups`),
          fetchOrganizations(),
        ]);

        if (cancelled) return;

        if (usersResponse.ok) {
          setAssignUsers(await usersResponse.json());
        }

        setOrganizationsList(
          Array.isArray(organizations) ? organizations : []
        );

        if (groupsResponse.ok) {
          const groups = await groupsResponse.json();

          const groupsWithMembers = await Promise.all(
            groups.map(async (group) => {
              const response = await fetchWithAuth(
                `${API_URL}/api/groups/${group.id}`
              );

              if (!response.ok) {
                return {
                  ...group,
                  members: [],
                };
              }

              return response.json();
            })
          );

          if (!cancelled) {
            setGroupsList(groupsWithMembers);
          }
        }
      } catch (fetchError) {
        if (!cancelled) {
          console.error(
            'Nie udało się pobrać danych formularza:',
            fetchError
          );
        }
      }
    };

    loadFormData();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!parentIdFromUrl) return;

    setNewTask((previous) => ({
      ...previous,
      parentTaskId: parentIdFromUrl,
    }));
  }, [parentIdFromUrl]);

  useEffect(() => {
    if (!projectIdFromProps) return;

    setNewTask((previous) => ({
      ...previous,
      project_id: projectIdFromProps,
    }));
  }, [projectIdFromProps]);
  useEffect(() => {
    if (!defaults) return;

    setNewTask((prev) => ({
      ...prev,
      planned_date: defaults.planned_date
        ? normalizeDateTimeInputValue(defaults.planned_date, 7)
        : prev.planned_date,
      deadline: defaults.deadline
        ? normalizeDateTimeInputValue(defaults.deadline, 16)
        : prev.deadline,
    }));
  }, [defaults]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewTask(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setError('');
  };

  const getAvailableParentTasks = () => {
    if (!tasks || tasks.length === 0) return [];
    return tasks.filter(task => !task.completed || true); // Allow completed tasks as parents
  };

  // Funkcja do pobierania dostępnych tasków jako subtasków
  const getAvailableSubtasks = () => {
    if (!tasks || tasks.length === 0) return [];

    // Funkcja pomocnicza do pobierania wszystkich parent tasków (rekurencyjnie)
    const getAllParentIds = (taskId, visited = new Set()) => {
      if (visited.has(taskId)) return visited;
      visited.add(taskId);

      const task = tasks.find(t => t.id === taskId);
      if (!task || !task.related_tasks) return visited;

      const incoming = task.related_tasks.incoming || [];
      for (const rel of incoming) {
        getAllParentIds(rel.source_task_id, visited);
      }
      return visited;
    };

    // Jeśli wybrano parent task, wyklucz go i wszystkie jego parenty
    const excludeIds = new Set();
    if (newTask.parentTaskId) {
      excludeIds.add(parseInt(newTask.parentTaskId));
      const parentIds = getAllParentIds(parseInt(newTask.parentTaskId));
      parentIds.forEach(id => excludeIds.add(id));
    }

    // Filtruj: nie można dodać parent taska jako subtaska, ani tasków które spowodowałyby cykl
    return tasks.filter(task => {
      // Nie można dodać parent taska jako subtaska
      if (newTask.parentTaskId && task.id === parseInt(newTask.parentTaskId)) return false;
      // Nie można dodać taska który jest parentem (rekurencyjnie) wybranego parent taska
      if (excludeIds.has(task.id)) return false;
      // Nie można dodać taska który już jest wybrany jako subtask
      if (newTask.selectedSubtaskIds.includes(task.id)) return false;

      return true;
    });
  };

  const parseDateOnly = (value) => parseDateTimeInput(value);

  const validateDeadlineHierarchyBeforeCreate = () => {
    const childDeadline = parseDateOnly(newTask.deadline);

    if (newTask.parentTaskId && childDeadline) {
      const parentTask = tasks.find((task) => task.id === parseInt(newTask.parentTaskId, 10));
      const parentDeadline = parseDateOnly(parentTask?.deadline);

      if (parentDeadline && childDeadline > parentDeadline) {
        return 'Podzadanie nie może mieć deadline późniejszego niż zadanie nadrzędne.';
      }
    }

    if (newTask.selectedSubtaskIds?.length && newTask.deadline) {
      const parentDeadline = parseDateOnly(newTask.deadline);

      const violatingSubtask = newTask.selectedSubtaskIds
        .map((subtaskId) => tasks.find((task) => task.id === parseInt(subtaskId, 10)))
        .find((task) => {
          const subtaskDeadline = parseDateOnly(task?.deadline);
          return parentDeadline && subtaskDeadline && subtaskDeadline > parentDeadline;
        });

      if (violatingSubtask) {
        return `Zadanie "${violatingSubtask.topic}" ma deadline późniejszy niż tworzone zadanie nadrzędne.`;
      }
    }

    return null;
  };

  const handleAddTask = async (e) => {
    e.preventDefault();

    if (!newTask.topic.trim()) {
      setError('Temat jest wymagany');
      return;
    }

    const deadlineHierarchyError = validateDeadlineHierarchyBeforeCreate();
    if (deadlineHierarchyError) {
      setError(deadlineHierarchyError);
      return;
    }

    // Check if parent task has categories that are not selected
    let finalSelectedCategories = [...(newTask.selectedCategories || [])];
    if (newTask.parentTaskId) {
      const parentTask = tasks.find(t => t.id === parseInt(newTask.parentTaskId));
      if (parentTask && parentTask.categories && parentTask.categories.length > 0) {
        const parentCategoryIds = parentTask.categories.map(cat => cat.id);
        const missingCategoryIds = parentCategoryIds.filter(catId => !finalSelectedCategories.includes(catId));

        if (missingCategoryIds.length > 0) {
          const missingCategoryNames = missingCategoryIds
            .map(catId => {
              const cat = categories.find(c => c.id === catId);
              return cat ? cat.name : null;
            })
            .filter(name => name !== null);

          if (missingCategoryNames.length > 0) {
            const categoryList = missingCategoryNames.join(', ');
            const confirmMessage = `The parent task has categories (${categoryList}) that are not selected for this task. Do you want to add these categories to the new task?`;
            const shouldAddParentCategories = window.confirm(confirmMessage);

            if (shouldAddParentCategories) {
              finalSelectedCategories = [...finalSelectedCategories, ...missingCategoryIds];
            }
          }
        }
      }
    }

    try {
      setSubmitting(true);
      setError('');

      const taskData = {
        topic: newTask.topic,
        notes: newTask.notes || '',
        priority: newTask.priority || 'medium',
      };

      if (newTask.deadline) {
        taskData.deadline = newTask.deadline;
      }

      if (newTask.planned_date) {
        taskData.planned_date = newTask.planned_date;
      }

      if (newTask.status_id !== '' && newTask.status_id != null) {
        taskData.status_id = Number(newTask.status_id);
      }
      taskData.assigned_user_ids = newTask.assigned_user_ids || [];
      taskData.assigned_group_ids = newTask.assigned_group_ids || [];
      taskData.assigned_organization_ids =
        newTask.assigned_organization_ids || [];
      if (newTask.project_id !== '' && newTask.project_id != null) {
        taskData.project_id = Number(newTask.project_id);
      }

      const response = await fetchWithAuth(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Nie udało się utworzyć zadania');
      }

      const createdTask = await response.json();

      // Assign selected categories to the newly created task
      if (finalSelectedCategories && finalSelectedCategories.length > 0) {
        try {
          await Promise.all(
            finalSelectedCategories.map(categoryId =>
              fetchWithAuth(`${API_URL}/api/tasks/${createdTask.id}/categories`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ category_id: categoryId }),
              })
            )
          );
        } catch (categoryError) {
          console.warn('Some categories could not be assigned:', categoryError);
        }
      }

      // Create parent-child relation if parent task was selected
      if (newTask.parentTaskId) {
        try {
          const relationResponse = await fetchWithAuth(`${API_URL}/api/tasks/${newTask.parentTaskId}/relations`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              target_task_id: createdTask.id
            }),
          });

          if (!relationResponse.ok) {
            const errorData = await relationResponse.json();
            console.warn('Failed to create parent relation:', errorData.error || 'Unknown error');
          }
        } catch (relationError) {
          console.warn('Error creating parent relation:', relationError);
        }
      }

      // Create subtask relations if any subtasks were selected
      if (newTask.selectedSubtaskIds && newTask.selectedSubtaskIds.length > 0) {
        try {
          await Promise.allSettled(
            newTask.selectedSubtaskIds.map(subtaskId =>
              fetchWithAuth(`${API_URL}/api/tasks/${createdTask.id}/relations`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  target_task_id: parseInt(subtaskId)
                }),
              })
            )
          );
        } catch (subtaskError) {
          console.warn('Error creating subtask relations:', subtaskError);
        }
      }

      finishSaved(createdTask.id);
    } catch (err) {
      setError(err.message || 'Nie udało się utworzyć zadania');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    closeView();
  };

  return (
    <div className={drawer ? 'w-full space-y-6' : 'mx-auto w-full max-w-6xl space-y-6'}>
      {!drawer && (
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="bg-gradient-to-r from-indigo-600 to-purple-700 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
              Nowe zadanie
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Dodaj zadanie, ustaw daty, kategorię i relacje z innymi zadaniami.
            </p>
          </div>

          <Button onClick={() => navigate('/tasks')}>
            Wróć do zadań
          </Button>
        </div>
      )}

      <FieldError>{error}</FieldError>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Szczegóły zadania</CardTitle>
            <CardDescription>
              Uzupełnij podstawowe informacje, daty i status.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleAddTask} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Data planu</FieldLabel>
                <TextInput
                  type="datetime-local"
                  id="planned_date"
                  name="planned_date"
                  value={newTask.planned_date}
                  onChange={handleInputChange}
                  disabled={submitting}
                />
              </Field>

              <Field>
                <FieldLabel>Deadline</FieldLabel>
                <TextInput
                  type="datetime-local"
                  id="deadline"
                  name="deadline"
                  value={newTask.deadline}
                  onChange={handleInputChange}
                  disabled={submitting}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel>Temat *</FieldLabel>
              <TextInput
                type="text"
                id="topic"
                name="topic"
                value={newTask.topic}
                onChange={handleInputChange}
                placeholder="Wpisz temat zadania"
                required
                disabled={submitting}
              />
            </Field>

            <Field>
              <FieldLabel>Notatki</FieldLabel>
              <div
                ref={addNotesRef}
                contentEditable={!submitting}
                id="notes"
                onInput={(e) => {
                  setNewTask({
                    ...newTask,
                    notes: e.target.innerHTML,
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

                      setNewTask({
                        ...newTask,
                        notes: addNotesRef.current.innerHTML,
                      });
                    } else if (item.type === 'text/plain' || item.type === 'text/html') {
                      item.getAsString((str) => {
                        const selection = window.getSelection();
                        const range = selection.getRangeAt(0);

                        range.deleteContents();

                        const textNode = document.createTextNode(str);
                        range.insertNode(textNode);

                        setNewTask({
                          ...newTask,
                          notes: addNotesRef.current.innerHTML,
                        });
                      });
                    }
                  }
                }}
                className="min-h-[150px] w-full overflow-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition empty:before:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                data-placeholder="Dodaj notatki, linki, daty, obrazki..."
              />

              <style>{`
    #notes:empty:before {
      content: attr(data-placeholder);
      color: #9ca3af;
      pointer-events: none;
    }

    #notes img {
      max-width: 100%;
      height: auto;
      margin: 0.5rem 0;
      border-radius: 0.5rem;
    }
  `}</style>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Field>
                <FieldLabel>Status</FieldLabel>
                <Select
                  id="create-status"
                  value={newTask.status_id === '' ? '' : String(newTask.status_id)}
                  onChange={(e) =>
                    setNewTask((p) => ({
                      ...p,
                      status_id: e.target.value === '' ? '' : Number(e.target.value),
                    }))
                  }
                  disabled={submitting}
                >
                  <option value="">Domyślny</option>
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
                  id="create-priority"
                  name="priority"
                  value={newTask.priority}
                  onChange={handleInputChange}
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
                  id="create-project"
                  value={newTask.project_id === '' ? '' : String(newTask.project_id)}
                  onChange={(e) =>
                    setNewTask((p) => ({
                      ...p,
                      project_id: e.target.value === '' ? '' : Number(e.target.value),
                    }))
                  }
                  disabled={submitting}
                >
                  <option value="">Brak</option>
                  {projectsList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>

            </div>

            {canManage(meUser) && (
              <CreateTaskAssignment
                users={assignUsers}
                groups={groupsList}
                organizations={organizationsList}
                value={newTask}
                disabled={submitting}
                onChange={(assignments) => {
                  setNewTask((previous) => ({
                    ...previous,
                    ...assignments,
                  }));

                  setError('');
                }}
              />
            )}

            {!isProjectTaskMode && (
              <div className="border-t border-slate-200 pt-6 dark:border-slate-800">
                <Field>
                  <FieldLabel>Zadanie nadrzędne opcjonalnie</FieldLabel>

                  {tasks.length === 0 ? (
                    <p className="text-sm italic text-slate-500 dark:text-slate-400">
                      Brak zadań. To zadanie zostanie zadaniem głównym.
                    </p>
                  ) : (
                    <Select
                      id="parent-task-select"
                      value={newTask.parentTaskId}
                      onChange={(e) => {
                        setNewTask((prev) => ({
                          ...prev,
                          parentTaskId: e.target.value,
                          selectedSubtaskIds: prev.selectedSubtaskIds.filter(
                            (id) => !e.target.value || id !== parseInt(e.target.value)
                          ),
                        }));
                        setError('');
                      }}
                      disabled={submitting}
                    >
                      <option value="">Brak rodzica - zadanie główne</option>
                      {getAvailableParentTasks().map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.topic} {task.completed ? '(zakończone)' : ''}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
            )}
            {!isProjectTaskMode && (
              <div className="border-t border-slate-200 pt-6 dark:border-slate-800">
                <FieldLabel>Podzadania opcjonalnie</FieldLabel>

                {tasks.length === 0 ? (
                  <p className="text-sm italic text-slate-500 dark:text-slate-400">
                    Brak zadań, które można dodać jako podzadania.
                  </p>
                ) : (
                  <>
                    {newTask.selectedSubtaskIds.length > 0 && (
                      <div className="mb-4">
                        <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          Wybrane podzadania
                        </p>

                        <div className="space-y-2">
                          {newTask.selectedSubtaskIds.map((subtaskId) => {
                            const subtask = tasks.find((t) => t.id === subtaskId);

                            return subtask ? (
                              <div
                                key={subtaskId}
                                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                              >
                                <span className="text-slate-800 dark:text-slate-200">
                                  {subtask.topic}
                                </span>

                                <Button
                                  type="button"
                                  variant="danger"
                                  size="sm"
                                  onClick={() => {
                                    setNewTask((prev) => ({
                                      ...prev,
                                      selectedSubtaskIds: prev.selectedSubtaskIds.filter(
                                        (id) => id !== subtaskId
                                      ),
                                    }));
                                  }}
                                  disabled={submitting}
                                >
                                  Usuń
                                </Button>
                              </div>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}

                    <Field>
                      <FieldLabel>Dodaj podzadanie</FieldLabel>
                      <Select
                        id="subtask-select"
                        value=""
                        onChange={(e) => {
                          const subtaskId = e.target.value;

                          if (subtaskId && !newTask.selectedSubtaskIds.includes(parseInt(subtaskId))) {
                            setNewTask((prev) => ({
                              ...prev,
                              selectedSubtaskIds: [...prev.selectedSubtaskIds, parseInt(subtaskId)],
                            }));
                          }

                          e.target.value = '';
                          setError('');
                        }}
                        disabled={submitting || getAvailableSubtasks().length === 0}
                      >
                        <option value="">Wybierz zadanie</option>
                        {getAvailableSubtasks().length === 0 ? (
                          <option value="" disabled>
                            Brak dostępnych zadań
                          </option>
                        ) : (
                          getAvailableSubtasks().map((task) => (
                            <option key={task.id} value={task.id}>
                              {task.topic} {task.completed ? '(zakończone)' : ''}
                            </option>
                          ))
                        )}
                      </Select>

                      {getAvailableSubtasks().length === 0 && newTask.selectedSubtaskIds.length === 0 && (
                        <p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">
                          Wszystkie zadania są już powiązane albo utworzyłyby zapętloną relację.
                        </p>
                      )}
                    </Field>
                  </>
                )}
              </div>
            )}

            <div className="border-t border-slate-200 pt-6 dark:border-slate-800">
              <FieldLabel>Kategorie</FieldLabel>

              {categories.length === 0 ? (
                <p className="text-sm italic text-slate-500 dark:text-slate-400">
                  Brak kategorii. Kategorie możesz utworzyć w widoku kategorii.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => {
                    const isSelected = (newTask.selectedCategories || []).includes(cat.id);

                    return (
                      <label
                        key={cat.id}
                        className={[
                          'inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition',
                          isSelected
                            ? 'bg-indigo-50 font-semibold text-slate-900 dark:bg-indigo-500/15 dark:text-slate-100'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800',
                        ].join(' ')}
                        style={{ borderColor: isSelected ? cat.color || '#6366f1' : undefined }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setNewTask((prev) => ({
                              ...prev,
                              selectedCategories: isSelected
                                ? (prev.selectedCategories || []).filter((id) => id !== cat.id)
                                : [...(prev.selectedCategories || []), cat.id],
                            }));
                          }}
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
                {submitting ? 'Tworzenie...' : 'Utwórz zadanie'}
              </Button>

              <Button type="button" size="lg" onClick={handleCancel} disabled={submitting}>
                Anuluj
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div >
  );
}

export default CreateTask;
