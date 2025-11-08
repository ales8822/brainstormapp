# backend/routers/chat.py

from fastapi import APIRouter, HTTPException
from ..schemas import ChatRequest
from ..services.llm_service import llm_service
from ..database import queries

router = APIRouter()

@router.get("/api/nodes/{node_id}/chat")
def get_chat_history(node_id: str):
    history_res = queries.get_chat_history_db(node_id)
    return [{"role": row['role'], "parts": [row['content']]} for row in history_res]


# --- THIS IS THE CORRECTED ENDPOINT ---
@router.post("/api/chat")
async def chat_with_idea(request: ChatRequest):
    try:
        history_as_dicts = [h.model_dump() for h in request.history]
        ai_message_text = llm_service.get_chat_response(
            history_as_dicts, 
            request.user_message,
            request.node_context
        )
        
    except ValueError as e:
        # --- THE FIX: Gracefully handle missing API key error ---
        print(f"Handled configuration error in chat: {e}")
        ai_message_text = str(e)

    except Exception as e:
        # For other errors, we can also return them gracefully in the chat
        print(f"Error during chat: {e}")
        ai_message_text = f"An unexpected server error occurred: {str(e)}"

    # This part now runs for both success and error cases
    try:
        queries.save_chat_message_db(request.node_id, "user", request.user_message)
        queries.save_chat_message_db(request.node_id, "model", ai_message_text)
        return {"response": ai_message_text}
    except Exception as e:
        print(f"Error saving chat message to DB: {e}")
        # If saving fails, we should still let the user know what happened
        raise HTTPException(status_code=500, detail="Failed to save message to database.")