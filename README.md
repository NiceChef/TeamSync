# Tasks Manager — wersja szkoleniowa

Uproszczony monolit: Flask (REST + JWT) + React (Vite). Baza: **PostgreSQL** w kontenerze Docker. Schemat tworzy `SQLAlchemy` (`db.create_all()` przy starcie, jeśli brakuje tabel).

## Szybki start — cały stack w Dockerze (Mac + Windows, zalecane)

Wymaga tylko Dockera. Z katalogu głównego:

```bash
docker compose up -d --build
```

Uruchamia trzy serwisy: `postgres` + `backend` (Flask) + `frontend` (Vite/`frontend_do_backendu`).

| Usługa   | Domyślny URL          |
|----------|-----------------------|
| Frontend | http://localhost:5173 |
| Backend  | http://localhost:5000 |
| Postgres | localhost:5432        |

Logowanie konta testowego: **TestUser / TestUserPassword!**.

**Zajęte porty?** (np. lokalny Postgres na 5432 albo macOS AirPlay na 5000) — utwórz plik `.env` obok `docker-compose.yml` (jest gitignored, więc nie wpływa na innych):

```env
POSTGRES_HOST_PORT=5433
BACKEND_HOST_PORT=5050
FRONTEND_HOST_PORT=5173
```

Frontend automatycznie wskaże backend na `http://localhost:${BACKEND_HOST_PORT}`.

Zatrzymanie: `docker compose down` (dane bazy zostają w wolumenie; `down -v` je usuwa).

---

Poniżej alternatywny tryb **natywny** (bez kontenerów dla backendu/frontendu).

## Wymagania

- Docker (do uruchomienia PostgreSQL)
- Python 3.11+ (rekomendowane)
- Node.js 20+ (frontend)

## 1. Kontener PostgreSQL (te same dane co w `.env_development`)

Z katalogu głównego repozytorium:

```bash
docker compose up -d
```

Obraz budowany jest z `Dockerfile` (bazuje na `postgres:16-alpine`). Domyślne zmienne:

| Zmienna            | Wartość            |
|--------------------|--------------------|
| `POSTGRES_USER`    | `tasks_dev`        |
| `POSTGRES_PASSWORD`| `tasks_dev_secret` |
| `POSTGRES_DB`      | `tasks_dev`        |

Port **5432** jest mapowany na hosta. Dane w wolumenie `tasks_pg_dev_data`.

Sprawdzenie:

```bash
docker compose ps
```

Zatrzymanie:

```bash
docker compose down
```

## 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Konfiguracja: skopiuj lub edytuj `backend/.env_development` (URI musi pasować do Dockera):

`postgresql+psycopg2://tasks_dev:tasks_dev_secret@localhost:5432/tasks_dev`

Uruchomienie:

```bash
python app.py
```

API domyślnie: `http://localhost:5000`. Przy **pierwszym** połączeniu z pustą bazą tworzone są tabele; w trybie `development` dodawany jest użytkownik testowy **TestUser** (hasło w pliku `seed.py` / poniżej).

### Całkowity reset bazy (DROP schematu + tabele + seed)

Tylko `development`:

```bash
cd backend
python scripts/dev_db_total_reset.py
```

## 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Zmienna opcjonalna: `VITE_API_URL` (domyślnie `http://localhost:5000`).

## Konto testowe

- **Username:** `TestUser`  
- **Hasło:** takie samo jak w `backend/seed.py` (domyślnie `TestUserPassword!`)

## Struktura

- `Dockerfile` — obraz Postgres z domyślnymi zmiennymi zgodnymi z `.env_development`
- `docker-compose.yml` — usługa `postgres`
- `backend/.env_development` — URI i sekrety dev
- `backend/scripts/dev_db_total_reset.py` — jedyny skrypt serwisowy bazy w tym projekcie

**Uwaga:** Jeśli baza powstała jeszcze z kolumnami `is_admin` / `admin_id`, `create_all()` ich nie usunie — zrób reset (`dev_db_total_reset`) albo ręczny `ALTER TABLE` / nowa baza.
