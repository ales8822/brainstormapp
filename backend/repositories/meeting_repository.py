import json
import aiosqlite
from typing import List, Dict, Optional
from datetime import datetime

class MeetingRepository:
    def __init__(self, db: aiosqlite.Connection):
        self.db = db

    async def create_meeting(self, meeting_id: str, topic: str, company_context: str, participants: List[str]) -> None:
        await self.db.execute(
            """
            INSERT INTO meetings (id, topic, company_context, participants, start_time)
            VALUES (?, ?, ?, ?, ?)
            """,
            (meeting_id, topic, company_context, json.dumps(participants), datetime.now())
        )
        await self.db.commit()

    async def add_message(self, meeting_id: str, role: str, agent_name: Optional[str], content: str) -> None:
        await self.db.execute(
            """
            INSERT INTO meeting_messages (meeting_id, role, agent_name, content, timestamp)
            VALUES (?, ?, ?, ?, ?)
            """,
            (meeting_id, role, agent_name, content, datetime.now())
        )
        await self.db.commit()

    async def update_minutes(self, meeting_id: str, minutes_text: str) -> None:
        await self.db.execute(
            """
            UPDATE meetings
            SET minutes_text = ?, end_time = ?
            WHERE id = ?
            """,
            (minutes_text, datetime.now(), meeting_id)
        )
        await self.db.commit()

    async def get_all_meetings(self) -> List[Dict]:
        cursor = await self.db.execute(
            "SELECT id, topic, start_time, end_time FROM meetings ORDER BY start_time DESC"
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]

    async def get_meeting_details(self, meeting_id: str) -> Optional[Dict]:
        cursor = await self.db.execute(
            "SELECT * FROM meetings WHERE id = ?", (meeting_id,)
        )
        meeting_row = await cursor.fetchone()
        if not meeting_row:
            return None
        
        meeting_data = dict(meeting_row)
        meeting_data['participants'] = json.loads(meeting_data['participants'])

        # Get messages
        cursor = await self.db.execute(
            "SELECT role, agent_name, content, timestamp FROM meeting_messages WHERE meeting_id = ? ORDER BY timestamp ASC",
            (meeting_id,)
        )
        message_rows = await cursor.fetchall()
        meeting_data['messages'] = [dict(row) for row in message_rows]
        
        return meeting_data
