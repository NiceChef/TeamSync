# TeamSync — Roadmapa realizacji projektu

> Dokument do akceptacji zespołu. Stan na: **2026-05-24**.
> Bazuje na analizie porównawczej: [`Specyfikacja funkcjonalnosci.md`](./Specyfikacja%20funkcjonalnosci.md) (karta funkcjonalności docelowego produktu), [`widoki-design-system.md`](./widoki-design-system.md) (opis dopracowanego UI), oraz faktycznego stanu kodu (`backend/`, `frontend_do_backendu/`, `frontend_koncowy/`).

---

## 1. Decyzje strategiczne (zatwierdzone)

1. **Docelowy frontend: `frontend_do_backendu`** (React/JS, realnie podpięty pod Flask) — zostaje końcowym frontendem. `frontend_koncowy` (TS/shadcn, mockowany) traktujemy wyłącznie jako **źródło widoków i wzorców UX do przeniesienia**, nie jako kod produkcyjny.
2. **Portujemy widoki z `frontend_koncowy` do `frontend_do_backendu`**, dopasowując je do **kolorystyki `frontend_do_backendu`** (paleta **slate**, Tailwind 3: `bg-slate-100/900/950`, karty `bg-white dark:bg-slate-900`, `border-slate-200`). Priorytetowo: **Dashboard** i **widok Kalendarza** (na pewno do przerobienia). NIE przenosimy tokenów OKLCH/shadcn ani Tailwind 4 — tylko układ, strukturę i komponenty.
3. **Przenosimy koncepcję Projektów i Zadań** z `frontend_koncowy` do `frontend_do_backendu` (karty projektów z postępem/członkami, kanban zadań z priorytetem/assignee). Wymaga to rozszerzenia backendu o realne encje `Project` i `CalendarEvent` (kalendarz przestaje być wyłącznie projekcją terminów zadań).
4. **Ten dokument to roadmapa** — nie zaczynamy implementacji przed akceptacją.

### Macierz portowania (`frontend_koncowy` → `frontend_do_backendu`)

| Widok źródłowy (koncowy) | Stan w do_backendu | Zakres portu | Zależność backend |
|---|---|---|---|
| `pages/dashboard.tsx` (StatCard + Recent Tasks + Upcoming Events, dane strukturalne) | `Dashboard.jsx` — parsuje raporty **tekstem przez regex** (kruche) | przerobić na strukturalne sekcje (StatCard, Recent Tasks z badge priorytetu, Upcoming Events) w palecie slate | endpointy zwracające JSON zamiast tekstu; `CalendarEvent` dla „Upcoming Events" |
| `pages/calendar.tsx` (685 linii: Month/Week/Day, DnD, EventPopover, optimistic update) | `calendar/CalendarView.jsx` (~189 linii, oparty o terminy zadań) | port bogatego kalendarza (3 tryby + DnD + popover) na encję `CalendarEvent`, kolory typów w palecie slate | encja `CalendarEvent` + CRUD |
| `pages/projects.tsx` (siatka kart: status, postęp, członkowie) | **brak** (jest tylko `Groups`) | nowy widok projektów + formularz | encja `Project` + CRUD |
| `pages/tasks.tsx` (kanban To Do/In Progress/Done, priorytet, assignee) | `tasks/*` (tabela/grid, filtry, kategorie) | dodać widok kanban zgodny z koncepcją koncowego, zachowując istniejące filtry | mapowanie `Task` ↔ priorytet/assignee/status (już w modelu) |

---

## 2. Punkt wyjścia — co już mamy

### Backend (Flask + PostgreSQL + JWT) — dojrzały
Pełny zestaw endpointów i modeli, **bogatszy niż opisuje `widoki-design-system.md`**:
- **Auth:** register, login, refresh, logout, change-password, forgot-password, reset-password, `/me`.
- **Zadania:** CRUD z optimistic locking (`version`), import, relacje (podzadania/zależności), kategorie, statusy w bazie (`TaskStatus`), priorytety.
- **Współpraca:** komentarze, log aktywności (`TaskActivity`), załączniki plików, powiadomienia.
- **Zespoły:** grupy (`Group`) z członkami, izolacja per-organizacja (RBAC employee/client).
- **Raporty:** tasks-summary, user-activity, project-progress (tekstowe).
- **Ustawienia użytkownika** (`/user/settings`).

### `frontend_do_backendu` — działa, surowy wizualnie
Pokrywa: auth, CRUD zadań + filtry, kategorie, kalendarz (na bazie zadań), grupy, profil, dashboard, advanced filters. Warstwa `authFetch.js` obsługuje JWT + refresh.

### `frontend_koncowy` — referencja UX (nie produkcja)
Dopracowany design system (shadcn base-nova, tokeny OKLCH, wzorzec trójstanu). **Uwaga — spec opisuje go optymistycznie:** w kodzie **brak** `task-form-dialog`, `project-form-dialog`, `empty-state`, `error-state`, mimo że `widoki-design-system.md` §3.4/§4 traktuje je jako gotowe. Dane w pełni mockowane.

---

## 3. Główne luki (spec funkcjonalności ↔ stan obecny)

| Moduł z karty funkcjonalności | Backend | `frontend_do_backendu` | Luka |
|---|---|---|---|
| Rejestracja / logowanie / sesje JWT | ✅ | ✅ | — |
| Zarządzanie danymi logowania / zmiana hasła | ✅ | 🟡 | UI zmiany hasła do dopracowania |
| Resetowanie hasła (e-mail) | 🟡 endpoint jest, brak wysyłki maila | 🔴 | przepływ resetu + integracja mailowa |
| Edycja profilu | ✅ | ✅ | kosmetyka |
| Grupy/zespoły + członkowie | ✅ | ✅ | wyszukiwanie grup, UX |
| **Encja Project / postęp projektu** | 🔴 **brak** | 🔴 | **nowa encja + widoki (decyzja §1.2)** |
| Zadania: tworzenie, statusy, priorytety, terminy | ✅ | ✅ | DnD kanban, polerka |
| Podzadania (relacje) | ✅ | 🟡 | pełny UI relacji |
| Przypisywanie zadań do osób/grup/klientów | ✅ | 🟡 | UI przypisań |
| Wyszukiwanie zadań/użytkowników/grup | ✅ filtry | 🟡 | wyszukiwarka globalna |
| **Kalendarz jako osobne wydarzenia** | 🔴 **brak encji Event** | 🟡 kalendarz=zadania | **nowa encja + widok (decyzja §1.2)** |
| Pliki / załączniki | ✅ | 🟡 | UI uploadu + powiązań |
| Komentarze + historia aktywności | ✅ | 🟡 | widok szczegółów zadania |
| Powiadomienia | ✅ | 🟡 | popover/centrum powiadomień |
| Dostęp klienta tylko do swoich danych (RBAC) | ✅ | 🟡 | weryfikacja widoczności w UI |
| Raporty (raw text → wizualizacje) | ✅ tekst | 🟡 | widoki raportów / wykresy |

Legenda: ✅ gotowe · 🟡 częściowe · 🔴 brak

---

## 4. Roadmapa fazowa

> Zasada: backend prowadzi, UI goni. Każda faza kończy się działającą, demonstrowalną funkcją na realnych danych.

### Faza 0 — Porządki i fundamenty wizualne
- Skorygować `widoki-design-system.md` §4/§7: oznaczyć nieistniejące komponenty jako „do zrobienia".
- Wyekstrahować z `frontend_koncowy` **wzorce układu** (StatCard, trójstan loading/error/empty, układ nagłówków `text-3xl font-bold`, karty `rounded-xl border`) i przełożyć je na **paletę slate** istniejących komponentów `frontend_do_backendu/src/components/ui/*.jsx`. Cel: jeden spójny zestaw klocków do portu widoków.

### Faza 1 — Rozszerzenie modelu domenowego (backend) — odblokowuje port
- **Encja `Project`** w `models.py`: nazwa, opis, status (active/archived/draft), postęp (liczony z zadań), członkowie, powiązanie z `Group`/organizacją. Endpointy CRUD `/api/projects`, `/projects/:id`. Relacja `Task.project_id`.
- **Encja `CalendarEvent`**: tytuł, opis, start/end (UTC), typ (meeting/deadline/reminder), uczestnicy, opcjonalne powiązanie z projektem/zadaniem. Endpointy CRUD `/api/events`. Migracja schematu (`schema_migrate.py`).
- **Endpointy dashboardu jako JSON** (zatwierdzone 2026-05-24) — zamiast parsowania raportów tekstowych regexem: stats (projektów, aktywnych zadań, nadchodzących wydarzeń, członków), recent-tasks, upcoming-events. Raporty tekstowe (`/api/reports/*`) zostają osobno dla widoku raportów.

### Faza 2 — Port Dashboardu i Kalendarza (priorytet z decyzji §1.2)
- **Dashboard:** przerobić `Dashboard.jsx` wg `frontend_koncowy/src/pages/dashboard.tsx` — 4 StatCardy + sekcje „Recent Tasks" (badge priorytetu) i „Upcoming Events", na danych JSON z Fazy 1. Zachować paletę slate i obecne skeletony.
- **Kalendarz:** przenieść bogaty widok z `frontend_koncowy/src/pages/calendar.tsx` (Month/Week/Day, DnD, EventPopover, optimistic update) do `calendar/`, oparty o encję `CalendarEvent`. Kolory typów (meeting/deadline/reminder) wyrazić w klasach slate + akcentach, nie tokenach OKLCH.

### Faza 3 — Port koncepcji Projektów i Zadań (decyzja §1.3)
- **Projekty:** nowy widok listy (karty: status, postęp, członkowie) + formularz tworzenia/edycji + szczegóły `/projects/:id` (zadania projektu, członkowie, postęp). Podpięte pod `/api/projects`.
- **Zadania:** widok **kanban** (To Do / In Progress / Done) zgodny z koncepcją `frontend_koncowy`, z DnD między kolumnami + optimistic update (`version`). Zachować istniejące filtry/kategorie z `frontend_do_backendu`. Priorytet i assignee w formularzu.
- Widok szczegółów zadania: komentarze + historia aktywności + załączniki + relacje (podzadania) — endpointy już istnieją.

### Faza 4 — Współpraca i widoczność
- Centrum **powiadomień** (popover + lista).
- **RBAC w UI:** weryfikacja, że klient widzi wyłącznie swoje dane/projekty/pliki (krytyczne wg karty funkcjonalności — izolacja organizacji).
- Pliki: pełny UI uploadu z walidacją rozmiaru/typu i powiązaniem z zadaniem/projektem.

### Faza 5 — Wyszukiwanie, raporty, dopracowanie
- Wyszukiwarka globalna (zadania/użytkownicy/grupy/projekty).
- Raporty: z surowego tekstu → widoki z wykresami (postęp projektów, aktywność użytkowników).
- Reset hasła e-mailem (integracja mailowa) + ekran „sprawdź e-mail".
- i18n (ujednolicenie języka), spójność design systemu, dostępność.

---

## 5. Ryzyka i otwarte kwestie

- **Wysyłka e-mail** (reset hasła, powiadomienia) — wymaga decyzji o providerze (SMTP/usługa). Do tego czasu reset zostaje „token w odpowiedzi" (tylko dev).
- **Project vs Group** — po dodaniu `Project` trzeba jasno rozgraniczyć rolę grupy (zespół/organizacja) od projektu (jednostka pracy z zadaniami), żeby nie zdublować znaczeń.
- **Migracje** — `db.create_all()` nie zmienia istniejących tabel; nowe encje wymagają świadomej migracji lub resetu dev (`scripts/dev_db_total_reset.py`).
- **Port wizualny ≠ kopiuj-wklej** — `frontend_koncowy` to Tailwind 4 + tokeny OKLCH + base-ui/shadcn; `frontend_do_backendu` to Tailwind 3 + paleta slate + autorskie `ui/*.jsx`. Klas i komponentów nie da się przenieść 1:1 — portujemy układ i logikę, przepisując style na slate. To realny nakład, nie kosmetyka.
- **Kolory typów kalendarza** — w `frontend_koncowy` zaszyte lokalnie (blue/red/amber); przy porcie ustalić ich odpowiedniki w palecie slate + akcenty.

---

## 6. Sugerowana kolejność akceptacji

1. ✅ Zakres encji **Project** i **CalendarEvent** — zatwierdzony (Załącznik A). JSON-owe endpointy dashboardu — ✅ zatwierdzone.
2. Potwierdzić, że port trzyma się palety slate `frontend_do_backendu` (bez wprowadzania shadcn/OKLCH).
3. Po akceptacji — rozbić Fazę 1 (backend) i Fazę 2 (Dashboard + Kalendarz) na konkretne zadania implementacyjne.

---

## Załącznik A — Schematy nowych encji (zatwierdzone 2026-05-24)

Konwencje z `backend/models.py`: Integer PK, `to_dict()`, M2M jak `group_members`, `organization_id` dla izolacji RBAC, `version` dla optimistic locking (jak `Task`). `create_all()` tworzy nowe tabele automatycznie; `schema_migrate.py` ruszamy tylko dla nowej kolumny `tasks.project_id`.

### Project (`projects`)
| Kolumna | Typ | Null | Uwagi |
|---|---|---|---|
| `id` | Integer PK | — | |
| `name` | String(200) | nie | |
| `description` | Text | tak | |
| `status` | String(20) | nie, default `'draft'` | active/archived/draft |
| `organization_id` | FK→organizations | tak | izolacja RBAC |
| `group_id` | FK→groups | tak | **opcjonalne** powiązanie z zespołem (decyzja) |
| `created_by_id` | FK→users | tak | |
| `created_at` / `updated_at` | DateTime | — | utcnow / onupdate |

- Członkowie: M2M `project_members` (`project_id`, `user_id`, `joined_at`) — **własna lista członków**, niezależna od grupy.
- `Project.tasks` ← `Task.project_id`.
- **`progress_percent` liczony w `to_dict()`** (`round(done/total*100)`, 0 gdy brak zadań) — NIE przechowywany (decyzja).

### CalendarEvent (`calendar_events`)
| Kolumna | Typ | Null | Uwagi |
|---|---|---|---|
| `id` | Integer PK | — | |
| `title` | String(200) | nie | |
| `description` | Text | tak | |
| `start` / `end` | DateTime | nie | UTC |
| `event_type` | String(20) | nie, default `'meeting'` | meeting/deadline/reminder (nazwa `event_type`, nie `type`) |
| `project_id` | FK→projects | tak | |
| `task_id` | FK→tasks | tak | opcjonalne dowiązanie do zadania |
| `organization_id` | FK→organizations | tak | izolacja RBAC |
| `created_by_id` | FK→users | tak | |
| `version` | Integer | nie, default 1 | **optimistic locking** (decyzja) — konflikt = 409 |
| `created_at` | DateTime | — | |

- Uczestnicy: M2M `calendar_event_attendees` (`event_id`, `user_id`).

### Zmiana w `Task` + migracja
- Nowa kolumna `Task.project_id` (FK→projects, nullable) + relacja `Project.tasks`.
- Dopisać do `schema_migrate.py` (sqlite + postgres): `('tasks', 'project_id', 'INTEGER')`.
- Nowe tabele (`projects`, `project_members`, `calendar_events`, `calendar_event_attendees`) — bez ręcznej migracji.
