import { NavLink } from 'react-router-dom';
import { Layers3 } from 'lucide-react';

import { navItemsForRole } from './navItems';

export default function Sidebar({ user }) {
    const items = navItemsForRole(user?.role);

    return (
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex lg:flex-col">
            <div className="flex h-[65px] shrink-0 items-center border-b border-slate-200 px-5 dark:border-slate-800">
                <NavLink
                    to="/dashboard"
                    className="flex min-w-0 items-center gap-3"
                >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
                        <Layers3 className="h-5 w-5" />
                    </span>

                    <span className="min-w-0">
                        <span className="block truncate text-base font-bold text-slate-900 dark:text-slate-100">
                            TeamSync
                        </span>

                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                            Zarządzanie zespołem
                        </span>
                    </span>
                </NavLink>
            </div>

            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-5">
                <p className="mb-2 px-3 text-xs font-semibold uppercase text-slate-400">
                    Nawigacja
                </p>

                {items.map(({ to, label, icon: Icon }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                            [
                                'group relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                                isActive
                                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200'
                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100',
                            ].join(' ')
                        }
                    >
                        {({ isActive }) => (
                            <>
                                {isActive && (
                                    <span className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full bg-indigo-600 dark:bg-indigo-400" />
                                )}

                                <Icon
                                    className={[
                                        'h-[18px] w-[18px] shrink-0 transition',
                                        isActive
                                            ? 'text-indigo-600 dark:text-indigo-300'
                                            : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200',
                                    ].join(' ')}
                                />

                                <span className="min-w-0 truncate">
                                    {label}
                                </span>
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            <div className="shrink-0 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
                <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                    Organizacja
                </p>

                <p className="mt-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {user?.organization_name || 'Brak organizacji'}
                </p>
            </div>
        </aside>
    );
}