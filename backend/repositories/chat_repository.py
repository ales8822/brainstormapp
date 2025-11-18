# backend/repositories/chat_repository.py

import uuid
import aiosqlite
import asyncio
from typing import List, Dict, Optional
from aiosqlite import OperationalError
from .. import config

class ChatRepository:
    """
    Handles all CRUD operations for chat messages.
    Each method establishes its own database connection.
    """
    def __init__(self):
        self.db_path = config.DB_FILE
        self.write_lock = asyncio.Lock()

    async def get_history(self, node_id: str) -> List[Dict[str, str]]:
        """Fetches conversation history for a node (read operation, no lock)."""
        query = "SELECT role, content, generated_by FROM chat_messages WHERE node_id = ? ORDER BY timestamp ASC"
        async with aiosqlite.connect(self.db_path, timeout=30.0) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(query, (node_id,)) as cursor:
                history_res = await cursor.fetchall()
        return [dict(row) for row in history_res]

    async def save_message(self, node_id: str, role: str, content: str, model_name: Optional[str] = None):
        query = "INSERT INTO chat_messages (id, node_id, role, content, generated_by) VALUES (?, ?, ?, ?, ?)"
        params = (f"msg-{uuid.uuid4()}", node_id, role, content, model_name)

        # Try a few times on lock collisions
        max_attempts = 5
        backoff = 0.1
        for attempt in range(max_attempts):
            try:
                async with self.write_lock:  # keeps writes from the same request ordered
                    async with aiosqlite.connect(self.db_path, timeout=30.0) as db:
                        await db.execute(query, params)
                        await db.commit()
                return
            except OperationalError as e:
                # SQLite 'database is locked' can appear here
                if 'database is locked' in str(e).lower():
                    if attempt + 1 == max_attempts:
                        raise
                    await asyncio.sleep(backoff)
                    backoff *= 2
                    continue
                else:
                    raise