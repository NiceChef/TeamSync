import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../ui/Button';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Field, FieldLabel, FieldError } from '../ui/Field';
import TextInput from '../ui/TextInput';
import Select from '../ui/Select';
import CreateTaskCategories from './create/CreateTaskCategories';
import CreateTaskActions from './create/CreateTaskActions';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function CreateTask({ isAuthenticated }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [tasks, setTasks] = useState([]);
  const addNotesRef = useRef(null);

  // Get parent_id from URL if present
  const parentIdFromUrl = searchParams.get('parent_id') || '';

  const [newTask, setNewTask] = useState({
    topic: '',
    notes: '',
    deadline: '',
    planned_date: '',
    completed: false,
    selectedCategories: [],
    parentTaskId: parentIdFromUrl,
    selectedSubtaskIds: [],
    priority: 'medium',
    assignee_user_id: '',
    group_id: '',
    status_id: '',
    project_id: '',
  });

  const [taskStatuses, setTaskStatuses] = useState([]);
  const [assignUsers, setAssignUsers] = useState([]);
  const [groupsList, setGroupsList] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [meUser, setMeUser] = useState(null);

  // Funkcje pomocnicze do autoryzacji
  const getAuthToken = () => {
    return localStorage.getItem('access_token');
  };

  const refreshToken = async () => {
    const refreshTokenValue = localStorage.getItem('refresh_token');
    if (!refreshTokenValue) {
      console.error('refreshToken: No refresh token available');
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${refreshTokenValue}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('refreshToken: Error response:', errorData);
        if (response.status === 401) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          throw new Error('Refresh token expired or invalid');
        }
        throw new Error(errorData.error || 'Failed to refresh token');
      }

      const data = await response.json();
      localStorage.setItem('access_token', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('refresh_token', data.refresh_token);
      }
      return data.access_token;
    } catch (err) {
      console.error('refreshToken: Exception:', err);
      if (err.message.includes('Refresh token expired') || err.message.includes('invalid')) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
      }
      throw err;
    }
  };

  const fetchWithAuth = async (url, options = {}) => {
    let token = getAuthToken();

    if (!token) {
      console.error('fetchWithAuth: No access token available');
      throw new Error('No authentication token available');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      const refreshTokenValue = localStorage.getItem('refresh_token');
      if (refreshTokenValue) {
        try {
          token = await refreshToken();
          return fetch(url, {
            ...options,
            headers: {
              ...options.headers,
              'Authorization': `Bearer ${token}`,
            },
          });
        } catch (refreshError) {
          console.error('fetchWithAuth: Token refresh failed:', refreshError);
          return response;
        }
      } else {
        console.error('fetchWithAuth: No refresh token available');
      }
    }

    return response;
  };

  // Funkcja kompresji obrazów
  const compressImage = (file, maxWidth = 1920, maxHeight = 1080, quality = 0.75) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

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

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              } else {
                reject(new Error('Failed to compress image'));
              }
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

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
    if (isAuthenticated) {
      fetchAllTasks();
      fetchCategories();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      const stRes = await fetchWithAuth(`${API_URL}/api/task-statuses`);
      if (stRes.ok) setTaskStatuses(await stRes.json());
      const pRes = await fetchWithAuth(`${API_URL}/api/projects`);
      if (pRes.ok) setProjectsList(await pRes.json());
      const meRes = await fetchWithAuth(`${API_URL}/api/auth/me`);
      if (!meRes.ok) return;
      const me = await meRes.json();
      setMeUser(me);
      if (me.role === 'client') {
        setAssignUsers([]);
        setGroupsList([]);
        return;
      }
      const uRes = await fetchWithAuth(`${API_URL}/api/users`);
      if (uRes.ok) setAssignUsers(await uRes.json());
      const gRes = await fetchWithAuth(`${API_URL}/api/groups`);
      if (gRes.ok) setGroupsList(await gRes.json());
    })();
  }, [isAuthenticated]);

  // Update parentTaskId when URL parameter changes
  useEffect(() => {
    if (parentIdFromUrl) {
      setNewTask(prev => ({
        ...prev,
        parentTaskId: parentIdFromUrl
      }));
    }
  }, [parentIdFromUrl]);

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

    // Funkcja pomocnicza do sprawdzania cykli
    const wouldCreateCycle = (targetId, currentId, visited = new Set()) => {
      if (visited.has(targetId)) return true;
      if (targetId === currentId) return true;

      visited.add(targetId);
      const targetTask = tasks.find(t => t.id === targetId);
      if (!targetTask || !targetTask.related_tasks) return false;

      const outgoing = targetTask.related_tasks.outgoing || [];
      for (const rel of outgoing) {
        if (wouldCreateCycle(rel.target_task_id, currentId, visited)) {
          return true;
        }
      }
      return false;
    };

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

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.topic.trim()) {
      setError('Topic is required');
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
        completed: newTask.completed,
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
      if (newTask.assignee_user_id !== '' && newTask.assignee_user_id != null) {
        taskData.assignee_user_id = Number(newTask.assignee_user_id);
      }
      if (newTask.group_id !== '' && newTask.group_id != null) {
        taskData.group_id = Number(newTask.group_id);
      }
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
        throw new Error(errorData.error || 'Failed to create task');
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

      // Przekieruj do listy tasków z informacją o tasku do przewinięcia
      navigate('/tasks', { state: { scrollToTaskId: createdTask.id } });
    } catch (err) {
      setError(err.message || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/tasks');
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
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
                  type="date"
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
                  type="date"
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

            <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800">
              <input
                type="checkbox"
                name="completed"
                checked={newTask.completed}
                onChange={handleInputChange}
                disabled={submitting}
                className="accent-indigo-600"
              />
              Oznacz jako zakończone
            </label>

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
                  <option value="low">Niski</option>
                  <option value="medium">Średni</option>
                  <option value="high">Wysoki</option>
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

              {meUser && meUser.role !== 'client' && (
                <>
                  <Field>
                    <FieldLabel>Przypisany</FieldLabel>
                    <Select
                      id="create-assignee"
                      value={newTask.assignee_user_id === '' ? '' : String(newTask.assignee_user_id)}
                      onChange={(e) =>
                        setNewTask((p) => ({
                          ...p,
                          assignee_user_id: e.target.value === '' ? '' : Number(e.target.value),
                        }))
                      }
                      disabled={submitting}
                    >
                      <option value="">Brak</option>
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
                      id="create-group"
                      value={newTask.group_id === '' ? '' : String(newTask.group_id)}
                      onChange={(e) =>
                        setNewTask((p) => ({
                          ...p,
                          group_id: e.target.value === '' ? '' : Number(e.target.value),
                        }))
                      }
                      disabled={submitting}
                    >
                      <option value="">Brak</option>
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
