# backend/services/settings_service.py (FULLY CORRECTED)

from typing import Dict, Any, Optional
# IMPORT THE REPOSITORY
from ..repositories.settings_repository import SettingsRepository 

class SettingsService:
    """
    Manages all application configuration, using the SettingsRepository for persistence.
    """
    def __init__(self, settings_repo: SettingsRepository):
        self.settings_repo = settings_repo

    # --- FIX 1: Add 'async' and 'await' ---
    async def get_all_settings(self) -> Dict[str, str]:
        """Fetches all settings from the database."""
        return await self.settings_repo.get_settings()

    # --- FIX 2: Add 'async' and 'await' ---
    async def get_setting(self, key: str, default: Any = None) -> Any:
        """Fetches a single setting by key."""
        # Because this calls get_all_settings, it must also be async
        settings = await self.get_all_settings()
        return settings.get(key, default)

    # --- FIX 3: Add 'async' and 'await' ---
    async def update_settings(self, new_settings: Dict[str, Any]):
        """Updates multiple settings and saves them to the database."""
        # Note: You can add validation logic here before passing to the repository
        await self.settings_repo.update_settings(new_settings)

    # --- FIX 4: Add 'async' and 'await' ---
    async def get_gemini_key(self) -> Optional[str]:
        """Gets the configured Gemini key, checking both DB and env vars."""
        # Assuming you still want a fallback to the environment variable from config
        from .. import config
        # Because this calls get_setting, it must also be async
        db_key = await self.get_setting('gemini_api_key')
        return db_key or config.GOOGLE_API_KEY