# backend/services/chat_service.py

from typing import List, Dict, Optional, AsyncGenerator

from ..repositories.chat_repository import ChatRepository
from ..schemas import ChatMessage, GroupChatRequest
from .llm_service import LLMService

class ChatService:
    def __init__(self, chat_repo: ChatRepository, llm_service: LLMService):
        self.chat_repo = chat_repo
        self.llm_service = llm_service

    async def get_chat_history(self, node_id: str) -> List[Dict]:
        return await self.chat_repo.get_history(node_id)
    
    async def save_user_message(self, node_id: str, content: str):
        await self.chat_repo.save_message(node_id, role="user", content=content)

    async def save_ai_message(self, node_id: str, content: str, model_name: str):
        await self.chat_repo.save_message(node_id, role="assistant", content=content, model_name=model_name)
    
    # This method now ONLY gets responses and saves them. The router handles user message.
    async def get_and_save_group_chat_responses(self, request: GroupChatRequest) -> AsyncGenerator[Dict, None]:
        """
        Gets streaming AI responses, saves each one, and yields it back.
        """
        async for llm_result in self.llm_service.get_group_chat_responses(
            participants=request.participants,
            history=[h.model_dump() for h in request.history],
            user_message=request.user_message,
            node_context=request.node_context,
            attachment_path=request.attachment_path,
            target_model=request.target_model
        ):
            # Save each AI response as it arrives. This is now safe.
            await self.save_ai_message(
                node_id=request.node_id, 
                content=llm_result["response"], 
                model_name=llm_result["model_name"]
            )
            # Yield the result back to the router for streaming to the client
            yield llm_result

    # You can refactor the single chat later, but for now it's separate
    async def get_single_chat_response_and_save(self, request: GroupChatRequest) -> dict:
        await self.save_user_message(request.node_id, request.user_message)
        llm_response = await self.llm_service.get_chat_response(
            history=[h.model_dump() for h in request.history],
            user_message=request.user_message,
            node_context=request.node_context,
            attachment_path=request.attachment_path
        )
        await self.save_ai_message(
            node_id=request.node_id, 
            content=llm_response["response"], 
            model_name=llm_response["model_name"]
        )
        return llm_response