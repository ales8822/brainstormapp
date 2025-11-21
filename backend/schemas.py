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
    attachment_path: Optional[str] = Field(None, alias="attachmentPath")

class GroupChatRequest(BaseModel):
    node_id: str = Field(..., alias="nodeId")
    node_context: str = Field(..., alias="nodeContext")
    attachment_path: Optional[str] = Field(None, alias="attachmentPath")
    history: List[ChatMessage]
    user_message: str = Field(..., alias="userMessage")
    participants: List[str] # The list of model names to query
    target_model: Optional[str] = Field(None, alias="targetModel") 

class SimpleNodeRequest(BaseModel):
    label: str

class PromoteNodeRequest(BaseModel):
    parent_node_id: str
    label: str
    full_text: str
    attachment_path: Optional[str] = None

class CreateEdgeRequest(BaseModel):
    source: str
    target: str
    label: Optional[str] = None

class DeleteEdgeRequest(BaseModel):
    source: str
    target: str

class NodeContentUpdateRequest(BaseModel):
    full_text: str

class MeetingRequest(BaseModel):
    topic: str
    company_context: str
    agents: List[str]