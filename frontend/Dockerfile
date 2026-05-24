# Frontend dev (React + Vite). Node 22 spełnia wymóg Vite 7 (>=20.19 / >=22.12).
FROM node:22-alpine

WORKDIR /app

# Najpierw manifesty — lepsze cache warstw przy zmianie kodu.
COPY package.json package-lock.json* ./
RUN npm install

# Reszta kodu (w dev i tak nadpisana bind-mountem z compose).
COPY . .

EXPOSE 5173

# --host 0.0.0.0 udostępnia serwer poza kontener (mapowanie portu na hosta).
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
