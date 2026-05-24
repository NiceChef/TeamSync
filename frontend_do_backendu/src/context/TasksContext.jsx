import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';

const TasksContext = createContext(null);
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const useTasksContext = () => useContext(TasksContext);

export const TasksProvider = ({ children }) => {
  const [contextValue, setContextValue] = useState(null);

  const [visibleColumns, setVisibleColumns] = useState({
    created: true,
    soonest_action: true,
    planned_date: true,
    deadline: true,
  });

  const [selectedCategoryFilters, setSelectedCategoryFilters] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [noCategories, setNoCategories] = useState(false);

  const saveSettingsTimeoutRef = useRef(null);

  useEffect(() => {
    if (saveSettingsTimeoutRef.current) {
      clearTimeout(saveSettingsTimeoutRef.current);
    }

    saveSettingsTimeoutRef.current = setTimeout(async () => {
      const token = localStorage.getItem('access_token');
      const user = localStorage.getItem('user');

      if (!token || !user) {
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/user/settings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            settings: { visibleColumns },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[TasksContext] Failed to save settings:', response.status, errorText);
        }
      } catch (err) {
        console.error('[TasksContext] Error saving settings:', err);
      }
    }, 2000);

    return () => {
      if (saveSettingsTimeoutRef.current) {
        clearTimeout(saveSettingsTimeoutRef.current);
      }
    };
  }, [visibleColumns]);

  const setContext = useCallback((value) => {
    setContextValue(value);
  }, []);

  const providerValue = useMemo(
    () => ({
      ...contextValue,
      setContext,
      visibleColumns,
      setVisibleColumns,
      selectedCategoryFilters,
      setSelectedCategoryFilters,
      statusFilter,
      setStatusFilter,
      noCategories,
      setNoCategories,
    }),
    [
      contextValue,
      setContext,
      visibleColumns,
      selectedCategoryFilters,
      statusFilter,
      noCategories,
    ]
  );

  return (
    <TasksContext.Provider value={providerValue}>
      {children}
    </TasksContext.Provider>
  );
};
