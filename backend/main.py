# backend/main.py (FULLY FIXED)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from contextlib import asynccontextmanager

from .data_access.connection import get_db_connection, initialize_db
from .routers import graph, chat, settings, ollama, files, meeting, agents

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Application startup...")

    try:
        # --- CRITICAL: Run initialization exactly once ---
        # get_db_connection is an async generator, so we need to iterate it manually
        db_gen = get_db_connection()
        conn = await db_gen.__anext__()
        try:
            await initialize_db(conn)
            print("Database initialized successfully (WAL, schema, etc)")
        finally:
            # Clean up the generator
            try:
                await db_gen.__anext__()
            except StopAsyncIteration:
                pass
    except Exception as e:
        print(f"FATAL: Could not initialize database: {e}")

    yield

    print("Application shutdown...")

app = FastAPI(lifespan=lifespan)

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ROUTERS ---
app.include_router(graph.router)
app.include_router(chat.router)
app.include_router(settings.router)
app.include_router(ollama.router)
app.include_router(files.router)
app.include_router(meeting.router)
app.include_router(agents.router)

@app.get("/")
def read_root():
    return {"status": "Brainstorming API is running!"}
