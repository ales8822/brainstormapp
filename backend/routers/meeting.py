from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from ..schemas import MeetingRequest, SecretaryQueryRequest, MeetingMinutesRequest, MeetingSummaryResponse, MeetingDetailResponse
from ..services.llm_service import LLMService
from ..dependencies import get_llm_service
from ..data_access.connection import get_db_connection
from ..repositories.meeting_repository import MeetingRepository
import asyncio
import json
import uuid
import aiosqlite
from typing import List

router = APIRouter(prefix="/api/meetings", tags=["meetings"])

# Dependency for MeetingRepository
async def get_meeting_repo(db: aiosqlite.Connection = Depends(get_db_connection)):
    return MeetingRepository(db)

# Hardcoded personas for now
PERSONAS = {
    "CEO": "You are the CEO. You are visionary, decisive, and focused on the big picture and long-term growth.",
    "CFO": "You are the CFO. You are cautious, analytical, and focused on financial stability, ROI, and risk mitigation.",
    "CTO": "You are the CTO. You are innovative, technical, and focused on leveraging new technologies and engineering excellence.",
    "CMO": "You are the CMO. You are creative, customer-centric, and focused on brand awareness, market share, and user acquisition.",
    "Product": "You are the VP of Product. You are user-focused, pragmatic, and concerned with feature prioritization and user experience.",
    "Sales": "You are the VP of Sales. You are aggressive, revenue-focused, and concerned with closing deals and meeting quotas.",
    "Gemini": "You are a highly intelligent, versatile AI assistant. You provide balanced, comprehensive, and logical perspectives.",
    "Llama": "You are an open-source AI advocate. You value transparency, efficiency, and community-driven solutions."
}

def get_persona(agent_name: str) -> str:
    # Simple matching logic
    for key, prompt in PERSONAS.items():
        if key.lower() in agent_name.lower():
            return prompt
    return "You are a helpful AI board member. Provide constructive input."

@router.post("/run")
async def run_meeting(
    request: MeetingRequest, 
    llm_service: LLMService = Depends(get_llm_service),
    meeting_repo: MeetingRepository = Depends(get_meeting_repo)
):
    
    async def stream_generator():
        meeting_id = request.meeting_id
        
        # If no meeting_id, create a new meeting
        if not meeting_id:
            meeting_id = str(uuid.uuid4())
            await meeting_repo.create_meeting(
                meeting_id, request.topic, request.company_context, request.agents
            )
            # Send meeting_id to frontend
            yield json.dumps({"type": "meta", "meeting_id": meeting_id}) + "\n"
        
        # If no user message, just acknowledge start
        if not request.user_message:
             yield json.dumps({"agent_name": "system", "response_text": f"Meeting started: {request.topic}. The board is ready for your questions."}) + "\n"
             return

        # Save user message
        await meeting_repo.add_message(meeting_id, "user", "User", request.user_message)

        history_dicts = [{"role": h.role, "parts": h.parts} for h in request.history]
        
        # Import AgentRepository
        from ..repositories.agent_repository import AgentRepository
        agent_repo = AgentRepository(meeting_repo.db)
        
        # Use agent_configs if provided, otherwise fall back to agents list
        agent_configs = request.agent_configs if request.agent_configs else [
            {"name": name, "model_provider": "gemini", "model_name": "Gemini 2.0 Flash"} 
            for name in request.agents
        ]
        
        for agent_config in agent_configs:
            agent_name = agent_config.name if hasattr(agent_config, 'name') else agent_config['name']
            model_provider = agent_config.model_provider if hasattr(agent_config, 'model_provider') else agent_config['model_provider']
            model_name = agent_config.model_name if hasattr(agent_config, 'model_name') else agent_config['model_name']
            
            yield json.dumps({
                "agent_name": "system", 
                "response_text": f"{agent_name} is thinking...",
                "related_agent": agent_name
            }) + "\n"
            
            # Fetch custom agent from database
            agent_data = await agent_repo.get_agent_by_name(agent_name)
            
            if agent_data:
                persona = agent_data['system_instructions']
            else:
                # Fallback if agent not found
                persona = f"You are {agent_name}, a helpful AI board member. Provide constructive input."
            
            try:
                response_text = await llm_service.run_meeting_turn(
                    topic=request.topic,
                    company_context=request.company_context,
                    agent_name=agent_name,
                    persona_prompt=persona,
                    history=history_dicts,
                    attachment_path=request.attachment_path,
                    user_message=request.user_message,
                    model_provider=model_provider,
                    model_name=model_name  # Pass specific model name
                )
                
                # Save agent response
                await meeting_repo.add_message(meeting_id, "model", agent_name, response_text)
                
                yield json.dumps({"agent_name": agent_name, "response_text": response_text}) + "\n"
                
            except Exception as e:
                error_msg = f"Error from {agent_name}: {str(e)}"
                yield json.dumps({"agent_name": "system", "response_text": error_msg}) + "\n"

    return StreamingResponse(stream_generator(), media_type="application/x-ndjson")

@router.post("/minutes")
async def generate_minutes(
    request: MeetingMinutesRequest, 
    llm_service: LLMService = Depends(get_llm_service),
    meeting_repo: MeetingRepository = Depends(get_meeting_repo)
):
    try:
        minutes = await llm_service.synthesize_meeting_minutes(
            topic=request.topic,
            company_context=request.company_context,
            transcript=request.transcript
        )
        
        if request.meeting_id:
            await meeting_repo.update_minutes(request.meeting_id, minutes)
            
        return {"minutes": minutes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/query-secretary")
async def query_secretary(request: SecretaryQueryRequest, llm_service: LLMService = Depends(get_llm_service)):
    """
    Answer follow-up questions about the meeting minutes.
    """
    try:
        response = await llm_service.query_secretary(
            topic=request.topic,
            company_context=request.company_context,
            minutes=request.minutes,
            query=request.query
        )
        
        return {"response": response}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history", response_model=List[MeetingSummaryResponse])
async def get_meeting_history(meeting_repo: MeetingRepository = Depends(get_meeting_repo)):
    try:
        return await meeting_repo.get_all_meetings()
    except Exception as e:
        print(f"ERROR fetching history: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.get("/history/{meeting_id}", response_model=MeetingDetailResponse)
async def get_meeting_detail(meeting_id: str, meeting_repo: MeetingRepository = Depends(get_meeting_repo)):
    meeting = await meeting_repo.get_meeting_details(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting
