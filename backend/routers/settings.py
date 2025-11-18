# backend/routers/settings.py (FULLY CORRECTED)

from fastapi import APIRouter, Depends
from typing import Dict, Any

# Import the service and its dependencies
from ..services.settings_service import SettingsService
from ..dependencies import get_settings_service

router = APIRouter()

# --- FIX 1: Add 'async' and 'await' ---
@router.get("/api/settings")
async def get_settings( # <--- Add async
    settings_service: SettingsService = Depends(get_settings_service)
):
    """Fetches the current application settings."""
    # The service method is now a coroutine, so we must await it
    return await settings_service.get_all_settings() # <--- Add await

# --- FIX 2: Add 'async' and 'await' ---
@router.post("/api/settings")
async def update_settings( # <--- Add async
    settings: Dict[str, Any],
    settings_service: SettingsService = Depends(get_settings_service)
):
    """Updates the application settings."""
    # The service method is now a coroutine, so we must await it
    await settings_service.update_settings(settings) # <--- Add await
    return {"status": "success", "settings": settings}