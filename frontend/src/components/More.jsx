import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Check,
  Columns3,
  Download,
  FileJson,
  FileSpreadsheet,
  RefreshCw,
  Settings,
  Tags,
  Upload,
} from 'lucide-react';
import { useTasksContext } from '../context/tasks-context';
import { API_URL, fetchWithAuth } from '../api/authFetch';

function More({ isAuthenticated }) {
  const navigate = useNavigate();
  const tasksContext = useTasksContext();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notifications, setNotifications] = useState([]);

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
    } finally {
      setLoading(false);
    }
  };

  const loadNotifications = async () => {
    try {
      const r = await fetchWithAuth(`${API_URL}/api/notifications`);
      if (r.ok) setNotifications(await r.json());
    } catch {
      setNotifications([]);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchCategories();
      loadNotifications();
    }
  }, [isAuthenticated]);

  const markNotificationRead = async (nid) => {
    try {
      await fetchWithAuth(`${API_URL}/api/notifications/${nid}/read`, { method: 'POST' });
      await loadNotifications();
    } catch {
      /* ignore */
    }
  };

  if (!tasksContext) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-slate-600">Ładowanie…</p>
      </div>
    );
  }

  const { onExportJSON, onExportXLSX, onImport, submitting, visibleColumns, setVisibleColumns } =
    tasksContext;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <h2 className="bg-gradient-to-r from-indigo-600 to-purple-700 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
          Więcej
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Powiadomienia, raporty, eksport danych i ustawienia widoku zadań.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  Powiadomienia
                </h3>
              </div>

              <button
                type="button"
                onClick={loadNotifications}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <RefreshCw className="h-4 w-4" />
                Odśwież
              </button>
            </div>

            {notifications.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Brak powiadomień.
              </div>
            ) : (
              <ul className="space-y-2">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={`rounded-xl border px-3 py-3 text-sm ${n.read
                      ? 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300'
                      : 'border-indigo-200 bg-indigo-50 text-slate-900 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-slate-100'
                      }`}
                  >
                    <span>{n.message}</span>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>{n.created_at}</span>

                      {!n.read && (
                        <button
                          type="button"
                          onClick={() => markNotificationRead(n.id)}
                          className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Oznacz jako przeczytane
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Raporty
              </h3>
            </div>

            <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
              Postęp zadań, grup i aktywność zespołu w formie wykresów.
            </p>

            <button
              type="button"
              onClick={() => navigate('/reports')}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:shadow-md"
            >
              <BarChart3 className="h-4 w-4" />
              Otwórz raporty
            </button>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2">
              <Download className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Eksport i import
              </h3>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={onExportJSON}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                <FileJson className="h-4 w-4" />
                Eksport JSON
              </button>

              <button
                type="button"
                onClick={onExportXLSX}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Eksport XLSX
              </button>

              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:shadow-md sm:col-span-2">
                <Upload className="h-4 w-4" />
                Import
                <input
                  type="file"
                  accept=".json,.xlsx,.xls"
                  onChange={onImport}
                  className="hidden"
                  disabled={submitting}
                />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2">
              <Columns3 className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Widoczne kolumny
              </h3>
            </div>

            <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
              Wybierz kolumny dat w tabeli zadań. Zapis odbywa się automatycznie.
            </p>

            <div className="flex flex-col gap-2">
              {[
                { key: 'created', label: 'Utworzono' },
                { key: 'soonest_action', label: 'Najbliższa akcja' },
                { key: 'planned_date', label: 'Plan' },
                { key: 'deadline', label: 'Deadline' },
              ].map((column) => (
                <label
                  key={column.key}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition hover:bg-indigo-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-indigo-500/10"
                >
                  <input
                    type="checkbox"
                    checked={!!visibleColumns?.[column.key]}
                    onChange={(e) => {
                      setVisibleColumns?.((prev) => ({
                        ...prev,
                        [column.key]: e.target.checked,
                      }));
                    }}
                  />
                  <span className="text-sm text-slate-800 dark:text-slate-200">
                    {column.label}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Tags className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  Kategorie
                </h3>
              </div>

              <button
                type="button"
                onClick={() => navigate('/categories/new')}
                className="inline-flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-800 transition hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200"
              >
                <Settings className="h-4 w-4" />
                Zarządzaj
              </button>
            </div>

            {loading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Ładowanie kategorii...
              </p>
            ) : error ? (
              <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
            ) : categories.length > 0 ? (
              <ul className="space-y-2">
                {categories.map((category) => (
                  <li
                    key={category.id}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: category.color || '#6366f1' }}
                    />
                    <span className="text-sm text-slate-800 dark:text-slate-200">
                      {category.name}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Brak kategorii. Utwórz pierwszą.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default More;
