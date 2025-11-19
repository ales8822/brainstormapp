# backend/services/graph_service.py (FULLY CORRECTED)

from typing import List, Dict, Tuple
import uuid

from ..repositories.graph_repository import GraphRepository
from ..schemas import BrainstormRequest, SimpleNodeRequest,PromoteNodeRequest, CreateEdgeRequest
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

    async def create_simple_node(self, request: SimpleNodeRequest) -> Dict:
        """
        Orchestrates the creation of a single user node.
        """
        node_id = f"node-user-{uuid.uuid4()}"
        await self.graph_repo.create_simple_node(node_id, request.label)
        
        # Return a dictionary representing the new node's data
        return {
            "id": node_id,
            "label": request.label,
            "fullText": request.label,
            "status": "Idea",  # Default status
            "generated_by": None,
            "attachment_path": None,
            "is_ai_node": False
        }

    async def get_workspace_elements(self, workspace_id: str) -> Tuple[List[Dict], List[Dict]]:
        """Fetches all nodes and edges for a given workspace."""
        nodes = await self.graph_repo.get_workspace_nodes(workspace_id)
        edges = await self.graph_repo.get_workspace_edges(workspace_id)
        return nodes, edges
    
    async def promote_message_to_node(self, request: PromoteNodeRequest) -> Dict:
        """
        Orchestrates creating a node within a workspace.
        """
        new_node_id = f"node-user-{uuid.uuid4()}"
        
        # --- UPDATE this call to the new repository method ---
        await self.graph_repo.create_workspace_node(
            new_node_id=new_node_id,
            workspace_id=request.parent_node_id, # This is now the workspace ID
            label=request.label,
            full_text=request.full_text
        )

        # --- SIMPLIFY the return object ---
        return {
            "id": new_node_id,
            "label": request.label,
            "fullText": request.full_text,
            "status": "Idea",
            "generated_by": None,
            "attachment_path": None,
            "is_ai_node": False,
        }


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
    
    async def create_edge(self, request: CreateEdgeRequest) -> None:
        """Orchestrates creating a new edge."""
        await self.graph_repo.create_edge(request.source, request.target, request.label)