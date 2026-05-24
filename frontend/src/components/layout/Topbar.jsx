import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Menu, Moon, Sun, User } from 'lucide-react';
import { navItemsForRole } from './navItems';
import NotificationsBell from '../notifications/NotificationsBell';
import GlobalSearch from '../search/GlobalSearch';

export default function Topbar({ user, onLogout }) {
    const navigate = useNavigate();

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('teamsync-theme') || 'light';
    });

    useEffect(() => {
        const root = document.documentElement;

        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }

        localStorage.setItem('teamsync-theme', theme);
    }, [theme]);

    const goTo = (path) => {
        navigate(path);
        setIsMenuOpen(false);
    };

    const handleLogoutClick = () => {
        const confirmed = window.confirm('Czy na pewno chcesz się wylogować?');
        if (confirmed) {
            onLogout();
        }
    };

    return (
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
            <div className="flex min-h-[64px] items-center justify-between gap-3 px-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="relative lg:hidden">
                        <button
                            type="button"
                            onClick={() => setIsMenuOpen((value) => !value)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                            aria-label="Otwórz menu"
                        >
                            <Menu className="h-5 w-5" />
                        </button>

                        {isMenuOpen && (
                            <div className="absolute left-0 top-12 z-50 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                                {navItemsForRole(user?.role).map(({ to, label, icon: Icon }) => (
                                    <button
                                        key={to}
                                        type="button"
                                        onClick={() => goTo(to)}
                                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                                    >
                                        <Icon className="h-4 w-4 shrink-0" />
                                        <span>{label}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            TeamSync
                        </p>
                        <p className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">
                            Witaj, {user?.username || 'użytkowniku'}
                        </p>
                    </div>
                </div>

                <div className="hidden min-w-0 flex-1 justify-center px-4 md:flex">
                    <GlobalSearch />
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <NotificationsBell />

                    <button
                        type="button"
                        onClick={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                        aria-label={theme === 'dark' ? 'Włącz jasny motyw' : 'Włącz ciemny motyw'}
                        title={theme === 'dark' ? 'Jasny motyw' : 'Ciemny motyw'}
                    >
                        {theme === 'dark' ? (
                            <Sun className="h-5 w-5" />
                        ) : (
                            <Moon className="h-5 w-5" />
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => navigate('/profile')}
                        className="hidden h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 sm:inline-flex"
                    >
                        <User className="h-4 w-4" />
                        Konto
                    </button>

                    <button
                        type="button"
                        onClick={handleLogoutClick}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                        aria-label="Wyloguj"
                        title="Wyloguj"
                    >
                        <LogOut className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </header>
    );
}