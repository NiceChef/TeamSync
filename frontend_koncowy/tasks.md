# Cele na ten sprint

Zapewnienie spójnego doświadczenia użytkownika (UX) podczas ładowania i braku danych oraz implementacja pierwszych, bezpiecznych typologicznie formularzy dodawania zasobów.

---

## Task 1: Implementacja uniwersalnego komponentu Empty State

**Cel:** Stworzenie generycznego komponentu, który będzie wyświetlany, gdy lista zadań lub projektów jest pusta.

### Kryteria akceptacji (Acceptance Criteria)

- Utworzenie reużywalnego komponentu `<EmptyState />` w katalogu `src/components/ui/`.
- Komponent przyjmuje parametry (props): `title` (np. „Brak zadań”), `description` (np. „Nie masz obecnie żadnych przypisanych zadań.”), `icon` (ikona z biblioteki Lucide) oraz opcjonalnie `action` (np. przycisk „Dodaj zadanie”).
- Zastosowanie komponentu na stronach: Projekty (`/projects`) oraz Zadania (`/tasks`), gdy mock zwraca pustą tablicę.
- Komponent musi poprawnie wyglądać w trybie Dark Mode.

### Podpowiedź techniczna

Użyj ikon z `lucide-react` i odpowiedniego paddingu/wyśrodkowania (Tailwind: `flex flex-col items-center justify-center`).

---

## Task 2: Uzupełnienie Skeleton Loading na pozostałych widokach

**Cel:** Zapobieganie „skakaniu” interfejsu (Layout Shift) podczas ładowania danych na ekranach innych niż Dashboard.

### Kryteria akceptacji

- Dodanie komponentów ładujących (opartych o Skeleton z shadcn) na widoku Zadań (`/tasks`).
- Dodanie komponentów ładujących na widoku Projektów (`/projects`).
- Dodanie komponentu ładującego na widoku Kalendarza (`/calendar`).
- Skeletony powinny w miarę możliwości naśladować docelowy kształt danych (np. szare prostokąty w miejscu kart projektów).
- Przetestowanie widoków z użyciem istniejącego `fakeDelay` (ewentualne wydłużenie czasu opóźnienia do 2 sekund w `client.ts` na czas testów).

---

## Task 3: Obsługa Error State'ów dla zapytań (React Query)

**Cel:** Zbudowanie mechanizmu informującego użytkownika o błędzie pobierania danych z opcją ponownej próby.

### Kryteria akceptacji

- Utworzenie reużywalnego komponentu `<ErrorState />` (np. z czerwoną ikoną alertu).
- Komponent musi zawierać przycisk „Spróbuj ponownie” (Retry).
- Wykorzystanie flagi `isError` oraz funkcji `refetch` z hooków TanStack Query (np. w `useTasks` lub `useProjects`).
- Zaimplementowanie `<ErrorState />` we wszystkich głównych widokach pobierających dane (Dashboard, Projekty, Zadania).

### Podpowiedź techniczna

Przycisk „Spróbuj ponownie” powinien po prostu wywoływać metodę `refetch()`, którą zwraca hook `useQuery`. Aby przetestować ten stan, zmuś funkcję mockującą do rzucenia błędu `throw new Error()`.

---

## Task 4: Formularz „Dodaj Projekt” (Wprowadzenie do Zod + RHF)

**Cel:** Stworzenie pierwszego formularza wprowadzania danych, używającego walidacji.

### Kryteria akceptacji

- Utworzenie schematu walidacji w Zod dla projektu (np. `name` — min. 3 znaki, wymagalne; `description` — opcjonalne, max 200 znaków).
- Zbudowanie formularza używając komponentów `<Form />`, `<FormField />`, `<Input />` z shadcn/ui.
- Wyświetlanie komunikatów o błędach walidacji pod polami.
- Osadzenie formularza w modalu (Dialog / Sheet z shadcn) wywoływanym przyciskiem na stronie Projektów.
- Na submit: „zapisanie” danych (na razie po prostu `console.log` danych lub dodanie do lokalnej tablicy mocków) i zamknięcie modalu.

### Podpowiedź techniczna

Oprzyj się mocno na dokumentacji shadcn/ui w sekcji „Form”. Jest tam gotowy przykład integracji z react-hook-form i resolverem Zod.

---

## Task 5: Formularz „Dodaj Zadanie” (Zależności i Select)

**Cel:** Rozszerzenie wiedzy o formularzach o pola wyboru (dropdown).

### Kryteria akceptacji

- Utworzenie schematu walidacji Zod dla zadania (`title`, `description`, `status`, `projectId`).
- Status oraz Projekt powinny być wybierane z listy rozwijanej (komponent Select z shadcn).
- Projekty w polu Select powinny być pobierane dynamicznie (z użyciem istniejącego `useProjects`).
- Poprawna obsługa błędów i osadzenie formularza w modalu/szufladzie na ekranie Zadań.
