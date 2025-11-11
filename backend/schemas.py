# backend/schemas.py

from pydantic import BaseModel, Field
from typing import Optional, List

class BrainstormRequest(BaseModel):
    prompt: str
    parent_context: Optional[str] = None
    source_node_id: Optional[str] = None
    attachment_path: Optional[str] = None

class StatusUpdateRequest(BaseModel):
    status: str

class ChatMessage(BaseModel):
    role: str
    parts: List[str]

class ChatRequest(BaseModel):
    node_id: str = Field(..., alias="nodeId")
    node_context: str = Field(..., alias="nodeContext")
    history: List[ChatMessage]
    user_message: str = Field(..., alias="userMessage")