import {
    LayoutDashboard,
    CheckSquare,
    CalendarDays,
    Users,
    User,
    MoreHorizontal,
} from 'lucide-react';

export const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/tasks', label: 'Zadania', icon: CheckSquare },
    { to: '/calendar', label: 'Kalendarz', icon: CalendarDays },
    { to: '/groups', label: 'Grupy', icon: Users },
    { to: '/profile', label: 'Profil', icon: User },
    { to: '/more', label: 'Więcej', icon: MoreHorizontal },
];