import { useEffect, useRef, useState } from 'react';
import { API_URL, fetchWithAuth } from '../api/authFetch';

// Pola faktycznie utrwalane na backendzie (noCategories celowo nie jest zapisywane).
const PERSISTED_KEYS = [
    'selectedCategoryFilters',
    'statusFilter',
    'sortBy',
    'sortOrder',
    'visibleColumns',
    'dateFrom',
    'dateTo',
];

// Ładowanie i debounce'owany zapis ustawień widoku zadań.
// `settings` to bieżący zestaw (w tym noCategories — na potrzeby wykrywania zmian),
// `applySettings(loaded)` wstrzykuje wczytane wartości do stanu wywołującego.
export function useUserSettings({ isAuthenticated, settings, applySettings }) {
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    const saveTimeoutRef = useRef(null);
    const applyRef = useRef(applySettings);
    applyRef.current = applySettings;

    useEffect(() => {
        if (!isAuthenticated) {
            setSettingsLoaded(true);
            return undefined;
        }
        let active = true;
        setSettingsLoaded(false);
        (async () => {
            try {
                const response = await fetchWithAuth(`${API_URL}/api/user/settings`);
                if (response.ok) {
                    const data = await response.json();
                    if (active && data.settings && Object.keys(data.settings).length > 0) {
                        applyRef.current(data.settings);
                    }
                } else {
                    console.warn('Failed to load user settings, using defaults');
                }
            } catch (err) {
                console.warn('Error loading user settings:', err);
            } finally {
                if (active) setSettingsLoaded(true);
            }
        })();
        return () => {
            active = false;
        };
    }, [isAuthenticated]);

    const settingsKey = JSON.stringify(settings);
    useEffect(() => {
        if (!isAuthenticated) return undefined;
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(async () => {
            try {
                const payload = {};
                for (const key of PERSISTED_KEYS) payload[key] = settings[key];
                const response = await fetchWithAuth(`${API_URL}/api/user/settings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ settings: payload }),
                });
                if (!response.ok) console.warn('Failed to save user settings');
            } catch (err) {
                console.warn('Error saving user settings:', err);
            }
        }, 1000);
        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settingsKey, isAuthenticated]);

    return settingsLoaded;
}
