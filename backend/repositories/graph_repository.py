# backend/repositories/graph_repository.py

import uuid
import aiosqlite
import asyncio
from typing import List, Tuple, Dict, Optional

from .. import config

class GraphRepository:
    """
    Handles all CRUD operations for the graph structure.
    Each method establishes its own database connection.
    """
    def __init__(self):
        self.db_path = config.DB_FILE
        self.write_lock = asyncio.Lock()

    async def get_full_graph(self) -> Tuple[List[Dict], List[Dict]]:
        """Fetches all nodes and valid edges (read operation, no lock)."""
        nodes_query = "SELECT * FROM nodes"
        edges_query = """
            SELECT e.* FROM edges e
            JOIN nodes s ON e.source_id = s.id
            JOIN nodes t ON e.target_id = t.id
        """
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(nodes_query) as cursor:
                nodes_res = await cursor.fetchall()
            async with db.execute(edges_query) as cursor:
                edges_res = await cursor.fetchall()
        
        return [dict(row) for row in nodes_res], [dict(row) for row in edges_res]

    async def create_new_idea_branch(self, source_node_id: str, user_prompt: str, ai_data: Dict, model_name: str, attachment_path: Optional[str] = None) -> str:
        """Creates a new idea branch (write operation, uses lock)."""
        ai_node_id = f"node-ai-{uuid.uuid4()}"
        
        async with self.write_lock:
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute(
                    "INSERT INTO nodes (id, label, fullText, is_ai_node, attachment_path) VALUES (?, ?, ?, ?, ?)",
                    (source_node_id, user_prompt, user_prompt, False, attachment_path)
                )
                await db.execute(
                    "INSERT INTO nodes (id, label, fullText, is_ai_node, generated_by, attachment_path) VALUES (?, ?, ?, ?, ?, ?)",
                    (ai_node_id, ai_data["label"], ai_data["fullText"], True, model_name, attachment_path)
                )
                await db.execute(
                    "INSERT INTO edges (source_id, target_id, label) VALUES (?, ?, ?)",
                    (source_node_id, ai_node_id, user_prompt)
                )
                await db.commit()
        return ai_node_id

    async def extend_idea_branch(self, source_node_id: str, user_prompt: str, ai_data: Dict, model_name: str) -> str:
        """Extends an idea branch (write operation, uses lock)."""
        ai_node_id = f"node-ai-{uuid.uuid4()}"
        
        async with self.write_lock:
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute(
                    "INSERT INTO nodes (id, label, fullText, is_ai_node, generated_by) VALUES (?, ?, ?, ?, ?)",
                    (ai_node_id, ai_data["label"], ai_data["fullText"], True, model_name)
                )
                await db.execute(
                    "INSERT INTO edges (source_id, target_id, label) VALUES (?, ?, ?)",
                    (source_node_id, ai_node_id, user_prompt)
                )
                await db.commit()
        return ai_node_id

    async def update_node_status(self, node_id: str, status: str):
        """Updates a node's status (write operation, uses lock)."""
        async with self.write_lock:
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute("UPDATE nodes SET status = ? WHERE id = ?", (status, node_id))
                await db.commit()

    async def delete_branch(self, node_id: str):
        """Deletes a node and its descendants (write operation, uses lock)."""
        query = "WITH RECURSIVE descendants(id) AS (VALUES(?) UNION SELECT edges.target_id FROM edges JOIN descendants ON edges.source_id = descendants.id) DELETE FROM nodes WHERE id IN descendants;"
        
        async with self.write_lock:
            async with aiosqlite.connect(self.db_path) as db:
                # Ensure foreign key constraints are enabled for cascading deletes
                await db.execute("PRAGMA foreign_keys = ON")
                await db.execute(query, (node_id,))
                await db.commit()