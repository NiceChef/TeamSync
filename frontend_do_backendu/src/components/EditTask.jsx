import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function EditTask({ isAuthenticated }) {
  const { id } = useParams();
  const navigate = useNavigate();
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
    version: 1,
  });

  const [taskStatuses, setTaskStatuses] = useState([]);
  const [assignUsers, setAssignUsers] = useState([]);
  const [groupsList, setGroupsList] = useState([]);
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
          setError('Task not found');
          navigate('/tasks');
          return;
        }
        if (response.status === 401) {
          setError('Authentication failed. Please log in again.');
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          navigate('/');
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch task');
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
        version: taskData.version ?? 1,
      });
    } catch (err) {
      setError(err.message || 'Failed to fetch task');
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
      setError('Topic is required');
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
        throw new Error(errorData.error || 'Failed to update task');
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
      navigate('/tasks', { state: { scrollToTaskId: editingTask.id } });
    } catch (err) {
      setError(err.message || 'Failed to update task');
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
    navigate('/tasks');
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
        throw new Error(errorData.error || 'Failed to create subtask relation');
      }

      await fetchTask();
      await fetchAllTasks();
      setSelectedSubtaskId('');

      // Przekieruj do listy tasków z informacją o subtasku do przewinięcia
      navigate('/tasks', { state: { scrollToTaskId: parseInt(targetTaskId) } });
    } catch (err) {
      setError(err.message || 'Failed to add subtask');
    }
  };

  const handleRemoveSubtaskRelation = async (taskId, relationId) => {
    if (!window.confirm('Are you sure you want to remove this subtask?')) {
      return;
    }

    try {
      setError('');

      const response = await fetchWithAuth(`${API_URL}/api/relations/${relationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove subtask relation');
      }

      await fetchTask();
      await fetchAllTasks();
    } catch (err) {
      setError(err.message || 'Failed to remove subtask');
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
      <div className="more-container">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>Loading task...</p>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="more-container">
        <div className="more-header">
          <h2>Edit Task</h2>
          <button
            onClick={() => navigate('/tasks')}
            className="back-button"
          >
            ← Back to Tasks
          </button>
        </div>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>Task not found</p>
        </div>
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
        throw new Error(errorData.error || 'Failed to create parent relation');
      }

      await fetchTask();
      await fetchAllTasks();
      setSelectedParentTaskId('');

      // Przekieruj do listy tasków z informacją o tasku do przewinięcia
      navigate('/tasks', { state: { scrollToTaskId: parseInt(childTaskId) } });
    } catch (err) {
      setError(err.message || 'Failed to add parent task');
    }
  };

  // Funkcja do usuwania parent taska
  const handleRemoveParentRelation = async (relationId) => {
    if (!window.confirm('Are you sure you want to remove this parent task?')) {
      return false;
    }

    try {
      setError('');

      const response = await fetchWithAuth(`${API_URL}/api/relations/${relationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove parent relation');
      }

      await fetchTask();
      await fetchAllTasks();
      return true;
    } catch (err) {
      setError(err.message || 'Failed to remove parent task');
      return false;
    }
  };

  return (
    <div className="more-container">
      <div className="more-header">
        <h2>Edit Task</h2>
        <button
          onClick={() => navigate('/tasks')}
          className="back-button"
        >
          ← Back to Tasks
        </button>
      </div>

      {error && (
        <div className="error-message" style={{
          padding: '1rem',
          marginBottom: '1rem',
          background: '#fee',
          border: '1px solid #fcc',
          borderRadius: '6px',
          color: '#c33'
        }}>
          {error}
        </div>
      )}

      <div className="more-content">
        <div className="more-section">
          <h3>Task Details</h3>
          <form onSubmit={handleUpdateTask}>
            <div className="form-row">
              {/* ✅ PIERWSZA LINIA: Planned Date i Deadline obok siebie */}
              <div className="form-group" style={{ flex: '1' }}>
                <label htmlFor="edit-planned_date">Planned Date</label>
                <input
                  type="date"
                  id="edit-planned_date"
                  name="planned_date"
                  value={editingTask.planned_date}
                  onChange={handleEditInputChange}
                  disabled={submitting}
                />
              </div>
              <div className="form-group" style={{ flex: '1' }}>
                <label htmlFor="edit-deadline">Deadline</label>
                <input
                  type="date"
                  id="edit-deadline"
                  name="deadline"
                  value={editingTask.deadline}
                  onChange={handleEditInputChange}
                  disabled={submitting}
                />
              </div>
            </div>

            {/* ✅ DRUGA LINIA: Topic na całą szerokość */}
            <div className="form-group" style={{ width: '100%', marginTop: '1rem' }}>
              <label htmlFor="edit-topic">Topic *</label>
              <input
                type="text"
                id="edit-topic"
                name="topic"
                value={editingTask.topic}
                onChange={handleEditInputChange}
                placeholder="Enter task topic"
                required
                disabled={submitting}
              />
            </div>

            {/* ✅ TRZECIA LINIA: Notes na całą szerokość */}
            <div className="form-group" style={{ width: '100%', marginTop: '1rem' }}>
              <label htmlFor="edit-notes">Notes</label>
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
                style={{
                  width: '100%',
                  minHeight: '150px',
                  padding: '0.5rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  overflow: 'auto',
                  backgroundColor: submitting ? '#f7fafc' : 'white',
                  cursor: submitting ? 'not-allowed' : 'text'
                }}
                data-placeholder="Add notes, links, dates, drawings..."
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
                border-radius: 4px;
              }
            `}</style>
            </div>

            <div className="form-group checkbox-group" style={{ marginTop: '1rem' }}>
              <label>
                <input
                  type="checkbox"
                  name="completed"
                  checked={editingTask.completed}
                  onChange={handleEditInputChange}
                  disabled={submitting}
                />
                Mark as completed
              </label>
            </div>

            <div
              className="form-row"
              style={{ marginTop: '1rem', flexWrap: 'wrap', gap: '1rem', display: 'flex' }}
            >
              <div className="form-group" style={{ flex: '1', minWidth: '140px' }}>
                <label htmlFor="edit-status">Status (baza)</label>
                <select
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
                </select>
              </div>
              <div className="form-group" style={{ flex: '1', minWidth: '120px' }}>
                <label htmlFor="edit-priority">Priorytet</label>
                <select
                  id="edit-priority"
                  name="priority"
                  value={editingTask.priority}
                  onChange={handleEditInputChange}
                  disabled={submitting}
                >
                  <option value="low">Niski</option>
                  <option value="medium">Średni</option>
                  <option value="high">Wysoki</option>
                </select>
              </div>
              {meUser && meUser.role !== 'client' && (
                <>
                  <div className="form-group" style={{ flex: '1', minWidth: '160px' }}>
                    <label htmlFor="edit-assignee">Przypisany</label>
                    <select
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
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: '1', minWidth: '160px' }}>
                    <label htmlFor="edit-group">Grupa</label>
                    <select
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
                    </select>
                  </div>
                </>
              )}
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '0.5rem' }}>
              Wersja optymistyczna: {editingTask.version} (przy zapisie wykrywany konflikt edycji)
            </p>

            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
              <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600 }}>Categories:</label>
              {categories.length === 0 ? (
                <p style={{ color: '#666', fontSize: '0.875rem', fontStyle: 'italic' }}>
                  No categories available. Create categories using the "Categories" button on the tasks page.
                </p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {categories.map(cat => {
                    const taskCategories = editingTask.categories || [];
                    const isAssigned = taskCategories.some(tc => tc.id === cat.id);
                    return (
                      <label
                        key={cat.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.5rem 1rem',
                          background: isAssigned ? (cat.color ? `${cat.color}20` : '#f7fafc') : 'white',
                          border: `2px solid ${isAssigned ? (cat.color || '#667eea') : '#e2e8f0'}`,
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isAssigned}
                          onChange={() => handleToggleTaskCategory(cat.id, isAssigned)}
                          disabled={submitting}
                          style={{ cursor: 'pointer' }}
                        />
                        <span
                          style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            background: cat.color || '#667eea',
                            display: 'inline-block'
                          }}
                        />
                        <span style={{ fontWeight: isAssigned ? 600 : 400 }}>
                          {cat.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
              <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600 }}>Parent Task:</label>
              {incomingRelations.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>Current parent task:</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {incomingRelations.map(rel => {
                      const parentTask = tasks.find(t => t.id === rel.source_task_id);
                      return parentTask ? (
                        <div
                          key={rel.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.5rem 1rem',
                            background: '#f7fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            fontSize: '0.875rem'
                          }}
                        >
                          <span>{parentTask.topic}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveParentRelation(rel.id)}
                            className="rounded-md border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            disabled={submitting}
                          >
                            Remove
                          </button>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
              <div>
                <label htmlFor="parent-task-select" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  {incomingRelations.length > 0 ? 'Change parent task:' : 'Add parent task:'}
                </label>
                <div className="select-with-button-container" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <select
                    id="parent-task-select"
                    value={selectedParentTaskId}
                    onChange={(e) => {
                      setSelectedParentTaskId(e.target.value);
                      setError('');
                    }}
                    disabled={submitting || availableParentTasks.length === 0}
                    style={{
                      flex: 1,
                      padding: '8px',
                      fontSize: '14px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      width: '100%',
                      maxWidth: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="">-- Select a task --</option>
                    {availableParentTasks.length === 0 ? (
                      <option value="" disabled>No available tasks to add as parent</option>
                    ) : (
                      availableParentTasks.map(task => (
                        <option key={task.id} value={task.id}>
                          {task.topic} {task.completed ? '(Completed)' : ''}
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={async () => {
                      if (selectedParentTaskId) {
                        // Jeśli już jest parent, najpierw usuń stary
                        if (incomingRelations.length > 0) {
                          const oldRelation = incomingRelations[0];
                          const removed = await handleRemoveParentRelation(oldRelation.id);
                          if (removed) {
                            // Po usunięciu dodaj nowy
                            await handleCreateParentRelation(selectedParentTaskId, editingTask.id);
                          }
                        } else {
                          await handleCreateParentRelation(selectedParentTaskId, editingTask.id);
                        }
                      }
                    }}
                    className="rounded-lg bg-gradient-to-r from-indigo-600 to-purple-700 px-5 py-2.5 text-sm font-semibold text-white shadow hover:-translate-y-0.5 disabled:opacity-50"
                    disabled={submitting || !selectedParentTaskId || availableParentTasks.length === 0}
                    style={{ padding: '8px 16px', fontSize: '0.875rem' }}
                  >
                    {incomingRelations.length > 0 ? 'Change' : 'Add'}
                  </button>
                </div>
                {availableParentTasks.length === 0 && (
                  <p style={{ marginTop: '8px', fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                    All tasks are already related to this task or would create a cycle.
                  </p>
                )}
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
              <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600 }}>Subtasks:</label>
              {outgoingRelations.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>Current subtasks:</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {outgoingRelations.map(rel => {
                      const subtask = tasks.find(t => t.id === rel.target_task_id);
                      return subtask ? (
                        <div
                          key={rel.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.5rem 1rem',
                            background: '#f7fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            fontSize: '0.875rem'
                          }}
                        >
                          <span>{subtask.topic}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSubtaskRelation(editingTask.id, rel.id)}
                            className="rounded-md border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            disabled={submitting}
                          >
                            Remove
                          </button>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
              <div>
                <label htmlFor="subtask-select" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  Add new subtask:
                </label>
                <div className="select-with-button-container" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <select
                    id="subtask-select"
                    value={selectedSubtaskId}
                    onChange={(e) => {
                      setSelectedSubtaskId(e.target.value);
                      setError('');
                    }}
                    disabled={submitting || availableTasks.length === 0}
                    style={{
                      flex: 1,
                      padding: '8px',
                      fontSize: '14px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      width: '100%',
                      maxWidth: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="">-- Select a task --</option>
                    {availableTasks.length === 0 ? (
                      <option value="" disabled>No available tasks to add as subtask</option>
                    ) : (
                      availableTasks.map(task => (
                        <option key={task.id} value={task.id}>
                          {task.topic} {task.completed ? '(Completed)' : ''}
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedSubtaskId) {
                        handleCreateSubtaskRelation(editingTask.id, selectedSubtaskId);
                      }
                    }}
                    className="rounded-lg bg-gradient-to-r from-indigo-600 to-purple-700 px-5 py-2.5 text-sm font-semibold text-white shadow hover:-translate-y-0.5 disabled:opacity-50"
                    disabled={submitting || !selectedSubtaskId || availableTasks.length === 0}
                    style={{ padding: '8px 16px', fontSize: '0.875rem' }}
                  >
                    Add
                  </button>
                </div>
                {availableTasks.length === 0 && (
                  <p style={{ marginTop: '8px', fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                    All tasks are already related to this task or would create a cycle.
                  </p>
                )}
              </div>
            </div>

            <div
              style={{
                marginTop: '1.5rem',
                paddingTop: '1.5rem',
                borderTop: '1px solid #e2e8f0',
              }}
            >
              <h4 style={{ marginBottom: '0.75rem', fontWeight: 600 }}>Komentarze</h4>
              <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1rem' }}>
                {comments.map((c) => (
                  <li
                    key={c.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      padding: '0.5rem 0.75rem',
                      marginBottom: 8,
                      fontSize: '0.875rem',
                    }}
                  >
                    <strong>{c.author_username || 'Użytkownik'}</strong>{' '}
                    <span style={{ color: '#64748b' }}>{c.created_at}</span>
                    <div style={{ marginTop: 4 }}>{c.body}</div>
                  </li>
                ))}
              </ul>
              <form onSubmit={handleAddComment} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Treść komentarza"
                  style={{ flex: 1, minWidth: 200, padding: '0.5rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
                <button
                  type="submit"
                  className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-white"
                  disabled={submitting}
                >
                  Dodaj
                </button>
              </form>
            </div>

            <div
              style={{
                marginTop: '1.5rem',
                paddingTop: '1.5rem',
                borderTop: '1px solid #e2e8f0',
              }}
            >
              <h4 style={{ marginBottom: '0.75rem', fontWeight: 600 }}>Historia aktywności</h4>
              <ul style={{ fontSize: '0.8rem', color: '#475569', maxHeight: 200, overflow: 'auto' }}>
                {activities.map((a) => (
                  <li key={a.id} style={{ marginBottom: 6 }}>
                    [{a.created_at}] {a.username || '?'} — {a.action}
                  </li>
                ))}
              </ul>
            </div>

            <div
              style={{
                marginTop: '1.5rem',
                paddingTop: '1.5rem',
                borderTop: '1px solid #e2e8f0',
              }}
            >
              <h4 style={{ marginBottom: '0.75rem', fontWeight: 600 }}>Załączniki</h4>
              <label className="inline-flex cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">
                Wybierz plik
                <input type="file" className="hidden" onChange={handleUploadAttachment} />
              </label>
              <ul style={{ marginTop: '0.75rem', fontSize: '0.875rem' }}>
                {attachments.map((at) => (
                  <li key={at.id} style={{ marginBottom: 4 }}>
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
                    >
                      {at.original_name}
                    </a>{' '}
                    ({Math.round((at.size_bytes || 0) / 1024)} KB)
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
              <button
                type="submit"
                className="rounded-lg bg-gradient-to-r from-indigo-600 to-purple-700 px-5 py-2.5 text-sm font-semibold text-white shadow hover:-translate-y-0.5 disabled:opacity-50"
                disabled={submitting}
              >
                {submitting ? 'Updating...' : 'Update Task'}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default EditTask;
