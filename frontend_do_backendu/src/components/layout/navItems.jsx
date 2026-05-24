import {
    LayoutDashboard,
    CheckSquare,
    CalendarDays,
    FolderKanban,
    BarChart3,
    Users,
    User,
    MoreHorizontal,
} from 'lucide-react';
import { ROLE } from '../../constants/roles';

export const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/projects', label: 'Projekty', icon: FolderKanban },
    { to: '/tasks', label: 'Zadania', icon: CheckSquare },
    { to: '/calendar', label: 'Kalendarz', icon: CalendarDays },
    { to: '/reports', label: 'Raporty', icon: BarChart3 },
    { to: '/groups', label: 'Grupy', icon: Users, employeeOnly: true },
    { to: '/profile', label: 'Profil', icon: User },
    { to: '/more', label: 'Więcej', icon: MoreHorizontal },
];

// Pozycje widoczne dla danej roli — konta `client` nie widzą pozycji employee-only.
export function navItemsForRole(role) {
    return navItems.filter((item) => !(item.employeeOnly && role === ROLE.CLIENT));
}