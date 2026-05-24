import { createContext, useContext } from 'react';

export const AuthContext = createContext(null);

// Zwraca zalogowanego użytkownika (lub null). Pobierany raz, współdzielony przez widoki.
export const useMe = () => useContext(AuthContext);
