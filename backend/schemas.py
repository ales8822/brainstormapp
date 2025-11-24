from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime

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

class AgentConfig(BaseModel):
    """Configuration for an agent instance in a meeting"""
    name: str
    model_provider: str  # 'gemini' or 'ollama'
    model_name: str  # e.g., 'Gemini 2.0 Flash', 'qwen3', 'llama3'

class MeetingRequest(BaseModel):
    meeting_id: Optional[str] = None
    topic: str
    company_context: str
    agents: List[str]  # Keep for backward compatibility
    agent_configs: Optional[List[AgentConfig]] = []  # New: detailed configs
    attachment_path: Optional[str] = None
    user_message: Optional[str] = None
    history: List[ChatMessage] = []

class MeetingMinutesRequest(BaseModel):
    meeting_id: Optional[str] = None
    topic: str
    company_context: str
    transcript: List[Dict[str, str]]

class SecretaryQueryRequest(BaseModel):
    topic: str
    company_context: str
    minutes: str
    query: str

# --- History Models ---

class MeetingSummaryResponse(BaseModel):
    id: str
    topic: str
    start_time: datetime
    end_time: Optional[datetime]

class MeetingMessageResponse(BaseModel):
    role: str
    agent_name: Optional[str]
    content: str
    timestamp: datetime

class MeetingDetailResponse(BaseModel):
    id: str
    topic: str
    company_context: Optional[str]
    participants: List[str]
    start_time: datetime
    end_time: Optional[datetime]
    minutes_text: Optional[str]
    messages: List[MeetingMessageResponse]

class DebateSummaryRequest(BaseModel):
    topic: str
    transcript: List[Dict]
    participants: List[str]