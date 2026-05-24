import React, { useState, useEffect } from 'react';
import {
  filterTasksBySelection,
  getDaysInMonth,
  getWeekDays,
  hasTaskOnDate,
  isDateInSelectedRange,
  isSelectedDate,
  normalizeDay,
} from './calendarUtils';
import { API_URL, fetchWithAuth } from '../../api/authFetch';
import CalendarTaskList from './CalendarTaskList';
import CalendarPanel from './CalendarPanel';

function CalendarView({ isAuthenticated }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedRange, setSelectedRange] = useState({ start: null, end: null });
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [calendarView, setCalendarView] = useState('month');

  // Pobierz wszystkie taski
  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetchWithAuth(`${API_URL}/api/tasks?include_relations=true`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch tasks');
      }

      const data = await response.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchTasks();
    }
  }, [isAuthenticated]);

  // Filtruj taski na podstawie wybranego dnia/zakresu
  useEffect(() => {
    setFilteredTasks(filterTasksBySelection(tasks, selectedDate, selectedRange));
  }, [tasks, selectedDate, selectedRange]);

  const handleDateClick = (date) => {
    const clicked = normalizeDay(date);

    if (!selectedRange.start || selectedRange.end) {
      setSelectedRange({ start: clicked, end: null });
      setSelectedDate(clicked);
      return;
    }

    const start = normalizeDay(selectedRange.start);

    if (clicked < start) {
      setSelectedRange({ start: clicked, end: start });
    } else {
      setSelectedRange({ start, end: clicked });
    }

    setSelectedDate(null);
  };

  const clearSelection = () => {
    setSelectedDate(null);
    setSelectedRange({ start: null, end: null });
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(normalizeDay(today));
    setSelectedRange({ start: null, end: null });
  };

  const isDateInRange = (date) => isDateInSelectedRange(date, selectedRange);

  const isDateSelected = (date) => isSelectedDate(date, selectedDate, selectedRange);

  const dateHasTask = (date) => hasTaskOnDate(tasks, date);

  const goToPreviousWeek = () => {
    const n = new Date(currentDate);
    n.setDate(n.getDate() - 7);
    setCurrentDate(n);
  };

  const goToNextWeek = () => {
    const n = new Date(currentDate);
    n.setDate(n.getDate() + 7);
    setCurrentDate(n);
  };
  const days = calendarView === 'month'
    ? getDaysInMonth(currentDate)
    : getWeekDays(currentDate);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <p>Ładowanie kalendarza…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/95 sm:p-6">
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <h2 className="bg-gradient-to-r from-indigo-600 to-purple-700 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
            Kalendarz
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCalendarView('month')}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${calendarView === 'month'
                ? 'bg-indigo-600 text-white'
                : 'border border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                }`}
            >
              Miesiąc
            </button>
            <button
              type="button"
              onClick={() => setCalendarView('week')}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${calendarView === 'week'
                ? 'bg-indigo-600 text-white'
                : 'border border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                }`}
            >
              Tydzień
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(280px,400px)_1fr] lg:items-start">
        <CalendarPanel
          currentDate={currentDate}
          calendarView={calendarView}
          days={days}
          selectedDate={selectedDate}
          selectedRange={selectedRange}
          onPreviousMonth={goToPreviousMonth}
          onNextMonth={goToNextMonth}
          onPreviousWeek={goToPreviousWeek}
          onNextWeek={goToNextWeek}
          onToday={goToToday}
          onClearSelection={clearSelection}
          isDateSelected={isDateSelected}
          isDateInRange={isDateInRange}
          hasTaskOnDate={dateHasTask}
          onDateClick={handleDateClick}
        />

        <CalendarTaskList
          selectedDate={selectedDate}
          selectedRange={selectedRange}
          filteredTasks={filteredTasks}
          error={error}
        />
      </div>
    </div>
  );
}

export default CalendarView;
