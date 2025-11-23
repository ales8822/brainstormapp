from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import aiosqlite

from ..data_access.connection import get_db_connection
from ..repositories.agent_repository import AgentRepository

router = APIRouter(prefix="/api/agents", tags=["agents"])

# Dependency for AgentRepository
async def get_agent_repo(db: aiosqlite.Connection = Depends(get_db_connection)):
    return AgentRepository(db)

# Pydantic Models
class AgentCreateRequest(BaseModel):
    name: str
    role: str
    system_instructions: str
    model_provider: str  # 'gemini' or 'ollama'
    avatar_color: Optional[str] = "#3498db"

class AgentUpdateRequest(BaseModel):
    name: str
    role: str
    system_instructions: str
    model_provider: str
    avatar_color: str

class AgentResponse(BaseModel):
    id: str
    name: str
    role: str
    system_instructions: str
    model_provider: str
    avatar_color: str
    created_at: datetime

# Endpoints
@router.get("", response_model=List[AgentResponse])
async def get_all_agents(agent_repo: AgentRepository = Depends(get_agent_repo)):
    """Get all custom agents."""
    try:
        return await agent_repo.get_all_agents()
    except Exception as e:
        print(f"ERROR fetching agents: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: str, agent_repo: AgentRepository = Depends(get_agent_repo)):
    """Get a specific agent by ID."""
    agent = await agent_repo.get_agent_by_id(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent

@router.post("", response_model=AgentResponse)
async def create_agent(
    request: AgentCreateRequest,
    agent_repo: AgentRepository = Depends(get_agent_repo)
):
    """Create a new custom agent."""
    # Validate system_instructions is not empty
    if not request.system_instructions.strip():
        raise HTTPException(status_code=400, detail="System instructions cannot be empty")
    
    # Check if name already exists
    existing = await agent_repo.get_agent_by_name(request.name)
    if existing:
        raise HTTPException(status_code=400, detail=f"Agent with name '{request.name}' already exists")
    
    try:
        agent_id = await agent_repo.create_agent(
            name=request.name,
            role=request.role,
            system_instructions=request.system_instructions,
            model_provider=request.model_provider,
            avatar_color=request.avatar_color
        )
        
        # Fetch and return the created agent
        agent = await agent_repo.get_agent_by_id(agent_id)
        return agent
    except Exception as e:
        print(f"ERROR creating agent: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: str,
    request: AgentUpdateRequest,
    agent_repo: AgentRepository = Depends(get_agent_repo)
):
    """Update an existing agent."""
    # Validate system_instructions is not empty
    if not request.system_instructions.strip():
        raise HTTPException(status_code=400, detail="System instructions cannot be empty")
    
    # Check if agent exists
    existing = await agent_repo.get_agent_by_id(agent_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Check if new name conflicts with another agent
    if request.name != existing['name']:
        name_conflict = await agent_repo.get_agent_by_name(request.name)
        if name_conflict:
            raise HTTPException(status_code=400, detail=f"Agent with name '{request.name}' already exists")
    
    try:
        success = await agent_repo.update_agent(
            agent_id=agent_id,
            name=request.name,
            role=request.role,
            system_instructions=request.system_instructions,
            model_provider=request.model_provider,
            avatar_color=request.avatar_color
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Fetch and return the updated agent
        agent = await agent_repo.get_agent_by_id(agent_id)
        return agent
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR updating agent: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.delete("/{agent_id}")
async def delete_agent(agent_id: str, agent_repo: AgentRepository = Depends(get_agent_repo)):
    """Delete an agent."""
    try:
        success = await agent_repo.delete_agent(agent_id)
        if not success:
            raise HTTPException(status_code=404, detail="Agent not found")
        return {"message": "Agent deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR deleting agent: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
