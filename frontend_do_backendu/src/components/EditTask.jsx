import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Paperclip, Send } from 'lucide-react';
import Button from './ui/Button';
import { Card, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { Field, FieldLabel, FieldError } from './ui/Field';
import TextInput from './ui/TextInput';
import Select from './ui/Select';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function EditTask({ isAuthenticated, drawer = false, taskId = null, onClose, onSaved }) {
  const params = useParams();
  const id = taskId ?? params.id;
  const navigate = useNavigate();

  // W trybie drawer zamykanie/zapis idą przez callbacki zamiast nawigacji.
  const closeView = () => (onClose ? onClose() : navigate('/tasks'));
  const finishSaved = (savedId) =>
    onSaved ? onSaved(savedId) : navigate('/tasks', { state: { scrollToTaskId: savedId } });
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedSubtaskId, setSelectedSubtaskId] = useState('');
  const [selectedParentTaskId, setSelectedParentTaskId] = useState('');
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
  const [commentBody, setCommentBody] = useState('');
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

    const headers = { ...options.headers, Authorization: `Bearer ${token}` };
    if (options.body instanceof FormData) {
      delete headers['Content-Type'];
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      const refreshTokenValue = localStorage.getItem('refresh_token');
      if (refreshTokenValue) {
        try {
          token = await refreshToken();
          const h2 = { ...options.headers, Authorization: `Bearer ${token}` };
          if (options.body instanceof FormData) {
            delete h2['Content-Type'];
          }
          return fetch(url, {
            ...options,
            headers: h2,
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

  // Pobierz taska
  const fetchTask = async () => {
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

      // Konwertuj daty z ISO format na YYYY-MM-DD dla input type="date"
      const formatDateForInput = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toISOString().split('T')[0];
      };

      setEditingTask({
        id: taskData.id,
        topic: taskData.topic || '',
        notes: taskData.notes || '',
        deadline: formatDateForInput(taskData.deadline),
        planned_date: formatDateForInput(taskData.planned_date),
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
  };

  // Pobierz wszystkie taski (dla subtasków)
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
    if (isAuthenticated && id) {
      fetchTask();
      fetchAllTasks();
      fetchCategories();
    }
  }, [id, isAuthenticated]);

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

  const handleUpdateTask = async (e) => {
    e.preventDefault();
    if (!editingTask.topic.trim()) {
      setError('Temat jest wymagany');
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
        throw new Error(errData.message || errData.error || 'Konflikt wersji — odśwież stronę.');
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Nie udało się zaktualizować zadania');
      }

      const updated = await response.json();
      setEditingTask((prev) => ({ ...prev, version: updated.version ?? prev.version }));

      // ✅ Aktualizuj kategorie - porównaj stare z nowymi
      const originalCategories = task.categories || [];
      const newCategories = editingTask.categories || [];

      const originalCategoryIds = new Set(originalCategories.map(cat => cat.id));
      const newCategoryIds = new Set(newCategories.map(cat => cat.id));

      // Znajdź kategorie do dodania (są w nowych, ale nie w starych)
      const categoriesToAdd = newCategories.filter(cat => !originalCategoryIds.has(cat.id));

      // Znajdź kategorie do usunięcia (są w starych, ale nie w nowych)
      const categoriesToRemove = originalCategories.filter(cat => !newCategoryIds.has(cat.id));

      // Wykonaj wszystkie operacje na kategoriach
      const categoryPromises = [];

      // Dodaj nowe kategorie
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

      // Usuń stare kategorie
      for (const category of categoriesToRemove) {
        categoryPromises.push(
          fetchWithAuth(`${API_URL}/api/tasks/${editingTask.id}/categories/${category.id}`, {
            method: 'DELETE',
          })
        );
      }

      // Wykonaj wszystkie requesty równolegle
      const categoryResults = await Promise.allSettled(categoryPromises);

      // Sprawdź czy wszystkie się powiodły
      const failed = categoryResults.filter(r => r.status === 'rejected' || (r.value && !r.value.ok));
      if (failed.length > 0) {
        console.warn(`Failed to update ${failed.length} category/categories`);
        // Nie rzucamy błędu - podstawowe dane zostały zaktualizowane
      }

      // Przekieruj do listy tasków z informacją o tasku do przewinięcia
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

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentBody.trim() || !id) return;
    const res = await fetchWithAuth(`${API_URL}/api/tasks/${id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: commentBody.trim() }),
    });
    if (res.ok) {
      setCommentBody('');
      await refreshCommentSide();
    } else {
      const err = await res.json().catch(() => ({}));
      setError(err.error || 'Nie udało się dodać komentarza');
    }
  };

  const handleUploadAttachment = async (ev) => {
    const file = ev.target.files?.[0];
    if (!file || !id) return;
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetchWithAuth(`${API_URL}/api/tasks/${id}/attachments`, {
      method: 'POST',
      body: fd,
    });
    ev.target.value = '';
    if (res.ok) await refreshCommentSide();
    else {
      const err = await res.json().catch(() => ({}));
      setError(err.error || 'Upload nie powiódł się');
    }
  };

  const handleCancelEdit = () => {
    closeView();
  };

  // ✅ Tylko aktualizuj lokalny stan - nie wysyłaj requestu do backendu
  const handleToggleTaskCategory = (categoryId, isAssigned) => {
    setEditingTask(prev => {
      const currentCategories = prev.categories || [];

      if (isAssigned) {
        // Usuń kategorię z lokalnego stanu
        return {
          ...prev,
          categories: currentCategories.filter(cat => cat.id !== categoryId)
        };
      } else {
        // Dodaj kategorię do lokalnego stanu
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
      setSelectedSubtaskId('');

      // Przekieruj do listy tasków z informacją o subtasku do przewinięcia
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

  const getAvailableTasksForSubtask = (parentTaskId) => {
    if (!tasks || tasks.length === 0) return [];

    const parentTask = tasks.find(t => t.id === parentTaskId);
    if (!parentTask) return [];

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

    return tasks.filter(t => {
      // Nie można dodać siebie jako subtaska
      if (t.id === parentTaskId) return false;

      // Nie można dodać taska który już jest subtaskiem
      const existingOutgoing = parentTask.related_tasks?.outgoing || [];
      if (existingOutgoing.some(rel => rel.target_task_id === t.id)) return false;

      // Nie można dodać taska który spowodowałby cykl
      if (wouldCreateCycle(t.id, parentTaskId)) return false;

      return true;
    });
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
  const availableTasks = getAvailableTasksForSubtask(editingTask.id);

  // Funkcja do pobierania dostępnych tasków jako parent tasków
  const getAvailableTasksForParent = (childTaskId) => {
    if (!tasks || tasks.length === 0) return [];

    const childTask = tasks.find(t => t.id === childTaskId);
    if (!childTask) return [];

    // Funkcja pomocnicza do sprawdzania cykli
    const wouldCreateCycle = (parentId, currentId, visited = new Set()) => {
      if (visited.has(parentId)) return true;
      if (parentId === currentId) return true;

      visited.add(parentId);
      const parentTask = tasks.find(t => t.id === parentId);
      if (!parentTask || !parentTask.related_tasks) return false;

      const outgoing = parentTask.related_tasks.outgoing || [];
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

    const excludeIds = new Set([childTaskId, ...getAllParentIds(childTaskId)]);

    // Filtruj: nie można dodać siebie, swoich parentów, ani tasków które spowodowałyby cykl
    return tasks.filter(task => {
      // Nie można dodać siebie jako parenta
      if (task.id === childTaskId) return false;
      // Nie można dodać taska który już jest parentem
      if (incomingRelations.some(rel => rel.source_task_id === task.id)) return false;
      // Nie można dodać taska który spowodowałby cykl
      if (wouldCreateCycle(task.id, childTaskId)) return false;
      // Nie można dodać taska który jest już parentem (rekurencyjnie)
      if (excludeIds.has(task.id)) return false;

      return true;
    });
  };

  const availableParentTasks = getAvailableTasksForParent(editingTask.id);

  // Funkcja do dodawania parent taska
  const handleCreateParentRelation = async (parentTaskId, childTaskId) => {
    try {
      setError('');

      // Tworzymy relację gdzie parent task jest source, a edytowany task jest target
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
      setSelectedParentTaskId('');

      // Przekieruj do listy tasków z informacją o tasku do przewinięcia
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
                type="date"
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
                type="date"
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
                <option value="low">Niski</option>
                <option value="medium">Średni</option>
                <option value="high">Wysoki</option>
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
            {meUser && meUser.role !== 'client' && (
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

      <Card>
        <CardHeader>
          <CardTitle>Relacje</CardTitle>
          <CardDescription>Zadanie nadrzędne i podzadania.</CardDescription>
        </CardHeader>

        <div className="space-y-6">
          <div>
            <FieldLabel>Zadanie nadrzędne</FieldLabel>
            {incomingRelations.length > 0 && (
              <div className="mb-3 space-y-2">
                {incomingRelations.map(rel => {
                  const parentTask = tasks.find(t => t.id === rel.source_task_id);
                  return parentTask ? (
                    <div
                      key={rel.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                    >
                      <span className="text-slate-800 dark:text-slate-200">{parentTask.topic}</span>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => handleRemoveParentRelation(rel.id)}
                        disabled={submitting}
                      >
                        Usuń
                      </Button>
                    </div>
                  ) : null;
                })}
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select
                id="parent-task-select"
                value={selectedParentTaskId}
                onChange={(e) => {
                  setSelectedParentTaskId(e.target.value);
                  setError('');
                }}
                disabled={submitting || availableParentTasks.length === 0}
              >
                <option value="">— Wybierz zadanie —</option>
                {availableParentTasks.length === 0 ? (
                  <option value="" disabled>Brak dostępnych zadań</option>
                ) : (
                  availableParentTasks.map(task => (
                    <option key={task.id} value={task.id}>
                      {task.topic} {task.completed ? '(zakończone)' : ''}
                    </option>
                  ))
                )}
              </Select>
              <Button
                type="button"
                variant="primary"
                onClick={async () => {
                  if (selectedParentTaskId) {
                    if (incomingRelations.length > 0) {
                      const oldRelation = incomingRelations[0];
                      const removed = await handleRemoveParentRelation(oldRelation.id);
                      if (removed) {
                        await handleCreateParentRelation(selectedParentTaskId, editingTask.id);
                      }
                    } else {
                      await handleCreateParentRelation(selectedParentTaskId, editingTask.id);
                    }
                  }
                }}
                disabled={submitting || !selectedParentTaskId || availableParentTasks.length === 0}
              >
                {incomingRelations.length > 0 ? 'Zmień' : 'Dodaj'}
              </Button>
            </div>
            {availableParentTasks.length === 0 && (
              <p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">
                Wszystkie zadania są już powiązane albo utworzyłyby zapętloną relację.
              </p>
            )}
          </div>

          <div className="border-t border-slate-200 pt-6 dark:border-slate-800">
            <FieldLabel>Podzadania</FieldLabel>
            {outgoingRelations.length > 0 && (
              <div className="mb-3 space-y-2">
                {outgoingRelations.map(rel => {
                  const subtask = tasks.find(t => t.id === rel.target_task_id);
                  return subtask ? (
                    <div
                      key={rel.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                    >
                      <span className="text-slate-800 dark:text-slate-200">{subtask.topic}</span>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => handleRemoveSubtaskRelation(editingTask.id, rel.id)}
                        disabled={submitting}
                      >
                        Usuń
                      </Button>
                    </div>
                  ) : null;
                })}
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select
                id="subtask-select"
                value={selectedSubtaskId}
                onChange={(e) => {
                  setSelectedSubtaskId(e.target.value);
                  setError('');
                }}
                disabled={submitting || availableTasks.length === 0}
              >
                <option value="">— Wybierz zadanie —</option>
                {availableTasks.length === 0 ? (
                  <option value="" disabled>Brak dostępnych zadań</option>
                ) : (
                  availableTasks.map(task => (
                    <option key={task.id} value={task.id}>
                      {task.topic} {task.completed ? '(zakończone)' : ''}
                    </option>
                  ))
                )}
              </Select>
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  if (selectedSubtaskId) {
                    handleCreateSubtaskRelation(editingTask.id, selectedSubtaskId);
                  }
                }}
                disabled={submitting || !selectedSubtaskId || availableTasks.length === 0}
              >
                Dodaj
              </Button>
            </div>
            {availableTasks.length === 0 && (
              <p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">
                Wszystkie zadania są już powiązane albo utworzyłyby zapętloną relację.
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Komentarze</CardTitle>
        </CardHeader>
        {comments.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Brak komentarzy.</p>
        ) : (
          <ul className="space-y-2">
            {comments.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {c.author_username || 'Użytkownik'}
                  </span>
                  <span className="text-xs text-slate-400">{c.created_at}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{c.body}</p>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={handleAddComment} className="mt-4 flex gap-2">
          <TextInput
            type="text"
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            placeholder="Napisz komentarz..."
          />
          <Button type="submit" variant="primary" disabled={submitting || !commentBody.trim()}>
            <Send className="h-4 w-4" />
            Dodaj
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historia aktywności</CardTitle>
        </CardHeader>
        {activities.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Brak zarejestrowanej aktywności.</p>
        ) : (
          <ul className="max-h-56 space-y-2 overflow-auto">
            {activities.map((a) => (
              <li key={a.id} className="flex items-start gap-3 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                <span className="text-slate-600 dark:text-slate-300">
                  <span className="font-medium text-slate-800 dark:text-slate-100">
                    {a.username || 'Użytkownik'}
                  </span>{' '}
                  {a.action}
                  <span className="ml-1 text-xs text-slate-400">· {a.created_at}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Załączniki</CardTitle>
        </CardHeader>
        <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
          <Paperclip className="h-4 w-4" />
          Dodaj plik
          <input type="file" className="hidden" onChange={handleUploadAttachment} />
        </label>
        {attachments.length > 0 && (
          <ul className="mt-3 space-y-2">
            {attachments.map((at) => (
              <li
                key={at.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950"
              >
                <a
                  href={`${API_URL}/api/attachments/${at.id}/download`}
                  onClick={async (e) => {
                    e.preventDefault();
                    const token = localStorage.getItem('access_token');
                    const r = await fetch(`${API_URL}/api/attachments/${at.id}/download`, {
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    if (r.ok) {
                      const blob = await r.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = at.original_name;
                      a.click();
                      URL.revokeObjectURL(url);
                    }
                  }}
                  className="flex min-w-0 items-center gap-2 text-sm text-indigo-600 hover:underline dark:text-indigo-300"
                >
                  <span className="min-w-0 truncate">{at.original_name}</span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {Math.round((at.size_bytes || 0) / 1024)} KB
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default EditTask;
