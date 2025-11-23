import aiosqlite
from typing import List, Dict, Optional
import uuid
from datetime import datetime

class AgentRepository:
    def __init__(self, db: aiosqlite.Connection):
        self.db = db

    async def create_agent(
        self, 
        name: str, 
        role: str, 
        system_instructions: str, 
        model_provider: str,
        avatar_color: str = "#3498db"
    ) -> str:
        """Create a new custom agent and return its ID."""
        agent_id = str(uuid.uuid4())
        await self.db.execute(
            """
            INSERT INTO agents (id, name, role, system_instructions, model_provider, avatar_color, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (agent_id, name, role, system_instructions, model_provider, avatar_color, datetime.now())
        )
        await self.db.commit()
        return agent_id

    async def get_all_agents(self) -> List[Dict]:
        """Retrieve all agents."""
        cursor = await self.db.execute(
            "SELECT id, name, role, system_instructions, model_provider, avatar_color, created_at FROM agents ORDER BY created_at DESC"
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]

    async def get_agent_by_id(self, agent_id: str) -> Optional[Dict]:
        """Retrieve a single agent by ID."""
        cursor = await self.db.execute(
            "SELECT id, name, role, system_instructions, model_provider, avatar_color, created_at FROM agents WHERE id = ?",
            (agent_id,)
        )
        row = await cursor.fetchone()
        return dict(row) if row else None

    async def get_agent_by_name(self, name: str) -> Optional[Dict]:
        """Retrieve a single agent by name."""
        cursor = await self.db.execute(
            "SELECT id, name, role, system_instructions, model_provider, avatar_color, created_at FROM agents WHERE name = ?",
            (name,)
        )
        row = await cursor.fetchone()
        return dict(row) if row else None

    async def update_agent(
        self,
        agent_id: str,
        name: str,
        role: str,
        system_instructions: str,
        model_provider: str,
        avatar_color: str
    ) -> bool:
        """Update an existing agent. Returns True if successful."""
        cursor = await self.db.execute(
            """
            UPDATE agents
            SET name = ?, role = ?, system_instructions = ?, model_provider = ?, avatar_color = ?
            WHERE id = ?
            """,
            (name, role, system_instructions, model_provider, avatar_color, agent_id)
        )
        await self.db.commit()
        return cursor.rowcount > 0

    async def delete_agent(self, agent_id: str) -> bool:
        """Delete an agent. Returns True if successful."""
        cursor = await self.db.execute(
            "DELETE FROM agents WHERE id = ?",
            (agent_id,)
        )
        await self.db.commit()
        return cursor.rowcount > 0
