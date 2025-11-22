# backend/data_access/connection.py (FULLY ASYNCHRONOUS WITH AIOSQLITE)

import aiosqlite
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

# Use Path for robust file location (assuming this file is in backend/data_access)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DB_FILE = PROJECT_ROOT / "brainstorm.db"

async def initialize_db(conn: aiosqlite.Connection):
    """Initializes all tables for the application (async operations)."""
    print("Initializing database...")
    
    # Helper to execute safely
    async def execute_query(query, params=()):
        await conn.execute(query, params)
        
    # Helper for safe column migration
    async def add_column(table, column, col_type):
        try:
            await conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
            await conn.commit()
        except aiosqlite.OperationalError as e:
            # Table/column already exists or other safe error
            if not 'duplicate column name' in str(e) and not 'no such table' in str(e):
                 print(f"Migration Warning: {e}")
        except Exception as e:
            print(f"Migration Error: {e}")

    await conn.execute("PRAGMA foreign_keys = ON")
    # WAL mode improves concurrency for reads + writes. busy_timeout tells SQLite to wait for the lock instead of failing immediately.
    await conn.execute("PRAGMA journal_mode = WAL;")
    await conn.execute("PRAGMA synchronous = NORMAL;")
    await conn.execute("PRAGMA busy_timeout = 5000;")  # 5000 ms

    # Create tables
    await execute_query("""
        CREATE TABLE IF NOT EXISTS nodes (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            fullText TEXT NOT NULL,
            is_ai_node BOOLEAN NOT NULL,
            status TEXT NOT NULL DEFAULT 'Idea',
            generated_by TEXT,
            attachment_path TEXT
        )
    """)
    await execute_query("""
        CREATE TABLE IF NOT EXISTS edges (
            source_id TEXT NOT NULL, target_id TEXT NOT NULL, label TEXT,
            FOREIGN KEY (source_id) REFERENCES nodes (id) ON DELETE CASCADE,
            FOREIGN KEY (target_id) REFERENCES nodes (id) ON DELETE CASCADE,
            PRIMARY KEY (source_id, target_id)
        )
    """)
    await execute_query("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            node_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            generated_by TEXT,
            FOREIGN KEY (node_id) REFERENCES nodes (id) ON DELETE CASCADE
        )
    """)
    await execute_query("CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT)")

    # Seed initial default settings
    await execute_query(
        "INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", 
        ('ai_provider', 'gemini')
    )
    await execute_query(
        "INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", 
        ('ollama_model_name', 'llama3')
    )

    # Meeting Board Tables
    await execute_query("""
        CREATE TABLE IF NOT EXISTS meetings (
            id TEXT PRIMARY KEY,
            topic TEXT NOT NULL,
            company_context TEXT,
            participants TEXT NOT NULL, -- JSON list of agent names
            start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            end_time DATETIME,
            minutes_text TEXT
        )
    """)
    await execute_query("""
        CREATE TABLE IF NOT EXISTS meeting_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            meeting_id TEXT NOT NULL,
            role TEXT NOT NULL, -- 'user', 'model', 'system'
            agent_name TEXT, -- 'Steve Jobs', 'gemini', etc.
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (meeting_id) REFERENCES meetings (id) ON DELETE CASCADE
        )
    """)

    # Safe Migrations (must run after tables are created)
    await add_column("nodes", "status", "TEXT NOT NULL DEFAULT 'Idea'")
    await add_column("edges", "label", "TEXT")
    await add_column("nodes", "generated_by", "TEXT")
    await add_column("chat_messages", "generated_by", "TEXT")
# backend/data_access/connection.py (FULLY ASYNCHRONOUS WITH AIOSQLITE)

import aiosqlite
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

# Use Path for robust file location (assuming this file is in backend/data_access)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DB_FILE = PROJECT_ROOT / "brainstorm.db"

async def initialize_db(conn: aiosqlite.Connection):
    """Initializes all tables for the application (async operations)."""
    print("Initializing database...")
    
    # Helper to execute safely
    async def execute_query(query, params=()):
        await conn.execute(query, params)
        
    # Helper for safe column migration
    async def add_column(table, column, col_type):
        try:
            await conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
            await conn.commit()
        except aiosqlite.OperationalError as e:
            # Table/column already exists or other safe error
            if not 'duplicate column name' in str(e) and not 'no such table' in str(e):
                 print(f"Migration Warning: {e}")
        except Exception as e:
            print(f"Migration Error: {e}")

    await conn.execute("PRAGMA foreign_keys = ON")
    # WAL mode improves concurrency for reads + writes. busy_timeout tells SQLite to wait for the lock instead of failing immediately.
    await conn.execute("PRAGMA journal_mode = WAL;")
    await conn.execute("PRAGMA synchronous = NORMAL;")
    await conn.execute("PRAGMA busy_timeout = 5000;")  # 5000 ms

    # Create tables
    await execute_query("""
        CREATE TABLE IF NOT EXISTS nodes (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            fullText TEXT NOT NULL,
            is_ai_node BOOLEAN NOT NULL,
            status TEXT NOT NULL DEFAULT 'Idea',
            generated_by TEXT,
            attachment_path TEXT
        )
    """)
    await execute_query("""
        CREATE TABLE IF NOT EXISTS edges (
            source_id TEXT NOT NULL, target_id TEXT NOT NULL, label TEXT,
            FOREIGN KEY (source_id) REFERENCES nodes (id) ON DELETE CASCADE,
            FOREIGN KEY (target_id) REFERENCES nodes (id) ON DELETE CASCADE,
            PRIMARY KEY (source_id, target_id)
        )
    """)
    await execute_query("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            node_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            generated_by TEXT,
            FOREIGN KEY (node_id) REFERENCES nodes (id) ON DELETE CASCADE
        )
    """)
    await execute_query("CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT)")

    # Seed initial default settings
    await execute_query(
        "INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", 
        ('ai_provider', 'gemini')
    )
    await execute_query(
        "INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", 
        ('ollama_model_name', 'llama3')
    )

    # Meeting Board Tables
    await execute_query("""
        CREATE TABLE IF NOT EXISTS meetings (
            id TEXT PRIMARY KEY,
            topic TEXT NOT NULL,
            company_context TEXT,
            participants TEXT NOT NULL, -- JSON list of agent names
            start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            end_time DATETIME,
            minutes_text TEXT
        )
    """)
    await execute_query("""
        CREATE TABLE IF NOT EXISTS meeting_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            meeting_id TEXT NOT NULL,
            role TEXT NOT NULL, -- 'user', 'model', 'system'
            agent_name TEXT, -- 'Steve Jobs', 'gemini', etc.
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (meeting_id) REFERENCES meetings (id) ON DELETE CASCADE
        )
    """)

    # Safe Migrations (must run after tables are created)
    await add_column("nodes", "status", "TEXT NOT NULL DEFAULT 'Idea'")
    await add_column("edges", "label", "TEXT")
    await add_column("nodes", "generated_by", "TEXT")
    await add_column("chat_messages", "generated_by", "TEXT")
    await add_column("nodes", "attachment_path", "TEXT")
    await add_column("nodes", "workspace_id", "TEXT")
    await conn.commit()
    print("Database initialization complete.")


async def get_db_connection() -> AsyncGenerator[aiosqlite.Connection, None]:
    """
    Provides a database connection with automatic setup and closing.
    Used by FastAPI Dependency Injection.
    """
    # Use aiosqlite.connect (async)
    conn = await aiosqlite.connect(DB_FILE)
    conn.row_factory = aiosqlite.Row # Use the built-in Row factory

    # Run initialization (async)
    try:
        # await initialize_db(conn)
        yield conn
    finally:
        await conn.close()