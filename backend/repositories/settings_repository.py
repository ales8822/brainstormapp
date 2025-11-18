# backend/repositories/settings_repository.py

import aiosqlite
import asyncio
from typing import Dict, Any

from .. import config

class SettingsRepository:
    """
    Handles all CRUD operations for application settings.
    Each method establishes its own database connection.
    """
    def __init__(self):
        self.db_path = config.DB_FILE
        self.write_lock = asyncio.Lock()

    async def get_settings(self) -> Dict[str, str]:
        """Fetches all settings (read operation, no lock)."""
        query = "SELECT key, value FROM app_settings"
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(query) as cursor:
                settings_res = await cursor.fetchall()
        return {row['key']: row['value'] for row in settings_res}

    async def update_settings(self, settings: Dict[str, Any]):
        """Inserts or updates multiple settings (write operation, uses lock)."""
        query = "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
        
        async with self.write_lock:
            async with aiosqlite.connect(self.db_path) as db:
                for key, value in settings.items():
                    await db.execute(query, (key, str(value)))
                await db.commit()