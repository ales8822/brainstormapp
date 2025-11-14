# backend/routers/chat.py

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from ..schemas import ChatRequest, GroupChatRequest
from ..services.llm_service import llm_service
from ..database import queries
import json

router = APIRouter(prefix="/api", tags=["chat"])

@router.get("/nodes/{node_id}/chat")
def get_chat_history(node_id: str):
    history_res = queries.get_chat_history_db(node_id)
    return [{"role": row['role'], "parts": [row['content']], "generated_by": row['generated_by']} for row in history_res]


# --- THIS IS THE FINAL, CORRECTED ENDPOINT ---
@router.post("/chat")
async def chat_with_idea(request: ChatRequest):
    print("--- SINGLE CHAT ENDPOINT TRIGGERED ---")
    try:
        # --- THE FIX: We must look up the node to get its attachment path ---
        con = queries.get_db_connection()
        node_res = con.execute("SELECT attachment_path FROM nodes WHERE id = ?", (request.node_id,)).fetchone()
        con.close()
        
        attachment_path = None
        if node_res and node_res['attachment_path']:
            attachment_path = node_res['attachment_path']
        
        print(f"Attachment path for this node: {attachment_path}")
        # ---------------------------------------------------------------

        history_as_dicts = [h.model_dump() for h in request.history]
        
        result = llm_service.get_chat_response(
            history_as_dicts, 
            request.user_message,
            request.node_context,
            attachment_path  # <-- Now we pass the correct value
        )
        ai_message_text = result["response"]
        model_name_used = result["model_name"]
        
        queries.save_chat_message_db(request.node_id, "user", request.user_message)
        queries.save_chat_message_db(request.node_id, "model", ai_message_text, model_name_used)
        
        return {"response": ai_message_text, "model_name": model_name_used}

    except ValueError as e:
        print(f"Handled configuration error in chat: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error during chat: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected server error occurred: {str(e)}")
    
# --- NEW: Group Chat Endpoint ---
@router.post("/group-chat")
async def group_chat_with_idea(request: GroupChatRequest):
    print("--- GROUP CHAT ENDPOINT TRIGGERED ---")
    
    # Save the user's message first
    queries.save_chat_message_db(request.node_id, "user", request.user_message)

    async def stream_generator():
        async for result in llm_service.get_group_chat_responses(
            request.participants,
            [h.model_dump() for h in request.history],
            request.user_message,
            request.node_context,
            request.attachment_path,
            request.target_model # <-- PASS THE NEW FIELD
        ):
            # As we get a response, save it to the DB
            queries.save_chat_message_db(
                request.node_id, "model", result["response"], result["model_name"]
            )
            # Yield it to the frontend, followed by a newline separator
            yield json.dumps(result) + '\n'

    return StreamingResponse(stream_generator(), media_type="application/x-ndjson")