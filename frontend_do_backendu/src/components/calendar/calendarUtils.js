export function normalizeDay(value) {
    const day = new Date(value);
    day.setHours(0, 0, 0, 0);
    return day;
}

export function formatDate(dateString) {
    if (!dateString) return '-';

    const date = new Date(dateString);

    return date.toLocaleDateString('pl-PL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
}

export function getMonday(value) {
    const date = new Date(value);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;

    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);

    return date;
}

export function getDaysInMonth(value) {
    const year = value.getFullYear();
    const month = value.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    const days = [];
    const firstDayOfWeek = firstDay.getDay();
    const prevMonthDays = new Date(year, month, 0).getDate();

    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        days.push({
            date: new Date(year, month - 1, prevMonthDays - i),
            isCurrentMonth: false,
        });
    }

    for (let i = 1; i <= daysInMonth; i++) {
        days.push({
            date: new Date(year, month, i),
            isCurrentMonth: true,
        });
    }

    const remainingDays = 42 - days.length;

    for (let i = 1; i <= remainingDays; i++) {
        days.push({
            date: new Date(year, month + 1, i),
            isCurrentMonth: false,
        });
    }

    return days;
}

export function getWeekDays(value) {
    const monday = getMonday(value);

    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + index);

        return {
            date,
            isCurrentMonth: true,
        };
    });
}

export function taskDateValues(task) {
    return [
        task.created_at,
        task.soonest_action,
        task.planned_date,
        task.deadline,
    ]
        .filter(Boolean)
        .map((value) => normalizeDay(value));
}

export function taskMatchesDay(task, selectedDate) {
    if (!selectedDate) return false;

    const selected = normalizeDay(selectedDate);

    return taskDateValues(task).some((date) => date.getTime() === selected.getTime());
}

export function taskMatchesRange(task, selectedRange) {
    if (!selectedRange.start || !selectedRange.end) return false;

    const start = normalizeDay(selectedRange.start);
    const end = normalizeDay(selectedRange.end);

    return taskDateValues(task).some((date) => date >= start && date <= end);
}

export function filterTasksBySelection(tasks, selectedDate, selectedRange) {
    if (!Array.isArray(tasks) || tasks.length === 0) {
        return [];
    }

    if (selectedRange.start && selectedRange.end) {
        return tasks.filter((task) => taskMatchesRange(task, selectedRange));
    }

    if (selectedDate) {
        return tasks.filter((task) => taskMatchesDay(task, selectedDate));
    }

    return [];
}

export function isDateInSelectedRange(date, selectedRange) {
    if (!selectedRange.start || !selectedRange.end) return false;

    const start = normalizeDay(selectedRange.start);
    const end = normalizeDay(selectedRange.end);
    const check = normalizeDay(date);

    return check >= start && check <= end;
}

export function isSelectedDate(date, selectedDate, selectedRange) {
    const check = normalizeDay(date);

    if (selectedDate) {
        const selected = normalizeDay(selectedDate);
        return selected.getTime() === check.getTime();
    }

    if (selectedRange.start && selectedRange.end) {
        const start = normalizeDay(selectedRange.start);
        const end = normalizeDay(selectedRange.end);

        return check.getTime() === start.getTime() || check.getTime() === end.getTime();
    }

    return false;
}

export function hasTaskOnDate(tasks, date) {
    const check = normalizeDay(date);

    return tasks.some((task) =>
        taskDateValues(task).some((taskDate) => taskDate.getTime() === check.getTime())
    );
}