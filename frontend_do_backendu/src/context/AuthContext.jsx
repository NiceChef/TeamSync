import { createContext, useContext, useState, useEffect } from 'react';
import { API_URL, fetchWithAuth } from '../api/authFetch';

const AuthContext = createContext(null);

// Zwraca zalogowanego użytkownika (lub null). Pobierany raz, współdzielony przez widoki.
export const useMe = () => useContext(AuthContext);

export function AuthProvider({ isAuthenticated, children }) {
    const [me, setMe] = useState(null);

    useEffect(() => {
        if (!isAuthenticated) {
            setMe(null);
            return undefined;
        }
        let active = true;
        (async () => {
            try {
                const res = await fetchWithAuth(`${API_URL}/api/auth/me`);
                if (res.ok && active) setMe(await res.json());
            } catch {
                /* brak profilu nie blokuje UI */
            }
        })();
        return () => {
            active = false;
        };
    }, [isAuthenticated]);

    return <AuthContext.Provider value={me}>{children}</AuthContext.Provider>;
}
