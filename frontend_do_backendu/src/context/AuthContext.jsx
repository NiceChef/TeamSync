import { useState, useEffect } from 'react';
import { API_URL, fetchWithAuth } from '../api/authFetch';
import { AuthContext } from './auth-context';

export function AuthProvider({ isAuthenticated, children }) {
    const [me, setMe] = useState(null);

    useEffect(() => {
        if (!isAuthenticated) return undefined;
        let active = true;
        (async () => {
            try {
                const res = await fetchWithAuth(`${API_URL}/api/auth/me`);
                if (res.ok && active) setMe(await res.json());
            } catch {
                /* brak profilu nie blokuje UI */
            }
        })();
        // Reset robimy w cleanupie (przy wylogowaniu / odmontowaniu), nie synchronicznie
        // w ciele efektu — to zapobiega kaskadowym re-renderom.
        return () => {
            active = false;
            setMe(null);
        };
    }, [isAuthenticated]);

    return <AuthContext.Provider value={me}>{children}</AuthContext.Provider>;
}
