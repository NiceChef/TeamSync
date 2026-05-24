# TeamSync — wersja szkoleniowa

Aplikacja do zarządzania zadaniami i pracą zespołu: **Flask (REST + JWT)** + **React (Vite)**, baza **PostgreSQL** w Dockerze. Schemat tworzy SQLAlchemy (`db.create_all()` przy starcie, jeśli brakuje tabel) + lekki migrator dodający brakujące kolumny (`schema_migrate.py`).

## Funkcjonalności

- **Zadania** — CRUD, priorytety, statusy (todo / w trakcie / zakończone), terminy i daty planowane, relacje (podzadania), kategorie, komentarze, historia aktywności, załączniki, import zbiorczy.
- **Projekty** — z członkami, postępem i widokiem kanban.
- **Grupy / zespoły** — przypisywanie zadań do grup.
- **Kalendarz** — wydarzenia (spotkania / deadline'y / przypomnienia) z uczestnikami.
- **Powiadomienia**, **dashboard** ze statystykami, **raporty** (podsumowanie zadań, aktywność użytkowników, postęp grup).
- **Wyszukiwarka** i filtrowanie zadań.
- **Konta i bezpieczeństwo** — rejestracja, logowanie JWT (access + refresh), wylogowanie z trwałą blacklistą tokenów, zmiana i reset hasła (e-mail / token).

### Role i izolacja danych

- Rola ustalana jest przy rejestracji na podstawie domeny e-mail (zmienna `CLIENT_EMAIL_DOMAINS`): pasujące domeny → `client` (dostęp ograniczony), pozostałe → `employee` (pełny dostęp). Nie ma roli `admin`.
- Każde nowo zarejestrowane konto dostaje **własną organizację** — dane (grupy, projekty, wydarzenia, użytkownicy) są widoczne tylko w obrębie tej samej organizacji.
- **Logowanie** akceptuje **nazwę użytkownika lub e-mail** (e-mail bez rozróżniania wielkości liter).

## Szybki start — cały stack w Dockerze (Mac + Windows, zalecane)

Wymaga tylko Dockera. Z katalogu głównego:

```bash
docker compose up -d --build
```

Uruchamia trzy serwisy: `postgres` + `backend` (Flask) + `frontend` (Vite).

| Usługa   | Domyślny URL          |
|----------|-----------------------|
| Frontend | http://localhost:5173 |
| Backend  | http://localhost:5000 |
| Postgres | localhost:5432        |

**Zajęte porty?** (np. lokalny Postgres na 5432 albo macOS AirPlay na 5000) — utwórz plik `.env` obok `docker-compose.yml` (jest gitignored, więc nie wpływa na innych):

```env
POSTGRES_HOST_PORT=5433
BACKEND_HOST_PORT=5050
FRONTEND_HOST_PORT=5173
```

Frontend automatycznie wskaże backend na `http://localhost:${BACKEND_HOST_PORT}`.

Zatrzymanie: `docker compose down` (dane bazy zostają w wolumenie; `down -v` je usuwa).

## Konta testowe (tryb development)

Tworzone automatycznie przy starcie z pustą bazą:

| Konto       | Login                       | Hasło                  | Rola       |
|-------------|-----------------------------|------------------------|------------|
| Pracownik   | `TestUser` / `testuser@example.com` | `TestUserPassword!`    | `employee` |
| Klient      | `TestClient` / `client@client.local` | `TestClientPassword!`  | `client`   |

(Logować można się nazwą lub e-mailem.)

---

## Tryb natywny (bez kontenerów dla backendu/frontendu)

PostgreSQL nadal uruchamiany w Dockerze; backend i frontend lokalnie.

### Wymagania

- Docker (PostgreSQL)
- Python 3.12 (zgodnie z obrazem `python:3.12-slim`; 3.11+ powinno działać)
- Node.js 20+

### 1. Kontener PostgreSQL

Z katalogu głównego:

```bash
docker compose up -d postgres
```

Domyślne dane (zgodne z `backend/.env_development`):

| Zmienna             | Wartość            |
|---------------------|--------------------|
| `POSTGRES_USER`     | `tasks_dev`        |
| `POSTGRES_PASSWORD` | `tasks_dev_secret` |
| `POSTGRES_DB`       | `tasks_dev`        |

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Konfiguracja w `backend/.env_development` — URI musi pasować do portu Postgresa, np.:

`postgresql+psycopg2://tasks_dev:tasks_dev_secret@localhost:5432/tasks_dev`

API domyślnie: `http://localhost:5000`. Przy pierwszym połączeniu z pustą bazą tworzone są tabele i (w `development`) konta testowe.

#### Całkowity reset bazy (DROP schematu + tabele + seed) — tylko development

```bash
cd backend
python scripts/dev_db_total_reset.py
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Skrypty: `npm run dev` (Vite), `npm run build`, `npm run preview`, `npm run lint`.
Zmienna opcjonalna: `VITE_API_URL` (domyślnie `http://localhost:5000`).

## Struktura projektu

```
.
├── docker-compose.yml        # postgres + backend + frontend
├── Dockerfile                # obraz Postgres (dane jak w .env_development)
├── backend/
│   ├── app.py                # fabryka aplikacji Flask, JWT, init bazy
│   ├── config.py             # konfiguracja (pydantic-settings)
│   ├── models.py             # modele SQLAlchemy
│   ├── auth.py               # rejestracja, logowanie, tokeny, profil, reset hasła
│   ├── task_access.py        # reguły widoczności / edycji zadań
│   ├── schema_migrate.py     # dodawanie brakujących kolumn (SQLite + Postgres)
│   ├── seed.py               # statusy zadań + konta testowe
│   ├── routes/               # API pocięte na moduły per domena
│   │   ├── __init__.py        #   wspólny blueprint `api` (prefiks /api)
│   │   ├── helpers.py         #   funkcje współdzielone
│   │   ├── tasks.py, relations.py, categories.py, groups.py,
│   │   ├── collaboration.py   #   komentarze, aktywności, załączniki, powiadomienia
│   │   ├── reports.py, projects.py, events.py, dashboard.py, user_settings.py
│   └── scripts/
│       └── dev_db_total_reset.py   # reset bazy (development)
└── frontend/                 # React + Vite
```

**Uwaga:** Jeśli baza powstała jeszcze ze starymi kolumnami (`is_admin` / `admin_id`), `create_all()` ich nie usunie — zrób reset (`dev_db_total_reset`) albo ręczny `ALTER TABLE`.
