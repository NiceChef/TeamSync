export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getAuthToken() {
    return localStorage.getItem('access_token');
}

async function refreshToken() {
    const refreshTokenValue = localStorage.getItem('refresh_token');

    if (!refreshTokenValue) {
        throw new Error('No refresh token available');
    }

    const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${refreshTokenValue}`,
        },
    });

    if (!response.ok) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');

        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to refresh token');
    }

    const data = await response.json();
    localStorage.setItem('access_token', data.access_token);

    if (data.refresh_token) {
        localStorage.setItem('refresh_token', data.refresh_token);
    }

    return data.access_token;
}

export async function fetchWithAuth(url, options = {}) {
    let token = getAuthToken();

    if (!token) {
        throw new Error('No authentication token available');
    }

    let response = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            Authorization: `Bearer ${token}`,
        },
    });

    if (response.status === 401) {
        token = await refreshToken();

        response = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                Authorization: `Bearer ${token}`,
            },
        });
    }

    return response;
}