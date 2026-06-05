# TeamSync — Widoki, Design System i Plan Rozwoju

> Dokument przeglądowy front-endu TeamSync: katalog wszystkich widoków, opis systemu projektowego (design system) oraz plan rozwoju kolejnych widoków i funkcji.
> Stan na: **2026-05-24**. Warstwa danych nadal **mockowana** (`src/api/*` + `fakeDelay`); kontrakty typów (`src/types.ts`) gotowe pod podmianę na realne API.

Powiązane dokumenty: [`documentation.md`](./documentation.md) (architektura), [`tasks.md`](./tasks.md) (bieżący sprint), [`hardTasks.md`](./hardTasks.md) (strumienie senior/lead).

---

## 1. Mapa widoków

Routing zdefiniowany w [`src/router.tsx`](src/router.tsx) (`createBrowserRouter`). Drzewo dzieli się na trasy **publiczne** (bez sesji) i **chronione** (w `MainLayout`).

| Ścieżka | Widok | Plik | Dostęp | Layout |
|---------|-------|------|--------|--------|
| `/login` | Logowanie | [`login.tsx`](src/pages/login.tsx) | Publiczna (`PublicRoute`) | brak (full-screen card) |
| `/register` | Rejestracja (Pracownik / Klient) | [`register.tsx`](src/pages/register.tsx) | Publiczna | brak |
| `/forgot-password` | Reset hasła (placeholder) | [`forgot-password.tsx`](src/pages/forgot-password.tsx) | Publiczna | brak |
| `/` (index) | Dashboard | [`dashboard.tsx`](src/pages/dashboard.tsx) | Chroniona (`ProtectedRoute`) | `MainLayout` |
| `/calendar` | Kalendarz | [`calendar.tsx`](src/pages/calendar.tsx) | Chroniona | `MainLayout` |
| `/projects` | Projekty | [`projects.tsx`](src/pages/projects.tsx) | Chroniona | `MainLayout` |
| `/tasks` | Zadania | [`tasks.tsx`](src/pages/tasks.tsx) | Chroniona | `MainLayout` |
| `*` (w layoutcie) | 404 Not Found | [`not-found.tsx`](src/pages/not-found.tsx) | Chroniona | `MainLayout` |

**Strażnicy tras** ([`ProtectedRoute`](src/components/auth/ProtectedRoute.tsx), [`PublicRoute`](src/components/auth/PublicRoute.tsx)): czytają `isAuthenticated`/`isLoading` z `AuthContext`. Brak sesji na trasie chronionej → redirect `/login`; aktywna sesja na trasie publicznej → redirect `/`. Podczas `isLoading` renderowany [`RouteFallback`](src/components/auth/route-fallback.tsx).

---

## 2. Szczegółowy opis widoków

### 2.1 Logowanie — `/login`
- **Cel:** wejście do aplikacji. Formularz e-mail + hasło.
- **Walidacja:** `loginSchema` ([`auth-schemas.ts`](src/lib/validations/auth-schemas.ts)) — e-mail poprawny, hasło min. 8 znaków.
- **Submit:** symulowane opóźnienie 900 ms, następnie `login({ email })` z `AuthContext` (ustawia demo-usera w `localStorage`).
- **Stan:** `react-hook-form` + `zodResolver`; przycisk disabled + label „Logowanie…” podczas `isSubmitting`.
- **Nawigacja:** linki do `/register` i `/forgot-password`.
- **Layout:** wyśrodkowana `Card` (`max-w-md`), logo TeamSync nad kartą. Język UI: **polski**.

### 2.2 Rejestracja — `/register`
- **Cel:** utworzenie konta w dwóch wariantach przez `Tabs`: **Pracownik** i **Klient**.
- **Walidacja:** `registerEmployeeSchema` (imię, nazwisko, e-mail, hasło) oraz `registerClientSchema` (dodatkowo `companyName`).
- **Submit:** obecnie `console.log` danych (brak realnej rejestracji) + opóźnienie 900 ms.
- **Komponenty:** `Tabs`, `Form`, `Input`, `Card`.

### 2.3 Reset hasła — `/forgot-password`
- **Stan:** **placeholder** — komunikat „Ta funkcja będzie dostępna wkrótce” + link powrotu do `/login`. Brak logiki.

### 2.4 Dashboard — `/`
- **Cel:** przegląd kondycji zespołu.
- **Sekcje:**
  1. Nagłówek („Dashboard” + powitanie).
  2. **4 karty statystyk** (`StatCard`): Projects, Active Tasks, Upcoming Events, Team Members — z hooka [`useDashboardStats`](src/hooks/use-dashboard-stats.ts).
  3. **Recent Tasks** ([`useRecentTasks`](src/hooks/use-recent-tasks.ts)) — lista z `Badge` priorytetu (urgent→destructive, high→default, reszta→secondary).
  4. **Upcoming Events** ([`useUpcomingEvents`](src/hooks/use-upcoming-events.ts)) — lista (max 5) z `Badge` typu.
- **Stany UX:** każda sekcja niezależnie obsługuje `isLoading` (lokalne skeletony), `isError` (`ErrorState` z retry przez `refetch`), dane.

### 2.5 Kalendarz — `/calendar`
- **Najbardziej złożony widok.** Trzy tryby (`useState<CalendarView>`): **Month / Week / Day**.
- **Dane:** [`useEvents`](src/hooks/use-events.ts); mutacja przesunięcia: [`useUpdateEvent`](src/hooks/use-update-event.ts).
- **Drag & Drop:** natywne HTML5 DnD (`draggable`, `onDragStart`/`onDrop`). Upuszczenie eventu liczy nowy `start`/`end` zachowując czas trwania; w trybie miesiąca zachowuje godzinę, w week/day ustawia godzinę docelowej komórki. Aktualizacja przez `updateMutation.mutate` z **optimistic update** (`onMutate`/`onError` rollback/`onSettled` invalidate w [`use-update-event.ts`](src/hooks/use-update-event.ts)).
- **Strefy czasowe:** wszystkie daty parsowane przez `parseUTC` / serializowane `toUTCString` ([`lib/date.ts`](src/lib/date.ts)) — UTC w modelu, lokalny czas w prezentacji.
- **Komponenty wewnętrzne:** `MonthView`, `WeekView`, `DayView`, `EventPopover` (szczegóły eventu: czas, data, uczestnicy, typ).
- **Kolory typów:** meeting (niebieski), deadline (czerwony), reminder (bursztynowy) — mapy `EVENT_COLORS`/`EVENT_BG`. Legenda na dole.
- **Toolbar:** prev / Today / next + etykieta okresu + przełącznik trybów.
- **Stany UX:** `CalendarSkeleton` (siatka 7×6), `ErrorState` z retry.

### 2.6 Projekty — `/projects`
- **Cel:** lista projektów jako karty (grid 1/2/3 kolumny responsywnie).
- **Karta projektu:** nazwa, `Badge` statusu (active/archived/draft), opis (`line-clamp-2`), pasek postępu (`progressPercent`), nakładające się awatary członków (`Avatar` + `Tooltip`), data utworzenia.
- **Akcja:** przycisk „New project” otwiera [`ProjectFormDialog`](src/components/projects/project-form-dialog.tsx).
- **Stany UX:** `ProjectsSkeleton` (6 kart), `ErrorState`, `EmptyState` (gdy 0 projektów — z CTA „New project”).

### 2.7 Zadania — `/tasks`
- **Cel:** tablica zadań typu **kanban** w 3 kolumnach: To Do / In Progress / Done (filtrowanie po `status`).
- **Karta zadania:** tytuł, `Badge` priorytetu, termin (`dueDate`), awatar + nazwa przypisanego.
- **Akcja:** „New task” otwiera [`TaskFormDialog`](src/components/tasks/task-form-dialog.tsx).
- **Stany UX:** `TasksSkeleton` (3 kolumny × 3 karty), `ErrorState`, `EmptyState`.
- **Uwaga:** kolumny to obecnie tylko grupowanie wizualne — **brak drag & drop między kolumnami** (kandydat na rozwój — §6).

### 2.8 404 — Not Found
- Prosty ekran w obrębie `MainLayout`: „404”, opis, przycisk powrotu do Dashboardu.

---

## 3. Design System

### 3.1 Fundamenty
| Element | Wartość |
|---------|---------|
| Framework UI | **shadcn/ui** (preset *base-nova*) na bazie `@base-ui/react` + `@radix-ui/react-slot` |
| Stylowanie | **Tailwind CSS 4** (`@tailwindcss/vite`), tokeny w [`src/index.css`](src/index.css) |
| Ikony | **lucide-react** |
| Czcionka | **Geist Variable** (`--font-sans`, `--font-heading`) |
| Warianty komponentów | **class-variance-authority** (cva) |
| Łączenie klas | `cn()` = `clsx` + `tailwind-merge` ([`lib/utils.ts`](src/lib/utils.ts)) |
| Tryb ciemny | klasa `.dark` na elemencie nadrzędnym; przełącznik [`theme-toggle`](src/components/theme/theme-toggle.tsx) + [`use-theme`](src/hooks/use-theme.ts) |

### 3.2 Tokeny kolorów (OKLCH)
Definiowane jako zmienne CSS w `:root` (jasny) i `.dark` (ciemny), eksponowane do Tailwind przez `@theme inline`. Semantyczne pary:

`background`/`foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `chart-1..5`, oraz dedykowany zestaw **sidebar** (`sidebar`, `sidebar-foreground`, `sidebar-accent`, `sidebar-primary`, `sidebar-border`, `sidebar-ring`).

> Paleta jest **achromatyczna** (szarości w OKLCH) poza `destructive` (czerwień). Akcenty kolorystyczne kalendarza (blue/red/amber) są zdefiniowane lokalnie w widoku, nie w tokenach — kandydat na ujednolicenie (§6).

### 3.3 Promienie (radius)
Bazowy `--radius: 0.625rem`; pochodne skalowane: `sm` (×0.6) … `4xl` (×2.6). Stosowane np. `rounded-xl` na kartach, `rounded-4xl` na `Badge`.

### 3.4 Biblioteka komponentów UI (`src/components/ui/`)
| Komponent | Rola / warianty |
|-----------|-----------------|
| [`button`](src/components/ui/button.tsx) | warianty: `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`; rozmiary: `xs/sm/default/lg` + `icon-*` |
| [`badge`](src/components/ui/badge.tsx) | warianty jak button (default/secondary/destructive/outline/ghost/link) |
| [`card`](src/components/ui/card.tsx) | `Card`, `CardHeader/Title/Description/Content/Footer` |
| [`dialog`](src/components/ui/dialog.tsx) | modale (formularze projektu/zadania) |
| [`form`](src/components/ui/form.tsx) | integracja RHF: `Form/FormField/FormItem/FormLabel/FormControl/FormDescription/FormMessage` |
| [`input`](src/components/ui/input.tsx), [`textarea`](src/components/ui/textarea.tsx), [`label`](src/components/ui/label.tsx) | pola formularzy |
| [`select`](src/components/ui/select.tsx) | lista rozwijana (status, projekt) |
| [`tabs`](src/components/ui/tabs.tsx) | przełącznik Pracownik/Klient w rejestracji |
| [`avatar`](src/components/ui/avatar.tsx) | `Avatar/AvatarImage/AvatarFallback` (inicjały) |
| [`dropdown-menu`](src/components/ui/dropdown-menu.tsx) | menu użytkownika w navbarze |
| [`tooltip`](src/components/ui/tooltip.tsx) | nazwy członków na awatarach |
| [`separator`](src/components/ui/separator.tsx) | linie podziału |
| [`skeleton`](src/components/ui/skeleton.tsx) | szkielety ładowania |
| [`empty-state`](src/components/ui/empty-state.tsx) | pusty stan: `icon`, `title`, `description`, `action` |
| [`error-state`](src/components/ui/error-state.tsx) | błąd: ikona alertu + przycisk „Try again” (`onRetry`, `isRetrying`) |

### 3.5 Wzorce widokowe (konwencje)
- **Nagłówek strony:** `<h1 class="text-3xl font-bold tracking-tight">` + podtytuł `text-muted-foreground`; po prawej opcjonalny przycisk akcji.
- **Trójstan danych:** każdy widok pobierający dane obsługuje kolejno `isLoading` → `isError` (`ErrorState`+retry) → `empty` (`EmptyState`) → dane. To spójny, powtarzalny wzorzec (efekt sprintu z [`tasks.md`](./tasks.md)).
- **Karty:** `rounded-xl border bg-card p-6`, hover `shadow-md/sm`.
- **Formularze:** RHF + Zod + komponenty `Form*`, reset przy otwarciu dialogu, przyciski disabled podczas `isPending`, optymistyczne zamknięcie modalu po `mutateAsync`.
- **Layout aplikacji** ([`MainLayout`](src/components/layout/main-layout.tsx)): `Sidebar` (desktop, `md:`) + `Navbar` (sticky, z nawigacją mobilną, `ThemeToggle`, menu usera). Treść w `max-w-7xl`. Nawigacja z jednego źródła: [`nav-config.ts`](src/components/layout/nav-config.ts).

### 3.6 Warstwa danych (kontekst dla widoków)
Strony → hooki TanStack Query (`src/hooks/*`) → `src/api/*` (mock + `fakeDelay`) lub `src/services/api.ts` (agregaty dashboardu) → mocki (`src/mocks/*`). Auth: [`AuthContext`](src/contexts/AuthContext.tsx) (localStorage `teamsync_auth`, role `employee`/`client`). Typy domenowe: [`types.ts`](src/types.ts).

---

## 4. Status widoków (kompletność)

| Widok | Status | Brakujące elementy |
|-------|--------|--------------------|
| Login | ✅ działa (mock) | realny submit do API |
| Register | 🟡 UI gotowe | brak realnej rejestracji (tylko `console.log`) |
| Forgot password | 🔴 placeholder | cały przepływ resetu |
| Dashboard | ✅ kompletny | brak akcji/drill-down z kart |
| Calendar | ✅ bogaty | brak tworzenia/edycji eventów (optimistic update przy DnD już jest) |
| Projects | ✅ kompletny | brak edycji/szczegółów projektu, filtrów |
| Tasks | ✅ kompletny | brak DnD między kolumnami, edycji, filtrów |
| 404 | ✅ | — |

---

## 5. Plan rozwoju istniejących widoków

### Dashboard
- Klikalne karty statystyk → drill-down do `/projects`, `/tasks`, `/calendar`.
- Wykresy (tokeny `chart-1..5` już istnieją) — np. postęp projektów, rozkład zadań.
- Sekcja „Moje zadania na dziś”.

### Kalendarz
- **Tworzenie/edycja/usuwanie eventów** (klik w pustą komórkę → dialog `EventForm`).
- **Optimistic UI** ✅ już zaimplementowane dla `useUpdateEvent` (rollback przy błędzie) — rozszerzyć na przyszłe mutacje CRUD eventów.
- Filtrowanie po typie / projekcie; widok „Agenda” (lista).
- Wydajność przy dużej liczbie eventów (wirtualizacja week/day).

### Projekty
- **Widok szczegółów projektu** `/projects/:id` (zadania projektu, członkowie, postęp, timeline).
- Edycja i archiwizacja; filtrowanie po statusie; wyszukiwarka.
- Zarządzanie członkami (dodawanie/usuwanie).

### Zadania
- **Drag & drop między kolumnami** kanban + optimistic update statusu.
- Edycja / usuwanie / szczegóły zadania (panel boczny lub dialog).
- Filtry (priorytet, assignee, projekt), sortowanie, wyszukiwarka.
- Pole `assignee` i `priority` w `TaskFormDialog` (obecnie tylko title/desc/status/projectId).

### Auth
- Dokończenie `/forgot-password` (request resetu + ekran „sprawdź e-mail”).
- Realny submit rejestracji; ekran weryfikacji e-mail.

---

## 6. Propozycje nowych widoków

| Widok | Ścieżka (propozycja) | Opis | Zależności |
|-------|----------------------|------|------------|
| Szczegóły projektu | `/projects/:id` | Pełny widok pojedynczego projektu | route param, hook `useProject(id)` |
| Szczegóły / panel zadania | `/tasks/:id` lub drawer | Edycja, komentarze, historia | mutacje update |
| Zespół / Pracownicy | `/team` | Lista użytkowników, role, dostępność (RBAC — w `hardTasks.md` widoczność wg roli) | RBAC z `AuthContext` |
| Ustawienia konta | `/settings` | Profil, hasło, motyw, powiadomienia | formularze RHF |
| Powiadomienia | `/notifications` lub popover | Lista zdarzeń (przypisania, deadline'y) | model `Notification` (do dodania) |
| Wyszukiwarka globalna | command palette (⌘K) | Szybki skok do projektu/zadania | indeks po stronie klienta |
| Profil klienta (RBAC) | `/client/*` | Ograniczony widok dla roli `client` | route guards wg roli |

---

## 7. Dług techniczny / spójność design systemu
- **Kolory kalendarza** (blue/red/amber) zaszyte lokalnie — przenieść do tokenów semantycznych (`--event-meeting` itd.) dla spójności i dark mode.
- **Niespójność modeli usera:** domenowy `User` (`firstName/lastName`, role `admin/member/viewer`) vs sesyjny `AuthUser` (`name`, role `employee/client`). Warto ujednolicić przed wpięciem API.
- **Język UI mieszany:** auth/dialogi po polsku, widoki aplikacji (Dashboard/Tasks/Projects/Calendar) po angielsku — rozważyć i18n (np. `react-i18next`).
- **Brak optimistic update** w mutacjach (kalendarz, przyszłe kanban) — kluczowe dla UX po wpięciu realnej latencji.
- Strażnicy tras nie obsługują jeszcze **autoryzacji wg roli** (RBAC) — tylko uwierzytelnienia.

---

## 8. Powiązanie ze strumieniami w `hardTasks.md`
- **Strumień 1 (sieć/auth):** podmiana `fakeDelay` na klient HTTP, JWT, interceptory 401, RBAC w route guards — bezpośrednio wpływa na widoki auth i strażników tras.
- **Strumień 2 (kalendarz):** ✅ częściowo zrealizowany (interaktywny kalendarz, strefy czasowe). Pozostaje optimistic UI i CRUD eventów.
- **Strumień 3 (CI/CD, Docker):** infrastruktura — nie dotyczy bezpośrednio widoków, ale warunkuje wdrożenia.

---

## 9. Pakiet migracyjny (self-contained)

> Cel tej sekcji: umożliwić **odtworzenie i przeróbkę widoków w innym repozytorium bez dostępu do oryginału**. Zawiera kompletne kontrakty danych, warstwę API/hooków, helpery, konfigurację i niuanse biblioteki UI.

### 9.0 Kolejność odtwarzania (checklist)
1. Zainstaluj zależności w zgodnych wersjach (§9.1).
2. Skonfiguruj Vite + alias `@`, `tsconfig`, `components.json`, `index.css` z tokenami (§9.2, §3.2).
3. Wygeneruj komponenty `ui/` z presetu shadcn **base-nova** lub skopiuj je 1:1 (§9.7 — uwaga o niestandardowym API).
4. Wklej `types.ts` (§9.3) i schematy Zod (§9.4).
5. Odtwórz warstwę API + mocki + hooki (§9.5).
6. Wklej helpery `lib/*` (§9.6).
7. Złóż providery i routing (§9.8), następnie widoki z §2.

### 9.1 Zależności (kluczowe wersje — `package.json`)
**Runtime:** react `^19.2.4`, react-dom `^19.2.4`, react-router-dom `^7.14.1`, @tanstack/react-query `^5.99.1`, react-hook-form `^7.72.1`, @hookform/resolvers `^5.2.2`, zod `^4.3.6`, date-fns `^4.1.0`, lucide-react `^1.8.0`.
**UI / styl:** tailwindcss `^4.2.2`, @tailwindcss/vite `^4.2.2`, shadcn `^4.3.0` (preset `base-nova`), @base-ui/react `^1.4.0`, @radix-ui/react-slot `^1.2.4`, class-variance-authority `^0.7.1`, clsx `^2.1.1`, tailwind-merge `^3.5.0`, tw-animate-css `^1.4.0`, @fontsource-variable/geist `^5.2.8`.
**Dev:** typescript `~6.0.2`, vite `^6.4.2`, @vitejs/plugin-react, eslint 9 + typescript-eslint + plugin react-hooks/react-refresh.

> ⚠️ **Krytyczne:** komponenty UI bazują na **`@base-ui/react`**, nie na klasycznym Radix shadcn. API różni się (patrz §9.7). Jeśli docelowe repo używa standardowego shadcn/Radix, część komponentów (`Select`, `Button`, `Badge`) wymaga adaptacji.

### 9.2 Konfiguracja
**`vite.config.ts`:**
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```
**`tsconfig.app.json` (istotne flagi):** `strict`, `verbatimModuleSyntax: true`, `noUncheckedIndexedAccess: true`, `moduleResolution: "bundler"`, `jsx: "react-jsx"`, `paths: { "@/*": ["./src/*"] }`, `target/lib: ES2023`.
**`components.json`:** `style: "base-nova"`, `baseColor: "neutral"`, `cssVariables: true`, `iconLibrary: "lucide"`, aliasy `@/components`, `@/components/ui`, `@/lib`, `@/lib/utils`, `@/hooks`.
**`index.css`:** importuje `tailwindcss`, `tw-animate-css`, `shadcn/tailwind.css`, `@fontsource-variable/geist`; definiuje `@theme inline` + tokeny `:root`/`.dark` (pełna lista tokenów w §3.2 — skopiować plik 1:1).

### 9.3 Kontrakty domenowe — `src/types.ts` (pełne)
```ts
export type UserRole = "admin" | "member" | "viewer";
export interface User {
  id: string; firstName: string; lastName: string;
  email: string; role: UserRole; avatar?: string;
}
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "todo" | "in_progress" | "done";
export interface Task {
  id: string; title: string; description: string; assignee: User;
  priority: TaskPriority; status: TaskStatus;
  dueDate: string; /* ISO 8601 */ projectId?: string;
}
export type ProjectStatus = "active" | "archived" | "draft";
export interface Project {
  id: string; name: string; description: string; status: ProjectStatus;
  progressPercent: number; createdAt: string; members: User[];
}
export interface DashboardStats {
  projectCount: number; activeTaskCount: number;
  upcomingEventCount: number; teamMemberCount: number;
}
export type CalendarEventType = "meeting" | "deadline" | "reminder";
export interface CalendarEvent {
  id: string; title: string; description?: string;
  start: string; end: string; /* ISO 8601 UTC */
  type: CalendarEventType; projectId?: string; attendees: User[];
}
```
**Przykład danych (`CalendarEvent`/`Task`):** daty jako ISO UTC z `Z`, np. `dueDate: "2026-04-25T23:59:00.000Z"`; avatar przez DiceBear: `https://api.dicebear.com/9.x/avataaars/svg?seed=<seed>`.

### 9.4 Schematy walidacji (Zod) — `src/lib/validations/*`
```ts
// auth-schemas.ts
const emailField = z.string().trim().min(1, "Podaj adres e-mail").email("Podaj poprawny adres e-mail");
const passwordField = z.string().min(8, "Hasło musi mieć co najmniej 8 znaków");
export const loginSchema = z.object({ email: emailField, password: passwordField });
export const registerEmployeeSchema = z.object({ firstName, lastName, email: emailField, password: passwordField });
export const registerClientSchema = registerEmployee + z.object({ companyName: min(1) });

// project-schemas.ts
export const projectSchema = z.object({
  name: z.string().trim().min(3, "Nazwa musi mieć co najmniej 3 znaki"),
  description: z.string().trim().max(200, "…max 200 znaków").optional(),
});

// task-schemas.ts
export const taskSchema = z.object({
  title: z.string().trim().min(3, "…min 3 znaki"),
  description: z.string().trim().max(500).optional(),
  status: z.enum(["todo", "in_progress", "done"], { message: "Wybierz status" }),
  projectId: z.string().min(1, "Wybierz projekt"),
});
```
> Typy formularzy wyprowadzane przez `z.infer<typeof schema>`.

### 9.5 Warstwa danych — API, mocki, hooki
**Klient (symulacja sieci) — `api/client.ts`:** `fakeDelay<T>(data): Promise<T>` z `setTimeout` 300 ms. **To jedyny punkt podmiany na realny HTTP** (axios/ky/fetch).

**Funkcje API (`api/*.ts`) — sygnatury do zachowania przy migracji na backend:**
- `getProjects(): Promise<Project[]>`, `getProjectById(id): Promise<Project|undefined>`, `createProject({name, description?}): Promise<Project>` (nowy → `status: "draft"`, `progressPercent: 0`, `members: []`).
- `getTasks(): Promise<Task[]>`, `getTasksByProject(projectId): Promise<Task[]>`, `createTask({title, description?, status, projectId}): Promise<Task>` (nowy → `assignee: currentUser`, `priority: "medium"`).
- `getEvents(): Promise<CalendarEvent[]>`, `updateEvent(payload): Promise<CalendarEvent>` gdzie `UpdateEventPayload = {id} & Partial<{start,end,title,description,type}>`.
- `services/api.ts`: `getDashboardStats()`, `getRecentTasks()`, `getUpcomingEvents()`.

**Hooki TanStack Query (query keys istotne dla invalidacji):**
| Hook | Typ | queryKey | Uwagi |
|------|-----|----------|-------|
| `useProjects` | query | `["projects"]` | |
| `useTasks` | query | `["tasks"]` | |
| `useTasksByProject(id)` | query | `["tasks", id]` | `enabled: !!id` |
| `useEvents` | query | `["events"]` | |
| `useDashboardStats` | query | `["dashboard","stats"]` | |
| `useRecentTasks` | query | `["dashboard","recent-tasks"]` | |
| `useUpcomingEvents` | query | `["dashboard","upcoming-events"]` | |
| `useCreateProject` | mutation | — | invaliduje `["projects"]` + `["dashboard","stats"]` |
| `useCreateTask` | mutation | — | invaliduje `["tasks"]` + `["dashboard"]` |
| `useUpdateEvent` | mutation | — | **optimistic**: `onMutate` (cancel+setQueryData), `onError` rollback z `context.previous`, `onSettled` invalidate `["events"]` |

**QueryClient (`providers/query-provider.tsx`):** `staleTime: 5 min`, `retry: 1`, `refetchOnWindowFocus: false`.

### 9.6 Helpery — `lib/*`
- **`utils.ts`:** `cn(...inputs) = twMerge(clsx(inputs))`.
- **`user.ts`:** `userFullName(u) = "${firstName} ${lastName}"`, `userInitials(u)` = inicjały wielką literą.
- **`date.ts`** (oparte o `date-fns`, model **UTC**): re-eksport `startOf*/endOf*`, `isSame*`, `add*/sub*`, `getHours/getMinutes/setHours/setMinutes`, `differenceInMinutes`. Funkcje własne: `parseUTC(iso)→Date` (parseISO), `toUTCString(date)→ISO` (toISOString), `formatDayShort` (`EEE, MMM d`), `formatMonthYear` (`MMMM yyyy`), `formatWeekRange`, `formatDayFull` (`EEEE, MMMM d, yyyy`), `formatTime` (`HH:mm`), `formatTimeRange`, `formatDateTimeShort(iso)` (`MMM d, HH:mm`), `getMonthGrid(date)→Date[]` (42 komórki, `weekStartsOn:1`), `getHourSlots()→0..23`, `formatHourLabel(h)`. **Tydzień zaczyna się w poniedziałek.**

### 9.7 ⚠️ Niuanse komponentów UI (base-ui — odbiega od klasycznego shadcn)
Te różnice najczęściej psują migrację na zwykły shadcn/Radix:
- **`Button`** (`@base-ui/react/button`): zamiast `asChild` używa propsa **`render`** (np. `<Button render={<Link to="/" />}>`). Warianty: `default/outline/secondary/ghost/destructive/link`; rozmiary `xs/sm/default/lg/icon/icon-xs/icon-sm/icon-lg`. Wariant `destructive` jest „miękki” (`bg-destructive/10`).
- **`Badge`** (`useRender`/`mergeProps`): też przez **`render`**, nie `asChild`. Warianty jak Button.
- **`Select`** (`@base-ui/react/select`): `Select` przyjmuje **`items`** (obiekt `{value: label}`) + `value`/`onValueChange` na **Root** (nie na trzymaniu wartości w triggerze). Pusty wybór: `value={field.value || null}`. Struktura: `Select > SelectTrigger > SelectValue` + `SelectContent > SelectItem`. **To inne API niż shadcn/Radix Select.**
- **`Tooltip`:** wymaga `TooltipProvider` (montowany globalnie w `main.tsx` z `delay={300}`).
- Pozostałe (`card`, `input`, `textarea`, `label`, `dialog`, `tabs`, `avatar`, `dropdown-menu`, `separator`, `skeleton`) — zbliżone do standardu; `empty-state` i `error-state` są **autorskie** (sygnatury w §3.4).

### 9.8 Złożenie aplikacji (drzewo providerów)
```
main.tsx:  StrictMode > QueryProvider > TooltipProvider(delay=300) > App
App.tsx:   AuthProvider > RouterProvider(router)
router:    "/" > [ PublicRoute > {login,register,forgot-password},
                   ProtectedRoute > MainLayout > {index:Dashboard, calendar, projects, tasks, *:404} ]
```
- **Auth:** `AuthContext` trzyma `AuthUser {id,name,email,role:"employee"|"client",avatar?}` w `localStorage["teamsync_auth"]`; `login()` ustawia demo-usera, `logout()` czyści. `useTheme` trzyma motyw w `localStorage["teamsync-theme"]` i przełącza klasę `.dark` na `<html>`.

### 9.9 Czego ten dokument NIE zastępuje (skopiować 1:1 z repo)
- Pełne źródła komponentów `ui/` (17 plików) — najlepiej wygenerować z presetu base-nova lub skopiować.
- Pełny `index.css` (wszystkie tokeny OKLCH light/dark).
- Pełne dane mockowe (`mockData.ts`, `mocks/*`) jeśli potrzebne do testów wizualnych.
- `eslint.config.js`, `tsconfig.*`, `public/` (favicon/icons).

> Z powyższymi artefaktami + tym dokumentem migracja i przeróbka widoków jest wykonalna bez dostępu do oryginalnego repo. Bez nich dokument pozostaje **specyfikacją**, a nie kompletnym źródłem.
