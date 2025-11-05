import os
import json
import sqlite3
import uuid
import google.generativeai as genai
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

# --- Database Setup (SQLite) ---
DB_FILE = "brainstorm.db"

def init_db():
    con = sqlite3.connect(DB_FILE)
    cur = con.cursor()
    cur.execute("CREATE TABLE IF NOT EXISTS nodes (id TEXT PRIMARY KEY, label TEXT NOT NULL, fullText TEXT NOT NULL, is_ai_node BOOLEAN NOT NULL, status TEXT NOT NULL DEFAULT 'Idea')")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS edges (
            source_id TEXT NOT NULL,
            target_id TEXT NOT NULL,
            label TEXT,
            FOREIGN KEY (source_id) REFERENCES nodes (id) ON DELETE CASCADE,
            FOREIGN KEY (target_id) REFERENCES nodes (id) ON DELETE CASCADE,
            PRIMARY KEY (source_id, target_id)
        )
    """)
    try:
        cur.execute("ALTER TABLE nodes ADD COLUMN status TEXT NOT NULL DEFAULT 'Idea'")
        con.commit()
    except sqlite3.OperationalError: pass
    try:
        cur.execute("ALTER TABLE edges ADD COLUMN label TEXT")
        con.commit()
    except sqlite3.OperationalError: pass
    con.close()

# --- Model & App Setup ---
load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key: raise ValueError("No GOOGLE_API_KEY found.")
genai.configure(api_key=api_key)
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

class BrainstormRequest(BaseModel):
    prompt: str
    parent_context: Optional[str] = None
    source_node_id: Optional[str] = None
class StatusUpdateRequest(BaseModel):
    status: str

@app.get("/api/graph")
def get_graph():
    con = sqlite3.connect(DB_FILE); con.row_factory = sqlite3.Row; cur = con.cursor()
    nodes_res = cur.execute("SELECT * FROM nodes").fetchall()
    edges_res = cur.execute("SELECT * FROM edges").fetchall()
    con.close(); elements = []
    for node_row in nodes_res:
        node_data = {"id": node_row["id"], "label": node_row["label"], "fullText": node_row["fullText"], "status": node_row["status"]}
        node_class = "ai-node" if node_row["is_ai_node"] else "user-node"
        elements.append({"group": "nodes", "data": node_data, "classes": node_class})
        
    for edge_row in edges_res:
        # --- THIS IS THE PERMANENT FIX ---
        # If the label from the DB is None (for old edges), send an empty string instead.
        edge_label = edge_row['label'] if edge_row['label'] is not None else ""
        
        edge_data = {
            "id": f"edge-{edge_row['source_id']}-{edge_row['target_id']}",
            "source": edge_row['source_id'],
            "target": edge_row['target_id'],
            "label": edge_label # Use the safe variable
        }
        elements.append({"group": "edges", "data": edge_data})
    return elements

@app.put("/api/nodes/{node_id}/status")
def update_node_status(node_id: str, request: StatusUpdateRequest):
    valid_statuses = ['Idea', 'InProgress', 'Completed', 'Archived']
    if request.status not in valid_statuses: raise HTTPException(status_code=400, detail="Invalid status value.")
    con = sqlite3.connect(DB_FILE); cur = con.cursor(); cur.execute("UPDATE nodes SET status = ? WHERE id = ?", (request.status, node_id)); con.commit(); con.close()
    return {"status": "success", "updated_id": node_id, "new_status": request.status}

@app.delete("/api/nodes/{node_id}")
def delete_node(node_id: str):
    con = sqlite3.connect(DB_FILE); con.execute("PRAGMA foreign_keys = ON"); cur = con.cursor()
    query = "WITH RECURSIVE descendants(id) AS (VALUES(?) UNION SELECT edges.target_id FROM edges JOIN descendants ON edges.source_id = descendants.id) DELETE FROM nodes WHERE id IN descendants;"
    cur.execute(query, (node_id,)); con.commit(); con.close()
    return {"status": "success", "deleted_root_id": node_id}

@app.post("/api/brainstorm")
async def brainstorm_idea(request: BrainstormRequest):
    try:
        model = genai.GenerativeModel('gemini-2.0-flash')
        instruction = f'Directly and helpfully respond to the user prompt: "{request.prompt}"'
        if request.parent_context:
            instruction = f'Given context of "{request.parent_context}", directly respond to the follow-up: "{request.prompt}"'
        structured_prompt = f'{instruction}\n\nFormat your output as a single JSON object with keys "label" and "fullText".'
        response = model.generate_content(structured_prompt)
        cleaned_response_text = response.text.strip().replace('```json', '').replace('```', '')
        ai_response_data = json.loads(cleaned_response_text)
        con = sqlite3.connect(DB_FILE); cur = con.cursor()
        source_node_id = request.source_node_id
        if not request.parent_context:
            cur.execute("INSERT INTO nodes (id, label, fullText, is_ai_node) VALUES (?, ?, ?, ?)", (source_node_id, request.prompt, request.prompt, False))
        ai_node_id = f"node-ai-{uuid.uuid4()}"
        cur.execute("INSERT INTO nodes (id, label, fullText, is_ai_node) VALUES (?, ?, ?, ?)", (ai_node_id, ai_response_data["label"], ai_response_data["fullText"], True))
        cur.execute("INSERT INTO edges (source_id, target_id, label) VALUES (?, ?, ?)", (source_node_id, ai_node_id, request.prompt))
        con.commit(); con.close()
        return {"user_node_id": source_node_id, "ai_node": {"id": ai_node_id, "label": ai_response_data["label"], "fullText": ai_response_data["fullText"]}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

init_db()