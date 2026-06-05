import { useState, useEffect, useCallback } from 'react';
import { KeyRound, Mail, Phone, Save, Shield, UserRound } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const profileFields = [
  { key: 'username', label: 'Nazwa użytkownika' },
  { key: 'email', label: 'E-mail' },
  { key: 'first_name', label: 'Imię' },
  { key: 'last_name', label: 'Nazwisko' },
  { key: 'phone', label: 'Telefon' },
];

export default function Profile({ isAuthenticated }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
  });
  const [pw, setPw] = useState({ old_password: '', new_password: '' });
  const [forgotEmail, setForgotEmail] = useState('');

  const token = () => localStorage.getItem('access_token');

  const fetchMe = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Błąd');
      setUser(d);
      setForm({
        username: d.username || '',
        email: d.email || '',
        first_name: d.first_name || '',
        last_name: d.last_name || '',
        phone: d.phone || '',
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchMe();
  }, [isAuthenticated, fetchMe]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      const r = await fetch(`${API_URL}/api/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Błąd zapisu');
      setUser(d);
      localStorage.setItem('user', JSON.stringify(d));
      setMsg('Profil zapisany.');
    } catch (e) {
      setError(e.message);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      const r = await fetch(`${API_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify(pw),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Błąd');
      setPw({ old_password: '', new_password: '' });
      setMsg(d.message || 'Hasło zmienione.');
    } catch (e) {
      setError(e.message);
    }
  };

  const forgotPassword = async (e) => {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      const r = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Błąd');
      let m = d.message || 'OK';
      if (d.dev_reset_token) {
        m += ` (dev token: ${d.dev_reset_token})`;
      }
      setMsg(m);
    } catch (e) {
      setError(e.message);
    }
  };

  if (!isAuthenticated) return null;
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        Ładowanie profilu…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <h2 className="bg-gradient-to-r from-indigo-600 to-purple-700 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
          Profil
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Zarządzaj danymi konta, hasłem i adresem do resetu.
        </p>
      </div>

      {user && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Rola użytkownika</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">{user.role}</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {msg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
          {msg}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <form onSubmit={saveProfile} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Dane profilu</h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {profileFields.map((field) => (
              <label key={field.key} className="block">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  {field.label}
                </span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  value={form[field.key]}
                  onChange={(e) => setForm((p) => ({ ...p, [field.key]: e.target.value }))}
                />
              </label>
            ))}
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:shadow-md"
          >
            <Save className="h-4 w-4" />
            Zapisz profil
          </button>
        </form>

        <div className="space-y-6">
          <form onSubmit={changePassword} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Zmiana hasła</h3>
            </div>

            <input
              type="password"
              placeholder="Obecne hasło"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              value={pw.old_password}
              onChange={(e) => setPw((p) => ({ ...p, old_password: e.target.value }))}
            />

            <input
              type="password"
              placeholder="Nowe hasło (min. 6 znaków)"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              value={pw.new_password}
              onChange={(e) => setPw((p) => ({ ...p, new_password: e.target.value }))}
            />

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              <KeyRound className="h-4 w-4" />
              Zmień hasło
            </button>
          </form>

          <form onSubmit={forgotPassword} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Reset hasła</h3>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              W środowisku developerskim API może zwrócić token w odpowiedzi.
            </p>

            <input
              type="email"
              placeholder="Adres e-mail konta"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
            />

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-800 transition hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200"
            >
              <Phone className="h-4 w-4" />
              Wyślij żądanie resetu
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
