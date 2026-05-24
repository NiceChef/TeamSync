import { createContext, useContext } from 'react';

export const TaskDrawerContext = createContext(null);

export const useTaskDrawer = () => useContext(TaskDrawerContext) || {};
