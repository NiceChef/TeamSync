import { useState, useCallback, useMemo } from 'react';
import { TasksContext } from './tasks-context';

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

  // Uwaga: trwały zapis ustawień (łącznie z visibleColumns) robi TasksGrid jednym
  // pełnym POST-em. Drugi, częściowy writer tutaj nadpisywał blob i gubił filtry/sort.

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
