# backend/routers/ollama.py

from fastapi import APIRouter, HTTPException
import requests
from ..database import queries

router = APIRouter()

@router.get("/api/ollama/models")
def get_ollama_models():
    """
    Connects to the configured RunPod/Ollama endpoint and fetches the list of
    locally available models.
    """
    settings = queries.get_settings_db()
    base_url = settings.get('runpod_url')

    if not base_url:
        raise HTTPException(status_code=400, detail="RunPod URL is not configured in settings.")

    # We assume it's a Pure Ollama endpoint, as that's what the template is.
    # The endpoint to get tags (models) is /api/tags
    url = f"{base_url.rstrip('/')}/api/tags"
    print(f"Fetching models from: {url}")

    try:
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        # The response is like {"models": [{"name": "llama3:latest", ...}, ...]}
        # We just want the names.
        model_names = [model['name'] for model in data.get('models', [])]
        return {"models": model_names}
        
    except requests.exceptions.RequestException as e:
        print(f"Error fetching models from Ollama: {e}")
        raise HTTPException(status_code=503, detail=f"Could not connect to the Ollama endpoint: {str(e)}")
    except Exception as e:
        print(f"Error parsing model list: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse the model list from Ollama.")