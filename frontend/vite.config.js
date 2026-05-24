import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// 
// UWAGA: Vite automatycznie ładuje pliki .env z katalogu frontend/
// Dla development (npm run dev): frontend/.env.development lub frontend/.env.development.local
// Dla production (vite build): frontend/.env.production lub frontend/.env.production.local
//
// Vite automatycznie rozpoznaje tryb na podstawie komendy:
// - "vite" lub "vite dev" -> mode: "development" -> ładuje .env.development
// - "vite build" -> mode: "production" -> ładuje .env.production
//
// Wszystkie zmienne środowiskowe muszą mieć prefix VITE_ aby były dostępne w kodzie
// np. VITE_API_URL, VITE_ENV
export default defineConfig({
  plugins: [react()],
})
