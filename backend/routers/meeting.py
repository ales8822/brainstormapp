from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from ..schemas import MeetingRequest, SecretaryQueryRequest, MeetingMinutesRequest
from ..services.llm_service import LLMService
from ..dependencies import get_llm_service
import asyncio
import json

router = APIRouter(prefix="/api/meetings", tags=["meetings"])

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
async def run_meeting(request: MeetingRequest, llm_service: LLMService = Depends(get_llm_service)):
    
    async def stream_generator():
        # If no user message, just acknowledge start
        if not request.user_message:
             yield json.dumps({"agent_name": "system", "response_text": f"Meeting started: {request.topic}. The board is ready for your questions."}) + "\n"
             return

        history_dicts = [{"role": h.role, "parts": h.parts} for h in request.history]
        
        for agent_name in request.agents:
            yield json.dumps({
                "agent_name": "system", 
                "response_text": f"{agent_name} is thinking...",
                "related_agent": agent_name
            }) + "\n"
            
            persona = get_persona(agent_name)
            
            try:
                response_text = await llm_service.run_meeting_turn(
                    topic=request.topic,
                    company_context=request.company_context,
                    agent_name=agent_name,
                    persona_prompt=persona,
                    history=history_dicts,
                    attachment_path=request.attachment_path,
                    user_message=request.user_message
                )
                
                yield json.dumps({"agent_name": agent_name, "response_text": response_text}) + "\n"
                
            except Exception as e:
                error_msg = f"Error from {agent_name}: {str(e)}"
                yield json.dumps({"agent_name": "system", "response_text": error_msg}) + "\n"

    return StreamingResponse(stream_generator(), media_type="application/x-ndjson")

@router.post("/minutes")
async def generate_minutes(request: MeetingMinutesRequest, llm_service: LLMService = Depends(get_llm_service)):
    try:
        minutes = await llm_service.synthesize_meeting_minutes(
            topic=request.topic,
            company_context=request.company_context,
            transcript=request.transcript
        )
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
