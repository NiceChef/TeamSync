import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** App-level role for future route / feature gating (e.g. client vs employee). */
export type AuthUserRole = "employee" | "client";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: AuthUserRole;
  avatar?: string;
};

const STORAGE_KEY = "teamsync_auth";

type StoredAuth = {
  user: AuthUser;
};

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (options?: { email?: string; name?: string; role?: AuthUserRole }) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed?.user?.id || !parsed.user.email) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed.user;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

const defaultDemoUser = (): AuthUser => ({
  id: "u1",
  name: "Anna Kowalska",
  email: "anna@teamsync.io",
  role: "employee",
  avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=anna",
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());

  const login = useCallback(
    (options?: { email?: string; name?: string; role?: AuthUserRole }) => {
      const base = defaultDemoUser();
      const next: AuthUser = {
        ...base,
        email: options?.email?.trim() || base.email,
        name: options?.name?.trim() || base.name,
        role: options?.role ?? base.role,
      };
      const payload: StoredAuth = { user: next };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setUser(next);
    },
    [],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      /** Przy async bootstrap (np. refresh tokenu) ustaw stan ładowania tutaj. */
      isLoading: false,
      login,
      logout,
    }),
    [user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook exported next to Provider
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
