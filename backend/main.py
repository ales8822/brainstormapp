# backend/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# The load_dotenv call is now removed from here

from .database.connection import init_db
from .routers import graph, chat, settings, ollama

# Initialize the database and create tables on startup
init_db()

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the routers
app.include_router(graph.router)
app.include_router(chat.router)
app.include_router(settings.router)
app.include_router(ollama.router)
@app.get("/")
def read_root():
    return {"status": "Brainstorming API is running!"}