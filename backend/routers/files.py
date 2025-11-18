# backend/routers/files.py

from fastapi import APIRouter, UploadFile, File, HTTPException
import shutil
import uuid
from pathlib import Path

# --- FIX: Import the UPLOAD_DIR from the central config ---
from .. import config

router = APIRouter(prefix="/api", tags=["files"])

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Handles image uploads and saves them to the configured UPLOAD_DIR."""
    
    # Ensure the upload directory exists
    config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True) 

    try:
        file_extension = Path(file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        
        # --- FIX: Use the UPLOAD_DIR from config for saving ---
        save_path = config.UPLOAD_DIR / unique_filename
        
        with save_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        relative_path = f"uploads/{unique_filename}"
        
        print(f"File uploaded successfully to: {save_path}")
        return {"filePath": relative_path}

    except Exception as e:
        print(f"File upload failed: {e}")
        raise HTTPException(status_code=500, detail="File upload error.")