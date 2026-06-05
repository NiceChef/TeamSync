import { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-50';

export default function Register({ onRegister, onSwitchToLogin }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const validateForm = () => {
    if (formData.password.length < 6) {
      setError('Hasło musi mieć co najmniej 6 znaków');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Hasła nie są takie same');
      return false;
    }
    if (!formData.email.includes('@')) {
      setError('Podaj poprawny adres e-mail');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const registerResponse = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const registerData = await registerResponse.json();

      if (!registerResponse.ok) {
        throw new Error(registerData.error || 'Registration failed');
      }

      const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const loginData = await loginResponse.json();

      if (!loginResponse.ok) {
        throw new Error('Rejestracja OK, ale logowanie nie powiodło się. Spróbuj zalogować się ręcznie.');
      }

      localStorage.setItem('access_token', loginData.access_token);
      localStorage.setItem('refresh_token', loginData.refresh_token);
      localStorage.setItem('user', JSON.stringify(loginData.user));

      if (onRegister) {
        onRegister(loginData.user, loginData.access_token);
      }
    } catch (err) {
      setError(err.message || 'Błąd rejestracji');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-violet-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Rejestracja</h1>
          <p className="mt-1 text-sm text-slate-600">Utwórz konto w Tasks Manager</p>
          <p className="mt-2 text-xs text-slate-500">
            Nazwa użytkownika i proponowana organizacja zostaną utworzone automatycznie na podstawie adresu e-mail.
            Po rejestracji konto musi zostać zatwierdzone przez użytkownika TeamSync.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              role="alert"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="text-sm font-medium text-slate-700">
              E-mail
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              autoComplete="email"
              disabled={loading}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Hasło (min. 6 znaków)
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete="new-password"
              disabled={loading}
              minLength={6}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">
              Powtórz hasło
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              autoComplete="new-password"
              disabled={loading}
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white shadow hover:bg-violet-700 disabled:opacity-50"
          >
            {loading ? 'Tworzenie konta…' : 'Zarejestruj się'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Masz już konto?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-semibold text-violet-600 hover:text-violet-800"
          >
            Zaloguj się
          </button>
        </p>
      </div>
    </div>
  );
}
