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
    # Add a 'status' column to the nodes table with a default value
    cur.execute("""
        CREATE TABLE IF NOT EXISTS nodes (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            fullText TEXT NOT NULL,
            is_ai_node BOOLEAN NOT NULL,
            status TEXT NOT NULL DEFAULT 'Idea'
        )
    """)
    # Edges table remains the same
    cur.execute("""
        CREATE TABLE IF NOT EXISTS edges (
            source_id TEXT NOT NULL,
            target_id TEXT NOT NULL,
            FOREIGN KEY (source_id) REFERENCES nodes (id) ON DELETE CASCADE,
            FOREIGN KEY (target_id) REFERENCES nodes (id) ON DELETE CASCADE,
            PRIMARY KEY (source_id, target_id)
        )
    """)
    # A one-time migration to add the status column if it doesn't exist
    try:
        cur.execute("ALTER TABLE nodes ADD COLUMN status TEXT NOT NULL DEFAULT 'Idea'")
        con.commit()
    except sqlite3.OperationalError:
        # This will fail if the column already exists, which is fine.
        pass
    con.close()

# --- Model & App Setup ---
# (This section is the same as before)
load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key: raise ValueError("No GOOGLE_API_KEY found.")
genai.configure(api_key=api_key)
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- Pydantic Models ---
class BrainstormRequest(BaseModel):
    prompt: str
    parent_context: Optional[str] = None
    source_node_id: Optional[str] = None

class StatusUpdateRequest(BaseModel):
    status: str

# --- API Endpoints for SQLite ---
@app.get("/api/graph")
def get_graph():
    # ... (code to fetch nodes and edges)
    con = sqlite3.connect(DB_FILE); con.row_factory = sqlite3.Row; cur = con.cursor()
    nodes_res = cur.execute("SELECT * FROM nodes").fetchall()
    edges_res = cur.execute("SELECT * FROM edges").fetchall()
    con.close()
    elements = []
    for node_row in nodes_res:
        # Include the status in the node's data
        node_data = {"id": node_row["id"], "label": node_row["label"], "fullText": node_row["fullText"], "status": node_row["status"]}
        element = {"group": "nodes", "data": node_data}
        if node_row["is_ai_node"]: element["classes"] = "ai-node"
        elements.append(element)
    for edge_row in edges_res:
        edge_data = {"id": f"edge-{edge_row['source_id']}-{edge_row['target_id']}", "source": edge_row['source_id'], "target": edge_row['target_id']}
        elements.append({"group": "edges", "data": edge_data})
    return elements

# NEW ENDPOINT to update a node's status
@app.put("/api/nodes/{node_id}/status")
def update_node_status(node_id: str, request: StatusUpdateRequest):
    valid_statuses = ['Idea', 'InProgress', 'Completed', 'Archived']
    if request.status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status value.")
    
    con = sqlite3.connect(DB_FILE)
    cur = con.cursor()
    cur.execute("UPDATE nodes SET status = ? WHERE id = ?", (request.status, node_id))
    con.commit()
    con.close()
    return {"status": "success", "updated_id": node_id, "new_status": request.status}

@app.delete("/api/nodes/{node_id}")
def delete_node(node_id: str):
    # (This endpoint is the same as before)
    con = sqlite3.connect(DB_FILE); con.execute("PRAGMA foreign_keys = ON"); cur = con.cursor()
    cur.execute("DELETE FROM nodes WHERE id = ?", (node_id,)); con.commit(); con.close()
    return {"status": "success", "deleted_id": node_id}

@app.post("/api/brainstorm")
async def brainstorm_idea(request: BrainstormRequest):
    # (This endpoint is mostly the same, just inserting the default status)
    try:
        model = genai.GenerativeModel('gemini-2.0-flash')
        prompt_context = f'Analyze request: "{request.prompt}"'
        if request.parent_context:
            prompt_context = f'CONTEXT: "{request.parent_context}"\n\nAnalyze request: "{request.prompt}"'
        structured_prompt = f'{prompt_context}\n\nFormat output as a JSON object with keys "label" and "fullText".'
        response = model.generate_content(structured_prompt)
        cleaned_response_text = response.text.strip().replace('```json', '').replace('```', '')
        ai_response_data = json.loads(cleaned_response_text)
        con = sqlite3.connect(DB_FILE); cur = con.cursor()
        source_node_id = request.source_node_id
        if not source_node_id:
            source_node_id = f"node-{uuid.uuid4()}"
            # Note: The 'status' column will use its default value 'Idea' here
            cur.execute("INSERT INTO nodes (id, label, fullText, is_ai_node) VALUES (?, ?, ?, ?)", (source_node_id, request.prompt, request.prompt, False))
        ai_node_id = f"node-{uuid.uuid4()}"
        cur.execute("INSERT INTO nodes (id, label, fullText, is_ai_node) VALUES (?, ?, ?, ?)", (ai_node_id, ai_response_data["label"], ai_response_data["fullText"], True))
        cur.execute("INSERT INTO edges (source_id, target_id) VALUES (?, ?)", (source_node_id, ai_node_id))
        con.commit(); con.close()
        return {"user_node_id": source_node_id, "ai_node": {"id": ai_node_id, "label": ai_response_data["label"], "fullText": ai_response_data["fullText"]}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

init_db()