# backend/services/graph_service.py (FULLY CORRECTED)

from typing import List, Dict, Tuple
import uuid

from ..repositories.graph_repository import GraphRepository
from ..schemas import BrainstormRequest
from .llm_service import LLMService

class GraphService:
    """
    Handles all business logic for the graph structure (nodes, edges, status updates).
    """
    def __init__(self, graph_repo: GraphRepository, llm_service: LLMService):
        self.graph_repo = graph_repo
        self.llm_service = llm_service

    async def get_full_graph(self) -> Tuple[List[Dict], List[Dict]]:
        """Fetches all nodes and edges from the repo."""
        return await self.graph_repo.get_full_graph()
    
    async def update_node_status(self, node_id: str, status: str):
        """Updates the status of a specific node."""
        await self.graph_repo.update_node_status(node_id, status)

    async def delete_node_branch(self, node_id: str):
        """Deletes a node and all its descendants."""
        await self.graph_repo.delete_branch(node_id)

    async def generate_new_idea_branch(self, request: BrainstormRequest) -> Dict:
        """
        Orchestrates the creation of a new idea branch:
        1. Calls the LLMService to get the idea content.
        2. Calls the GraphRepository to save the new node(s) and edge.
        """
        
        llm_result = await self.llm_service.get_brainstorm_response(
            prompt=request.prompt,
            context=request.parent_context,
            attachment_path=request.attachment_path
        )
        
        ai_data = llm_result["response"]
        model_name = llm_result["model_name"]

        source_id = request.source_node_id

        # --- CRITICAL FIX: Change the condition to correctly identify a new branch ---
        # If there is parent context, we are extending. Otherwise, we are creating.
        if request.parent_context and source_id:
            # This is extending an existing idea. The source_id node already exists.
            ai_node_id = await self.graph_repo.extend_idea_branch(
                source_node_id=source_id,
                user_prompt=request.prompt,
                ai_data=ai_data,
                model_name=model_name
            )
        else:
            # This is a new root idea. The source_id is temporary and needs to be created.
            # If the client didn't send an ID, create one.
            if not source_id:
                source_id = f"node-user-{uuid.uuid4()}" 
                
            ai_node_id = await self.graph_repo.create_new_idea_branch(
                source_node_id=source_id,
                user_prompt=request.prompt,
                ai_data=ai_data,
                model_name=model_name,
                attachment_path=request.attachment_path
            )

        return {
            "source_node_id": source_id, 
            "ai_node_id": ai_node_id, 
            "model_name": model_name,
            "ai_data": ai_data
        }