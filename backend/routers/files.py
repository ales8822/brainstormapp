# backend/routers/files.py

from fastapi import APIRouter, UploadFile, File, HTTPException
import shutil
import uuid
from pathlib import Path

router = APIRouter(prefix="/api", tags=["files"])

# --- THE FIX ---
# Point to the new location: brainstorming_app/frontend/uploads/
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
UPLOAD_DIR = PROJECT_ROOT / "frontend" / "uploads"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True) # Ensure the directory and its parents exist

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        file_extension = Path(file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        save_path = UPLOAD_DIR / unique_filename
        
        with save_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # The path relative to the http.server root (the frontend folder)
        relative_path = f"uploads/{unique_filename}"
        
        print(f"File uploaded successfully to frontend folder: {relative_path}")
        return {"filePath": relative_path}

    except Exception as e:
        print(f"File upload failed: {e}"); raise HTTPException(status_code=500, detail="File upload error.")