function calendarDayCellClass(day, { isSelected, inRange, isToday, hasTask }) {
    const base =
        'relative flex aspect-square cursor-pointer items-center justify-center rounded-md border-2 text-sm font-medium transition hover:z-[1] hover:scale-105 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800';

    const parts = [base];

    if (!day.isCurrentMonth) {
        parts.push('border-slate-100 bg-slate-50 text-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-700');
    } else {
        parts.push('border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100');
    }

    if (isSelected) {
        parts.push(
            'border-indigo-600 bg-gradient-to-br from-indigo-500 to-purple-700 font-bold text-white shadow-md hover:bg-gradient-to-br hover:from-indigo-600 hover:to-purple-800'
        );

        if (hasTask) {
            parts.push(
                'after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-white after:content-[""]'
            );
        }
    } else {
        if (inRange) {
            parts.push(
                'border-indigo-500 bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-950 shadow-sm dark:from-indigo-500/20 dark:to-purple-500/20 dark:text-indigo-100'
            );
        } else if (isToday) {
            parts.push('border-indigo-500 bg-indigo-100 font-bold text-slate-900 dark:bg-indigo-500/20 dark:text-indigo-100');
        }

        if (hasTask) {
            parts.push(
                'after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-emerald-500 after:content-[""]'
            );
        }
    }

    return parts.filter(Boolean).join(' ');
}

export default function CalendarDayButton({
    day,
    isSelected,
    inRange,
    isToday,
    hasTask,
    onClick,
}) {
    return (
        <button
            type="button"
            className={calendarDayCellClass(day, {
                isSelected,
                inRange,
                isToday,
                hasTask,
            })}
            onClick={onClick}
        >
            {day.date.getDate()}
        </button>
    );
}