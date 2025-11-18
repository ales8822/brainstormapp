# backend/routers/chat.py

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
import json

from ..schemas import ChatRequest, GroupChatRequest
from ..services.chat_service import ChatService
from ..dependencies import get_chat_service

router = APIRouter(prefix="/api", tags=["chat"])

@router.get("/nodes/{node_id}/chat")
async def get_chat_history(
    node_id: str,
    chat_service: ChatService = Depends(get_chat_service)
):
    history_res = await chat_service.get_chat_history(node_id)
    return [{"role": row['role'], "parts": [row['content']], "generated_by": row['generated_by']} for row in history_res]


@router.post("/chat")
async def chat_with_idea(
    request: ChatRequest,
    chat_service: ChatService = Depends(get_chat_service)
):
    # This endpoint is less critical, but we'll keep it async
    try:
        temp_request = GroupChatRequest(
            nodeId=request.node_id,
            nodeContext=request.node_context,
            history=request.history,
            userMessage=request.user_message,
            participants=['gemini-2.0-flash'],
            attachmentPath=None
        )
        llm_response = await chat_service.get_single_chat_response_and_save(temp_request)
        return {"response": llm_response["response"], "model_name": llm_response["model_name"]}
    except Exception as e:
        print(f"Error in single chat: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected server error occurred: {str(e)}")

    
@router.post("/group-chat")
async def group_chat_with_idea(
    request: GroupChatRequest,
    chat_service: ChatService = Depends(get_chat_service)
):
    print("--- GROUP CHAT ENDPOINT TRIGGERED ---")

    # --- FIX 1 IMPLEMENTED HERE ---
    # 1. Save the user's message BEFORE starting the stream.
    await chat_service.save_user_message(request.node_id, request.user_message)

    # 2. Define the generator that will get and save AI responses.
    async def stream_generator():
        # This service method now handles getting, saving, and yielding AI responses safely.
        async for result in chat_service.get_and_save_group_chat_responses(request):
            yield json.dumps(result) + '\n'

    # 3. Return the StreamingResponse.
    return StreamingResponse(stream_generator(), media_type="application/x-ndjson")