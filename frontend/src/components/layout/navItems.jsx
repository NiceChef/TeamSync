import {
    LayoutDashboard,
    CheckSquare,
    CalendarDays,
    FolderKanban,
    BarChart3,
    Users,
    User,
    MoreHorizontal,
    ShieldCheck,
} from 'lucide-react';
import { ROLE } from '../../constants/roles';

export const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/projects', label: 'Projekty', icon: FolderKanban },
    { to: '/tasks', label: 'Zadania', icon: CheckSquare },
    { to: '/calendar', label: 'Kalendarz', icon: CalendarDays },
    { to: '/reports', label: 'Raporty', icon: BarChart3 },
    { to: '/groups', label: 'Działy i organizacje', icon: Users },
    {
        to: '/authorization',
        label: 'Autoryzacje',
        icon: ShieldCheck,
        internalOnly: true,
    },
    { to: '/profile', label: 'Profil', icon: User },
    { to: '/more', label: 'Więcej', icon: MoreHorizontal },
];

export function navItemsForRole(role) {
    return navItems.filter((item) => {
        if (item.internalOnly && role !== ROLE.INTERNAL) return false;
        return true;
    });
}