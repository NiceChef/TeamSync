import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTasksContext } from '../context/TasksContext';
import { API_URL, fetchWithAuth } from '../api/authFetch';

function FilterView({ isAuthenticated }) {
  const navigate = useNavigate();
  const tasksContext = useTasksContext();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Get filter state from context
  const selectedCategoryFilters = tasksContext?.selectedCategoryFilters || [];
  const statusFilter = tasksContext?.statusFilter || 'all';
  const noCategories = tasksContext?.noCategories || false;
  const setSelectedCategoryFilters = tasksContext?.setSelectedCategoryFilters;
  const setStatusFilter = tasksContext?.setStatusFilter;
  const setNoCategories = tasksContext?.setNoCategories;

  // Local state for editing filters (before applying)
  const [localSelectedCategoryFilters, setLocalSelectedCategoryFilters] = useState(selectedCategoryFilters);
  const [localStatusFilter, setLocalStatusFilter] = useState(statusFilter);
  const [localNoCategories, setLocalNoCategories] = useState(noCategories);

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
      setError(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  // Load categories and sync local state with context
  useEffect(() => {
    if (isAuthenticated) {
      fetchCategories();
      setLocalSelectedCategoryFilters(selectedCategoryFilters);
      setLocalStatusFilter(statusFilter);
      setLocalNoCategories(noCategories);
    }
  }, [isAuthenticated, selectedCategoryFilters, statusFilter, noCategories]);

  const handleApplyFilters = () => {
    // Save filters to context
    if (setSelectedCategoryFilters) {
      setSelectedCategoryFilters(localSelectedCategoryFilters);
    }
    if (setStatusFilter) {
      setStatusFilter(localStatusFilter);
    }
    if (setNoCategories) {
      setNoCategories(localNoCategories);
    }

    // Navigate back to tasks list (scroll position is saved in HeaderButtons)
    navigate('/tasks');
  };

  const handleClearFilters = () => {
    setLocalSelectedCategoryFilters([]);
    setLocalStatusFilter('all');
    setLocalNoCategories(false);
  };

  const handleCancel = () => {
    // Navigate back without saving
    navigate('/tasks');
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        Ładowanie filtrów...
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="bg-gradient-to-r from-indigo-600 to-purple-700 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
            Filtry zadań
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Zawęź listę zadań według statusu, kategorii lub braku kategorii.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCancel}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          Wróć do zadań
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-5 font-semibold text-slate-900 dark:text-slate-100">
          Opcje filtrowania
        </h3>

        <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
          <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Status
          </p>

          <div className="flex flex-wrap gap-2">
            {['all', 'pending', 'completed'].map((status) => {
              const isSelected = localStatusFilter === status;

              return (
                <label
                  key={status}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm transition ${isSelected
                      ? 'border-indigo-600 bg-indigo-600 font-semibold text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                >
                  <input
                    type="radio"
                    name="status-filter"
                    value={status}
                    checked={isSelected}
                    onChange={(e) => setLocalStatusFilter(e.target.value)}
                    className="accent-indigo-600"
                  />
                  <span>
                    {status === 'all'
                      ? 'Wszystkie'
                      : status === 'completed'
                        ? 'Zakończone'
                        : 'Otwarte'}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="pt-5">
          <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Kategorie
          </p>

          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Wybierz kategorie, które mają być widoczne na liście zadań.
          </p>

          <label
            className={`mb-3 flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition ${localNoCategories
                ? 'border-indigo-600 bg-indigo-50 text-indigo-900 dark:bg-indigo-500/15 dark:text-indigo-100'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
          >
            <input
              type="checkbox"
              checked={localNoCategories}
              onChange={(e) => setLocalNoCategories(e.target.checked)}
              className="accent-indigo-600"
            />
            <span className="font-medium">Zadania bez kategorii</span>
          </label>

          {categories.length === 0 ? (
            <p className="text-sm italic text-slate-500 dark:text-slate-400">
              Brak kategorii. Utwórz kategorie najpierw.
            </p>
          ) : (
            <div className="space-y-2">
              {categories.map((cat) => {
                const isSelected = localSelectedCategoryFilters.includes(cat.id);

                return (
                  <label
                    key={cat.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition ${isSelected
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15'
                        : 'border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-800'
                      }`}
                    style={{
                      borderColor: isSelected ? cat.color || '#6366f1' : undefined,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setLocalSelectedCategoryFilters([
                            ...localSelectedCategoryFilters,
                            cat.id,
                          ]);
                        } else {
                          setLocalSelectedCategoryFilters(
                            localSelectedCategoryFilters.filter((id) => id !== cat.id)
                          );
                        }
                      }}
                      className="accent-indigo-600"
                    />

                    <span
                      className="h-4 w-4 shrink-0 rounded-full"
                      style={{ backgroundColor: cat.color || '#667eea' }}
                    />

                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {cat.name}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-2 border-t border-slate-200 pt-5 dark:border-slate-800 sm:flex-row">
          <button
            type="button"
            onClick={handleClearFilters}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Wyczyść filtry
          </button>

          <button
            type="button"
            onClick={handleApplyFilters}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-purple-700 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:-translate-y-0.5"
          >
            Zastosuj filtry
          </button>
        </div>
      </section>
    </div>
  );
}

export default FilterView;
