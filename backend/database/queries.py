# backend/database/queries.py

import uuid
from .connection import get_db_connection

def get_full_graph_db():
    con = get_db_connection()
    cur = con.cursor()
    nodes_res = cur.execute("SELECT * FROM nodes").fetchall()
    edges_res = cur.execute("SELECT * FROM edges").fetchall()
    con.close()
    return nodes_res, edges_res

def update_node_status_db(node_id: str, status: str):
    con = get_db_connection()
    cur = con.cursor()
    cur.execute("UPDATE nodes SET status = ? WHERE id = ?", (status, node_id))
    con.commit()
    con.close()

def delete_branch_db(node_id: str):
    con = get_db_connection()
    cur = con.cursor()
    query = """
        WITH RECURSIVE descendants(id) AS (
            VALUES(?)
            UNION
            SELECT edges.target_id FROM edges JOIN descendants ON edges.source_id = descendants.id
        )
        DELETE FROM nodes WHERE id IN descendants;
    """
    cur.execute(query, (node_id,))
    con.commit()
    con.close()

def create_new_idea_branch_db(source_node_id: str, user_prompt: str, ai_data: dict):
    con = get_db_connection()
    cur = con.cursor()
    
    # Create the user node in the DB (this now happens in one transaction)
    cur.execute(
        "INSERT INTO nodes (id, label, fullText, is_ai_node) VALUES (?, ?, ?, ?)",
        (source_node_id, user_prompt, user_prompt, False)
    )

    # Create the AI node
    ai_node_id = f"node-ai-{uuid.uuid4()}"
    cur.execute(
        "INSERT INTO nodes (id, label, fullText, is_ai_node) VALUES (?, ?, ?, ?)",
        (ai_node_id, ai_data["label"], ai_data["fullText"], True)
    )
    # Create the connecting edge
    cur.execute(
        "INSERT INTO edges (source_id, target_id, label) VALUES (?, ?, ?)",
        (source_node_id, ai_node_id, user_prompt)
    )
    con.commit()
    con.close()
    return ai_node_id

def extend_idea_branch_db(source_node_id: str, user_prompt: str, ai_data: dict):
    con = get_db_connection()
    cur = con.cursor()
    ai_node_id = f"node-ai-{uuid.uuid4()}"
    cur.execute(
        "INSERT INTO nodes (id, label, fullText, is_ai_node) VALUES (?, ?, ?, ?)",
        (ai_node_id, ai_data["label"], ai_data["fullText"], True)
    )
    cur.execute(
        "INSERT INTO edges (source_id, target_id, label) VALUES (?, ?, ?)",
        (source_node_id, ai_node_id, user_prompt)
    )
    con.commit()
    con.close()
    return ai_node_id
    
def get_chat_history_db(node_id: str):
    con = get_db_connection()
    cur = con.cursor()
    history_res = cur.execute(
        "SELECT role, content FROM chat_messages WHERE node_id = ? ORDER BY timestamp ASC",
        (node_id,)
    ).fetchall()
    con.close()
    return history_res

def save_chat_message_db(node_id: str, role: str, content: str):
    con = get_db_connection()
    cur = con.cursor()
    cur.execute(
        "INSERT INTO chat_messages (id, node_id, role, content) VALUES (?, ?, ?, ?)",
        (f"msg-{uuid.uuid4()}", node_id, role, content)
    )
    con.commit()
    con.close()

def get_settings_db():
    con = get_db_connection()
    cur = con.cursor()
    settings_res = cur.execute("SELECT key, value FROM app_settings").fetchall()
    con.close()
    # Convert list of rows to a simple dictionary
    return {row['key']: row['value'] for row in settings_res}

def update_settings_db(settings: dict):
    con = get_db_connection()
    cur = con.cursor()
    for key, value in settings.items():
        # "UPSERT" logic: Update if key exists, otherwise Insert.
        cur.execute(
            "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value)
        )
    con.commit()
    con.close()