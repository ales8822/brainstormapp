# backend/routers/ollama.py (FULLY CORRECTED)

from fastapi import APIRouter, HTTPException, Depends
import httpx  # Use the async-compatible httpx library

# Import the async dependency
from ..dependencies import get_ollama_base_url

router = APIRouter()

# --- CRITICAL FIX: Convert the endpoint to be async ---
@router.get("/api/ollama/models")
async def get_ollama_models(  # <-- Add async
    base_url: str = Depends(get_ollama_base_url)
):
    """
    Connects to the configured Ollama endpoint and fetches the list of
    locally available models asynchronously.
    """
    url = f"{base_url}/api/tags"
    print(f"Fetching models from: {url}")

    # Use an async HTTP client for non-blocking network requests
    async with httpx.AsyncClient() as client:
        try:
            # --- FIX: Use 'await' with the async client ---
            response = await client.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            model_names = [model['name'] for model in data.get('models', [])]
            return {"models": model_names}
            
        except httpx.RequestError as e:
            # Catch exceptions from the httpx library
            print(f"Error fetching models from Ollama: {e}")
            raise HTTPException(status_code=503, detail=f"Could not connect to the Ollama endpoint: {str(e)}")
        except Exception as e:
            print(f"Error parsing model list: {e}")
            raise HTTPException(status_code=500, detail="Failed to parse the model list from Ollama.")