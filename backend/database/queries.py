# backend/database/queries.py

import uuid
from .connection import get_db_connection


# --- MODIFIED FUNCTIONS ---

def get_full_graph_db():
    con = get_db_connection()
    cur = con.cursor()
    # Select all columns, including the new 'generated_by'
    nodes_res = cur.execute("SELECT * FROM nodes").fetchall()
    edges_res = cur.execute("SELECT * FROM edges").fetchall()
    con.close()
    return nodes_res, edges_res

def create_new_idea_branch_db(source_node_id: str, user_prompt: str, ai_data: dict, model_name: str):
    con = get_db_connection()
    cur = con.cursor()
    cur.execute(
        "INSERT INTO nodes (id, label, fullText, is_ai_node) VALUES (?, ?, ?, ?)",
        (source_node_id, user_prompt, user_prompt, False)
    )
    ai_node_id = f"node-ai-{uuid.uuid4()}"
    cur.execute(
        "INSERT INTO nodes (id, label, fullText, is_ai_node, generated_by) VALUES (?, ?, ?, ?, ?)",
        (ai_node_id, ai_data["label"], ai_data["fullText"], True, model_name)
    )
    cur.execute(
        "INSERT INTO edges (source_id, target_id, label) VALUES (?, ?, ?)",
        (source_node_id, ai_node_id, user_prompt)
    )
    con.commit()
    con.close()
    return ai_node_id

def create_new_idea_branch_db(source_node_id: str, user_prompt: str, ai_data: dict, model_name: str, attachment_path: str = None):
    con = get_db_connection()
    cur = con.cursor()
    # Save the attachment_path with the user's root node
    cur.execute(
        "INSERT INTO nodes (id, label, fullText, is_ai_node, attachment_path) VALUES (?, ?, ?, ?, ?)",
        (source_node_id, user_prompt, user_prompt, False, attachment_path)
    )
    ai_node_id = f"node-ai-{uuid.uuid4()}"
    # --- THE FIX ---
    # Also save the attachment_path with the DIRECT AI child node
    cur.execute(
        "INSERT INTO nodes (id, label, fullText, is_ai_node, generated_by, attachment_path) VALUES (?, ?, ?, ?, ?, ?)",
        (ai_node_id, ai_data["label"], ai_data["fullText"], True, model_name, attachment_path)
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
    # Select the new 'generated_by' column
    history_res = cur.execute(
        "SELECT role, content, generated_by FROM chat_messages WHERE node_id = ? ORDER BY timestamp ASC",
        (node_id,)
    ).fetchall()
    con.close()
    return history_res

def save_chat_message_db(node_id: str, role: str, content: str, model_name: str = None):
    con = get_db_connection()
    cur = con.cursor()
    cur.execute(
        "INSERT INTO chat_messages (id, node_id, role, content, generated_by) VALUES (?, ?, ?, ?, ?)",
        (f"msg-{uuid.uuid4()}", node_id, role, content, model_name)
    )
    con.commit()
    con.close()

def extend_idea_branch_db(source_node_id: str, user_prompt: str, ai_data: dict, model_name: str):
    con = get_db_connection()
    cur = con.cursor()
    ai_node_id = f"node-ai-{uuid.uuid4()}"
    cur.execute(
        "INSERT INTO nodes (id, label, fullText, is_ai_node, generated_by) VALUES (?, ?, ?, ?, ?)",
        (ai_node_id, ai_data["label"], ai_data["fullText"], True, model_name)
    )
    cur.execute(
        "INSERT INTO edges (source_id, target_id, label) VALUES (?, ?, ?)",
        (source_node_id, ai_node_id, user_prompt)
    )
    con.commit()
    con.close()
    return ai_node_id

# --- UNCHANGED FUNCTIONS for copy-paste safety ---
def get_settings_db():
    con = get_db_connection()
    cur = con.cursor()
    settings_res = cur.execute("SELECT key, value FROM app_settings").fetchall()
    con.close()
    return {row['key']: row['value'] for row in settings_res}
def update_settings_db(settings: dict):
    con = get_db_connection()
    cur = con.cursor()
    for key, value in settings.items():
        cur.execute("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (key, value))
    con.commit()
    con.close()
def update_node_status_db(node_id: str, status: str):
    con = get_db_connection()
    cur = con.cursor()
    cur.execute("UPDATE nodes SET status = ? WHERE id = ?", (status, node_id))
    con.commit()
    con.close()
def delete_branch_db(node_id: str):
    con = get_db_connection()
    cur = con.cursor()
    query = "WITH RECURSIVE descendants(id) AS (VALUES(?) UNION SELECT edges.target_id FROM edges JOIN descendants ON edges.source_id = descendants.id) DELETE FROM nodes WHERE id IN descendants;"
    cur.execute(query, (node_id,))
    con.commit()
    con.close()