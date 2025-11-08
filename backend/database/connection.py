# backend/database/connection.py

import sqlite3

DB_FILE = "brainstorm.db"

def get_db_connection():
    """Establishes a connection to the database."""
    con = sqlite3.connect(DB_FILE)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON") # Essential for cascade deletes
    return con

def init_db():
    """Initializes all tables for the application."""
    print("Initializing database...")
    con = get_db_connection()
    cur = con.cursor()
    
    # Create nodes table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS nodes (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            fullText TEXT NOT NULL,
            is_ai_node BOOLEAN NOT NULL,
            status TEXT NOT NULL DEFAULT 'Idea'
        )
    """)
    # Create edges table
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
    # Create chat_messages table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            node_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (node_id) REFERENCES nodes (id) ON DELETE CASCADE
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)
    # Seed initial default setting if table is empty
    cur.execute("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('ai_provider', 'gemini')")
    
    cur.execute("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('ollama_model_name', 'llama3')")
    # --- Safe Migrations ---
    # These will add columns if they don't exist, without crashing on subsequent runs.
    def add_column(table, column, col_type):
        try:
            cur.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
        except sqlite3.OperationalError:
            pass # Column already exists
    
    add_column("nodes", "status", "TEXT NOT NULL DEFAULT 'Idea'")
    add_column("edges", "label", "TEXT")

    con.commit()
    con.close()
    print("Database initialization complete.")