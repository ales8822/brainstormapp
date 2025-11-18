# backend/config.py

import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv()

# --- PATHS ---
# This is the single source of truth for the project root directory.
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# This is the single source of truth for the upload directory.
UPLOAD_DIR = PROJECT_ROOT / "frontend" / "uploads"

# --- DATABASE ---
# This is the single source of truth for the database file path.
DB_FILE = PROJECT_ROOT / "brainstorm.db"


# --- API KEYS ---
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")