import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout.jsx';
import Login from './components/Login';
import Register from './components/Register';
import TasksGrid from './components/tasks/TasksGrid';
import TaskDetail from './components/tasks/TaskDetail';
import CreateCategory from './components/CreateCategory';
import More from './components/More';
import CalendarView from './components/calendar/CalendarView';
import FilterView from './components/FilterView';
import Profile from './components/Profile';
import Groups from './components/Groups';
import Dashboard from './components/dashboard/Dashboard.jsx';
import ProjectsList from './components/projects/ProjectsList.jsx';
import ProjectDetail from './components/projects/ProjectDetail.jsx';
// Leniwie — recharts trafia do osobnego chunku zamiast głównego bundla.
const Reports = lazy(() => import('./components/reports/Reports.jsx'));
import { TasksProvider } from './context/TasksContext';
import { TaskDrawerProvider } from './context/TaskDrawerContext';
import { AuthProvider } from './context/AuthContext';

function AuthenticatedApp({ user, handleLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user && (location.pathname === '/' || location.pathname === '/admin')) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, location.pathname, navigate]);

  return (
    <AppLayout user={user} onLogout={handleLogout}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard isAuthenticated />} />
        <Route path="/projects" element={<ProjectsList isAuthenticated />} />
        <Route path="/projects/:id" element={<ProjectDetail isAuthenticated />} />
        <Route path="/tasks" element={<TasksGrid isAuthenticated />} />
        <Route path="/tasks/filter" element={<FilterView isAuthenticated />} />
        <Route path="/tasks/:id" element={<TaskDetail isAuthenticated />} />
        <Route path="/categories/new" element={<CreateCategory isAuthenticated />} />
        <Route path="/more" element={<More isAuthenticated />} />
        <Route path="/profile" element={<Profile isAuthenticated />} />
        <Route path="/groups" element={<Groups isAuthenticated />} />
        <Route path="/calendar" element={<CalendarView isAuthenticated />} />
        <Route
          path="/reports"
          element={
            <Suspense fallback={<div className="p-8 text-sm text-slate-500 dark:text-slate-400">Ładowanie raportów…</div>}>
              <Reports isAuthenticated />
            </Suspense>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppLayout>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('access_token');

    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (userData) => {
    const savedToken = localStorage.getItem('access_token');
    if (savedToken) {
      setUser(userData);
      setIsAuthenticated(true);
      setShowRegister(false);
    } else {
      console.error('Token not found in localStorage after login');
    }
  };

  const handleRegister = (userData) => {
    const savedToken = localStorage.getItem('access_token');
    if (savedToken) {
      setUser(userData);
      setIsAuthenticated(true);
      setShowRegister(false);
    } else {
      console.error('Token not found in localStorage after registration');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <BrowserRouter>
      {!isAuthenticated ? (
        showRegister ? (
          <Register
            onRegister={handleRegister}
            onSwitchToLogin={() => setShowRegister(false)}
          />
        ) : (
          <Login
            onLogin={handleLogin}
            onSwitchToRegister={() => setShowRegister(true)}
          />
        )
      ) : (
        <AuthProvider isAuthenticated>
          <TasksProvider>
            <TaskDrawerProvider>
              <AuthenticatedApp user={user} handleLogout={handleLogout} />
            </TaskDrawerProvider>
          </TasksProvider>
        </AuthProvider>
      )}
    </BrowserRouter>
  );
}
