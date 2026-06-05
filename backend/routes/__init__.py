from flask import Blueprint

# Jeden wspólny blueprint dla całego API — identyczny prefiks i nazwy endpointów
# jak w poprzednim monolicie, więc routing i url_for nie zmieniają się.
api = Blueprint('api', __name__, url_prefix='/api')

# Import modułów rejestruje endpointy na `api` (musi być po definicji `api`).
from . import (  # noqa: E402,F401
    tasks,
    relations,
    categories,
    groups,
    collaboration,
    reports,
    projects,
    events,
    dashboard,
    authorization,
    user_settings,
)

__all__ = ['api']
