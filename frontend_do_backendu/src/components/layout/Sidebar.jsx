import { NavLink } from 'react-router-dom';
import { navItemsForRole } from './navItems';

export default function Sidebar({ user }) {
    const items = navItemsForRole(user?.role);
    return (
        <aside className="hidden min-h-screen w-64 shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex lg:flex-col">
            <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                <NavLink
                    to="/dashboard"
                    className="block text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100"
                >
                    TeamSync
                </NavLink>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Panel zespołu
                </p>
            </div>

            <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
                {items.map(({ to, label, icon: Icon }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                            [
                                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                                isActive
                                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100',
                            ].join(' ')
                        }
                    >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{label}</span>
                    </NavLink>
                ))}
            </nav>
            <div className="border-t border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">
                        {(user?.username || 'U').slice(0, 1).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {user?.username || 'Użytkownik'}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {user?.role || 'TeamSync'}
                        </p>
                    </div>
                </div>
            </div>
        </aside>
    );
}