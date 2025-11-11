# backend/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .database.connection import init_db
from .routers import graph, chat, settings, ollama, files

load_dotenv()
init_db()

app = FastAPI()

# --- REVERTING to the simple, working CORS configuration ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(graph.router)
app.include_router(chat.router)
app.include_router(settings.router)
app.include_router(ollama.router)
app.include_router(files.router)

@app.get("/")
def read_root():
    return {"status": "Brainstorming API is running!"}