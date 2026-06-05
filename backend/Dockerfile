# ============================================
# Dockerfile dla Backend Flask
# ============================================

# Użyj oficjalnego obrazu Pythona 3.12
FROM python:3.12-slim

# Ustaw zmienne środowiskowe
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Utwórz katalog roboczy
WORKDIR /app

# Dodaj /app do PYTHONPATH aby Python mógł importować moduły
ENV PYTHONPATH=/app

# Zainstaluj zależności systemowe (potrzebne dla psycopg2-binary i curl dla healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Skopiuj plik requirements.txt i zainstaluj zależności Python
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Skopiuj kod aplikacji
COPY . .

# Utwórz użytkownika nie-root dla bezpieczeństwa
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Port na którym aplikacja będzie nasłuchiwać
EXPOSE 5000

# Healthcheck (używa curl zamiast requests, żeby nie wymagać dodatkowej biblioteki)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Uruchom aplikację
# Uwaga: Zmienne środowiskowe powinny być załadowane z .env_prod
# używając: docker run --env-file .env_prod ...
CMD ["python", "app.py"]
