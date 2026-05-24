# TeamSync — frontend

SPA do zarządzania pracą zespołu: dashboard, kalendarz, projekty i zadania. Warstwa danych jest obecnie **symulowana** (mocki); typy i warstwa `api/` są przygotowane pod podłączenie prawdziwego backendu.

**Stack:** React 19, TypeScript, Vite 6, Tailwind CSS 4, React Router 7, TanStack Query, react-hook-form + Zod, komponenty w stylu shadcn (preset base-nova).

Szczegółowy opis struktury katalogów i architektury: [`documentation.md`](./documentation.md).

---

## Wymagania

- [Node.js](https://nodejs.org/) (LTS zalecany)
- npm (dostarczany z Node)

---

## Uruchomienie (lokalnie)

```bash
npm install
npm run dev
```

Aplikacja działa pod adresem podanym w terminalu (domyślnie **http://localhost:5173**).

---

## Inne skrypty

| Polecenie | Opis |
|-----------|------|
| `npm run build` | Kompilacja TypeScript + build produkcyjny (katalog `dist/`) |
| `npm run preview` | Podgląd zbudowanej wersji |
| `npm run lint` | ESLint |
