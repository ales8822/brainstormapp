# backend/routers/settings.py

from fastapi import APIRouter
from ..database import queries
from typing import Dict

router = APIRouter()

@router.get("/api/settings")
def get_settings():
    """Fetches the current application settings."""
    return queries.get_settings_db()

@router.post("/api/settings")
def update_settings(settings: Dict[str, str]):
    """Updates the application settings."""
    # Basic validation could be added here
    queries.update_settings_db(settings)
    return {"status": "success", "settings": settings}