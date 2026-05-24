# TeamSync — dokumentacja struktury projektu

## Cel aplikacji

**TeamSync** to jednostronicowa aplikacja (SPA) do zarządzania pracą zespołu: dashboard, kalendarz, projekty i zadania. Obecnie warstwa danych jest **symulowana** (mocki + sztuczne opóźnienie sieci); kontrakty typów i funkcji są przygotowane pod późniejszą podmianę na prawdziwy backend.

---

## Stack technologiczny

| Obszar | Wybór |
|--------|--------|
| Runtime / framework | React 19 |
| Język | TypeScript (strict, `verbatimModuleSyntax`) |
| Bundler / dev server | Vite 6 |
| Stylowanie | Tailwind CSS 4 (`@tailwindcss/vite`) |
| Komponenty UI | shadcn/ui (preset **base-nova**), ikony Lucide |
| Routing | React Router 7 (`createBrowserRouter`) |
| Stan serwera / cache | TanStack Query (React Query) |
| Formularze | react-hook-form + Zod (`@hookform/resolvers`) |
| Czcionka | Geist Variable (`@fontsource-variable/geist`) |

Dodatkowo: **clsx**, **tailwind-merge**, **class-variance-authority** (wzorce komponentów), część komponentów oparta o **@base-ui/react** i **@radix-ui/react-slot** (zgodnie z konfiguracją shadcn).

---

## Konfiguracja projektu (katalog główny)

| Plik / katalog | Rola |
|----------------|------|
| `index.html` | Punkt wejścia HTML; montuje `#root` i ładuje `/src/main.tsx` |
| `vite.config.ts` | Pluginy React + Tailwind; alias `@` → `./src` |
| `tsconfig.json` | Referencje do `tsconfig.app.json` i `tsconfig.node.json` |
| `tsconfig.app.json` | Ustawienia kompilacji aplikacji (`@/*` → `./src/*`) |
| `tsconfig.node.json` | Konfiguracja dla narzędzi Node (np. Vite config) |
| `components.json` | Konfiguracja shadcn (aliasy `@/components`, `@/lib/utils`, styl, `src/index.css`) |
| `eslint.config.js` | ESLint flat config: TypeScript ESLint, React Hooks, React Refresh; ignoruje `dist` |
| `package.json` | Skrypty: `dev`, `build`, `lint`, `preview` |
| `public/` | Zasoby statyczne serwowane bez zmian (np. `favicon.svg`, `icons.svg`) |
| `dist/` | Wynik `vite build` (generowany; nie edytować ręcznie) |

---

## Struktura katalogu `src/`

Poniżej logiczny podział odpowiedzialności (nie wszystkie pliki wymieniono — pełna lista w repozytorium).

```
src/
├── main.tsx              # createRoot, StrictMode, QueryProvider, TooltipProvider, App
├── App.tsx               # AuthProvider + RouterProvider
├── router.tsx            # Definicja tras (PublicRoute / ProtectedRoute / MainLayout)
├── index.css             # Globalne style, Tailwind, zmienne motywu
├── types.ts              # Wspólne typy domenowe (User, Task, Project, CalendarEvent, …)
├── mockData.ts           # Zbiorcze dane mockowe dla dashboardu (importowane przez services)
│
├── api/                  # „Klient” danych: obecnie mock + fakeDelay z api/client.ts
│   ├── client.ts         # Sztuczne opóźnienie (symulacja sieci)
│   ├── projects.ts
│   ├── tasks.ts
│   └── events.ts
│
├── services/             # Warstwa wyżej niż surowe endpointy (np. dashboard)
│   └── api.ts            # getDashboardStats, getRecentTasks, getUpcomingEvents
│
├── mocks/                # Rozbite dane testowe (users, projects, tasks, events)
│
├── hooks/                # useProjects, useTasks, useEvents, use-theme, hooki dashboardu
├── providers/
│   └── query-provider.tsx # QueryClientProvider (staleTime, retry, refetchOnWindowFocus)
│
├── contexts/
│   └── AuthContext.tsx   # Użytkownik sesji, localStorage (`teamsync_auth`), login/logout
│
├── components/
│   ├── auth/             # ProtectedRoute, PublicRoute, route-fallback (przekierowania)
│   ├── layout/           # MainLayout, Sidebar, Navbar, nav-config (nawigacja aplikacji)
│   ├── theme/            # Przełącznik motywu
│   └── ui/               # Komponenty shadcn (button, card, form, input, …)
│
├── lib/                  # utils (cn), validations (auth-schemas), user (pomocnicze)
│
└── pages/                # Widoki routowane: dashboard, calendar, projects, tasks, auth, not-found
```

**Alias importów:** `@/` wskazuje na `src/` (Vite + `tsconfig.app.json`).

---

## Routing i ochrona tras

- **`router.tsx`** definiuje drzewo tras z `Outlet`.
- **`PublicRoute`**: strony `login`, `register`, `forgot-password` (dostęp bez pełnej sesji — zgodnie z logiką komponentu).
- **`ProtectedRoute`**: chronione trasy; wewnątrz **`MainLayout`** (sidebar + navbar).
- Trasy aplikacji (z layoutem): `/` (Dashboard), `/calendar`, `/projects`, `/tasks`; ścieżki niepasujące w obrębie layoutu → `NotFoundPage`.

Konfiguracja pozycji menu: `components/layout/nav-config.ts` (`appNavigation`).

---

## Dane i integracja z backendem

1. **`src/api/client.ts`** — `fakeDelay()` opóźnia rozwiązanie Promise (symulacja latencji). Komentarz w kodzie wskazuje na przyszłą podmianę na prawdziwy klient HTTP.
2. **`src/api/*.ts`** — funkcje typu `getProjects()`, `getTasks()` zwracają mocki z `mocks/` po opóźnieniu.
3. **`src/services/api.ts`** — agregacja danych dashboardu z `mockData.ts`.
4. **`src/types.ts`** — kontrakty domenowe; zalecane utrzymywanie przy migracji na API.

**React Query** (`QueryProvider`): domyślnie m.in. `staleTime` 5 minut, `retry: 1`, bez refetch przy fokusie okna.

---

## Autentykacja

- **`AuthContext`**: stan użytkownika (`AuthUser`: m.in. `id`, `email`, `role`: `employee` | `client`), persystencja w **localStorage** pod kluczem `teamsync_auth`.
- Logowanie w obecnym kształcie ustawia dane (w tym domyślny profil demo); szczegóły w `AuthContext.tsx`.

*Uwaga:* W `types.ts` występuje osobny model **`User` / `UserRole`** dla encji domenowych (zadania, projekty); **`AuthUser`** w kontekście to osobny byt sesji UI.

---

## Skrypty npm

| Skrypt | Działanie |
|--------|-----------|
| `npm run dev` | Serwer deweloperski Vite |
| `npm run build` | `tsc -b` + `vite build` |
| `npm run preview` | Podgląd buildu produkcyjnego |
| `npm run lint` | ESLint dla projektu |

---

## Podsumowanie architektury

Aplikacja jest zorganizowana warstwowo: **strony** → **hooki (TanStack Query)** → **api / services** → **mocki lub przyszły HTTP**. Layout i nawigacja są oddzielone od widoków; **auth** opiera się na kontekście React i trasach chronionych. UI bazuje na **Tailwind 4** i **shadcn** z jednym plikiem tokenów/stylów w `index.css`.
