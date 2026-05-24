import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from './ui/Button';
import { Card, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { Field, FieldLabel, FieldError } from './ui/Field';
import TextInput from './ui/TextInput';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function CreateCategory({ isAuthenticated }) {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState({ name: '', color: '#667eea' });

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
      fetchCategories();
    }
  }, [isAuthenticated]);

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategory.name.trim()) {
      setError('Nazwa kategorii jest wymagana');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const response = await fetchWithAuth(`${API_URL}/api/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newCategory),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Nie udało się utworzyć kategorii');
      }

      // Przekieruj do listy tasków
      navigate('/tasks');
    } catch (err) {
      setError(err.message || 'Nie udało się utworzyć kategorii');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/tasks');
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="bg-gradient-to-r from-indigo-600 to-purple-700 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
            Nowa kategoria
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Utwórz kategorię i wybierz kolor używany przy zadaniach.
          </p>
        </div>

        <Button onClick={() => navigate('/tasks')}>
          Wróć do zadań
        </Button>
      </div>

      <FieldError>{error}</FieldError>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Szczegóły kategorii</CardTitle>
          </CardHeader>

          <form onSubmit={handleCreateCategory} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <Field>
                <FieldLabel>Nazwa kategorii *</FieldLabel>
                <TextInput
                  type="text"
                  id="category-name"
                  name="name"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  placeholder="Wpisz nazwę kategorii"
                  required
                  disabled={submitting}
                />
              </Field>

              <label className="block">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Kolor
                </span>
                <input
                  type="color"
                  id="category-color"
                  name="color"
                  value={newCategory.color}
                  onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                  disabled={submitting}
                  className="mt-1 h-10 w-16 cursor-pointer rounded-lg border border-slate-300 bg-white p-1 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="submit"
                className="rounded-lg bg-gradient-to-r from-indigo-600 to-purple-700 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:-translate-y-0.5 disabled:opacity-50"
                disabled={submitting}
              >
                {submitting ? 'Tworzenie...' : 'Utwórz kategorię'}
              </button>

              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                disabled={submitting}
              >
                Anuluj
              </button>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Twoje kategorie</CardTitle>
          </CardHeader>

          {categories.length === 0 ? (
            <p className="text-sm italic text-slate-500 dark:text-slate-400">
              Brak kategorii. Utwórz pierwszą kategorię.
            </p>
          ) : (
            <div className="space-y-2">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950"
                >
                  <span
                    className="h-4 w-4 shrink-0 rounded-full"
                    style={{ backgroundColor: cat.color || '#667eea' }}
                  />
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {cat.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default CreateCategory;
