# backend/routers/chat.py

from fastapi import APIRouter, HTTPException
from ..schemas import ChatRequest
from ..services.llm_service import llm_service
from ..database import queries

router = APIRouter()
@router.get("/api/nodes/{node_id}/chat")
def get_chat_history(node_id: str):
    history_res = queries.get_chat_history_db(node_id)
    # The response now needs to include the generated_by field
    return [{"role": row['role'], "parts": [row['content']], "generated_by": row['generated_by']} for row in history_res]

@router.post("/api/chat")
async def chat_with_idea(request: ChatRequest):
    try:
        history_as_dicts = [h.model_dump() for h in request.history]
        
        result = llm_service.get_chat_response(history_as_dicts, request.user_message, request.node_context)
        ai_message_text = result["response"]
        model_name_used = result["model_name"]
        
        queries.save_chat_message_db(request.node_id, "user", request.user_message) # User message has no model
        queries.save_chat_message_db(request.node_id, "model", ai_message_text, model_name_used) # Pass model name
        
        # Return the model name to the frontend so it can display it instantly
        return {"response": ai_message_text, "model_name": model_name_used}
    except ValueError as e:
        print(f"Error saving chat message to DB: {e}")
        # If saving fails, we should still let the user know what happened
        raise HTTPException(status_code=500, detail="Failed to save message to database.")