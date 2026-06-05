# Obraz PostgreSQL dla środowiska developerskiego (szkolenie).
# Zmienne domyślne są zgodne z backend/.env_development

FROM postgres:16-alpine

ENV POSTGRES_USER=tasks_dev
ENV POSTGRES_PASSWORD=tasks_dev_secret
ENV POSTGRES_DB=tasks_dev

EXPOSE 5432
