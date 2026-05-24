# Plan zadań (Senior/Lead Developer)

Poniżej szczegółowy plan i lista zadań na najbliższe sprinty, podzielony na logiczne strumienie.

---

## Strumień 1: Architektura sieciowa i autoryzacja — *Priorytet 1*

W tej chwili aplikacja działa na mockach i w `localStorage`. Pierwszym zadaniem jest zbudowanie solidnego mechanizmu komunikacji i autoryzacji, gotowego na wpięcie prawdziwego API.

### Task 1.1: Architektura klienta HTTP i globalna obsługa błędów

**Cel:** Zastąpienie `fakeDelay` solidnym klientem HTTP (np. Axios lub rozbudowany wrapper na natywnym Fetch API).

**Zakres prac:**

- Stworzenie instancji klienta HTTP z bazowym URL pobieranym z `.env`.
- Implementacja interceptorów do automatycznego dodawania tokenów autoryzacyjnych do nagłówków.
- Globalny interceptor błędów (np. łapanie `401 Unauthorized` i automatyczne wylogowanie / przekierowanie na `/login` albo próba odświeżenia tokena — refresh token rotation).
- Podpięcie klienta pod hooki TanStack Query.

### Task 1.2: Bezpieczny przepływ autoryzacji (auth flow) i RBAC

**Cel:** Zbudowanie mechanizmu JWT z uwzględnieniem podziału na pracowników i klientów.

**Zakres prac:**

- Przygotowanie struktury pod logowanie zwracające tokeny (najlepiej z wykorzystaniem ciasteczek HttpOnly pod kątem XSS).
- Rozbudowa `AuthContext` (lub przeniesienie do menedżera stanu, np. Zustand, jeśli zajdzie potrzeba) tak, aby trzymał role użytkownika.
- Mechanizm route guards (HOC lub komponenty w React Router) blokujące dostęp do widoków na podstawie ról (np. klient bez dostępu do zakładki „Wszyscy pracownicy”).

---

## ~~Strumień 2: Domena kalendarza i złożony stan — *Priorytet 2*~~

Kalendarz to centralny element aplikacji i najbardziej ryzykowny obszar pod kątem konfliktów edycji i stref czasowych.

### ~~Task 2.1: Interaktywny kalendarz (front-end core)~~

**Cel:** Wydajny widok siatki kalendarza obsługujący dużą ilość danych.

**Zakres prac:**

- Wybór lub budowa silnika kalendarza (np. `react-big-calendar`, FullCalendar albo własny na `date-fns` / `dayjs`).
- Implementacja drag & drop do zmiany terminów zadań.
- Optimistic UI w TanStack Query — natychmiastowa aktualizacja UI przy przesunięciu zadania, żądanie w tle, rollback przy błędzie.

### ~~Task 2.2: Standaryzacja stref czasowych (timezones)~~

**Cel:** Zabezpieczenie przed błędami wynikającymi z różnych stref czasowych użytkowników.

**Zakres prac:**

- Parsowanie wszystkich dat (z API i do API) do ISO 8601 / UTC.
- Konwersja UTC na lokalny czas przeglądarki w warstwie prezentacji.

---

## Strumień 3: Środowisko i CI/CD — *w tle*

Zanim dołączy backend (lub zanim zaczniesz kodować FastAPI), warto upewnić się, że kod da się łatwo wdrażać.

### Task 3.1: Konteneryzacja frontendu (Docker)

**Cel:** Wdrożenie założeń z dokumentacji dotyczących spójnego środowiska deweloperskiego.

**Zakres prac:**

- `Dockerfile` dla frontendu (najlepiej multi-stage: build Node + Vite, serwowanie np. przez Nginx).
- `docker-compose.yml` z myślą o późniejszym wpięciu FastAPI i PostgreSQL.

### Task 3.2: Pipeline CI/CD i jakość kodu

**Cel:** Automatyzacja weryfikacji kodu (Ty i juniorzy).

**Zakres prac:**

- Konfiguracja GitHub Actions.
- Pipeline: ESLint, `tsc --noEmit`, `vite build` przy każdym Pull Requeście.
- Branch protection na `main`: wymóg review i „zielonego” pipeline’u przed merge.
