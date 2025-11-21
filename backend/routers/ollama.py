# backend/routers/ollama.py (FULLY CORRECTED)

from fastapi import APIRouter, HTTPException, Depends

from ..dependencies import get_llm_service
from ..services.llm_service import LLMService
router = APIRouter()

# --- CRITICAL FIX: Convert the endpoint to be async ---
@router.get("/api/ollama/models")
async def get_ollama_models(
    llm_service: LLMService = Depends(get_llm_service)
):
    """
    Safely connects to the configured Ollama endpoint and fetches the list of
    locally available models. Returns an empty list on failure.
    """
    # The service method now handles all logic and error catching.
    model_names = await llm_service.get_available_models()
    return {"models": model_names}