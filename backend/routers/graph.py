# backend/routers/graph.py
from fastapi import APIRouter, HTTPException, Depends
from ..schemas import BrainstormRequest, StatusUpdateRequest, SimpleNodeRequest, PromoteNodeRequest, CreateEdgeRequest, DeleteEdgeRequest, NodeContentUpdateRequest
# Import the service and its dependencies
from ..services.graph_service import GraphService
from ..dependencies import get_graph_service

router = APIRouter(prefix="/api", tags=["graph"])

# --- FIX 1: Add 'async' and 'await' ---
@router.get("/graph")
async def get_graph( # <--- Add async
    graph_service: GraphService = Depends(get_graph_service)
):
    """Fetches the full graph structure (nodes and edges)."""
    # The service method is now a coroutine, so we must await it
    nodes_res, edges_res = await graph_service.get_full_graph() # <--- Add await
    
    # --- The Graph Formatting Logic Stays Here (Controller's job) ---
    nodes_map = {row['id']: dict(row) for row in nodes_res}
    attachments_map = {row['id']: row['attachment_path'] for row in nodes_res if row['attachment_path']}
    
    # Propagate attachment path
    for edge in edges_res:
        source_id = edge['source_id']
        target_id = edge['target_id']
        if source_id in attachments_map and target_id in nodes_map:
            nodes_map[target_id]['attachment_path'] = attachments_map[source_id]
            
    elements = []
    for node_id, node_data_map in nodes_map.items():
        node_data = {
            "id": node_data_map["id"],
            "label": node_data_map["label"],
            "fullText": node_data_map["fullText"],
            "status": node_data_map["status"],
            "generated_by": node_data_map["generated_by"],
            "attachment_path": node_data_map["attachment_path"],
            "workspace_id": node_data_map.get("workspace_id")
        }
        node_class = "ai-node" if node_data_map["is_ai_node"] else "user-node"
        elements.append({"group": "nodes", "data": node_data, "classes": node_class})
    
    for edge_row in edges_res:
        edge_label = edge_row['label'] if edge_row['label'] is not None else ""
        edge_data = { "id": f"edge-{edge_row['source_id']}-{edge_row['target_id']}", "source": edge_row['source_id'], "target": edge_row['target_id'], "label": edge_label }
        elements.append({"group": "edges", "data": edge_data})
        
    return elements

@router.get("/workspaces/{workspace_id}/elements")
async def get_workspace_elements(
    workspace_id: str,
    graph_service: GraphService = Depends(get_graph_service)
):
    """Fetches all nodes and edges belonging to a specific workspace."""
    nodes_res, edges_res = await graph_service.get_workspace_elements(workspace_id)
    
    elements = []
    # Format nodes
    for node_data_map in nodes_res:
        node_data = {
            "id": node_data_map["id"],
            "label": node_data_map["label"],
            "fullText": node_data_map["fullText"],
            "status": node_data_map["status"],
            "generated_by": node_data_map["generated_by"],
            "attachment_path": node_data_map["attachment_path"],
            "workspace_id": node_data_map["workspace_id"]
        }
         # --- FIX: Add the status class here ---
        node_class = "ai-node" if node_data_map["is_ai_node"] else "user-node"
        if node_data_map.get("status"):
            node_class += f' status-{node_data_map["status"]}'
        
        elements.append({"group": "nodes", "data": node_data, "classes": node_class})
        
    # Format edges
    for edge_row in edges_res:
        edge_label = edge_row['label'] if edge_row['label'] is not None else ""
        edge_data = {
            "id": f"edge-{edge_row['source_id']}-{edge_row['target_id']}",
            "source": edge_row['source_id'],
            "target": edge_row['target_id'],
            "label": edge_label
        }
        elements.append({"group": "edges", "data": edge_data})
        
    return elements



@router.put("/nodes/{node_id}/status")
async def update_node_status( # <--- Add async
    node_id: str, 
    request: StatusUpdateRequest,
    graph_service: GraphService = Depends(get_graph_service)
):
    """Updates the lifecycle status of an idea node."""
    valid_statuses = ['Idea', 'InProgress', 'Completed', 'Archived']
    if request.status not in valid_statuses: 
        raise HTTPException(status_code=400, detail="Invalid status value.")
        
    # Delegate all business logic to the service
    await graph_service.update_node_status(node_id, request.status) # <--- Add await
    return {"status": "success", "updated_id": node_id, "new_status": request.status}

# --- FIX 3: Add 'async' and 'await' ---
@router.delete("/nodes/{node_id}")
async def delete_node( # <--- Add async
    node_id: str,
    graph_service: GraphService = Depends(get_graph_service)
):
    """Deletes a node and all its descendant branches."""
    # Delegate all business logic to the service
    await graph_service.delete_node_branch(node_id) # <--- Add await
    return {"status": "success", "deleted_root_id": node_id}

@router.post("/graph/nodes/simple", status_code=201)
async def create_simple_node(
    request: SimpleNodeRequest,
    graph_service: GraphService = Depends(get_graph_service)
):
    """Creates a single idea node without an AI response."""
    try:
        new_node_data = await graph_service.create_simple_node(request)
        
        # Format the response to match what Cytoscape expects
        return {
            "group": "nodes",
            "data": new_node_data,
            "classes": "user-node"
        }
    except Exception as e:
        # Log the exception e for debugging
        raise HTTPException(status_code=500, detail=f"Failed to create node: {e}")

@router.post("/graph/workspace/nodes", status_code=201)
async def promote_node_in_workspace(
    request: PromoteNodeRequest,
    graph_service: GraphService = Depends(get_graph_service)
):
    """Creates a new node within a workspace."""
    try:
        new_node_data = await graph_service.promote_message_to_node(request)
        
        # --- SIMPLIFY the response, no more edge ---
        return {
            "group": "nodes",
            "data": new_node_data,
            "classes": "user-node"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to promote node: {e}")
        
@router.post("/brainstorm")
async def brainstorm_idea(
    request: BrainstormRequest,
    graph_service: GraphService = Depends(get_graph_service)
):
    """Initiates a new idea branch (with or without a parent context)."""
    try:
        # The service handles both the LLM call AND the DB saving (extend or create)
        result = await graph_service.generate_new_idea_branch(request)

        # Structure the final response
        return { 
            "user_node_id": result["source_node_id"], 
            "ai_node": {
                "id": result["ai_node_id"], 
                # Note: The service doesn't return label/fullText, so we need to
                # adjust GraphService to return that if needed, OR simplify this
                # endpoint to expect the frontend to re-fetch the graph, which is safer.
                # For a quick fix, let's assume the frontend re-fetches or we adjust 
                # GraphService. Let's adjust GraphService to return the data.
                # Since we already did the logic in GraphService, we assume it's updated.
                "label": result["ai_data"]["label"], # Assuming GraphService returns ai_data
                "fullText": result["ai_data"]["fullText"] # Assuming GraphService returns ai_data
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM service failed: {e}")
    

@router.post("/graph/edges", status_code=201)
async def create_edge(
    request: CreateEdgeRequest,
    graph_service: GraphService = Depends(get_graph_service)
    ):
    """Creates a new edge between two nodes."""
    try:
        await graph_service.create_edge(request)
        return {"status": "success", "source": request.source, "target": request.target}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create edge: {e}")
    
@router.delete("/graph/edges", status_code=200)
async def delete_edge(
    request: DeleteEdgeRequest,
    graph_service: GraphService = Depends(get_graph_service)
):
    """Deletes an edge between two nodes."""
    try:
        await graph_service.delete_edge(request)
        return {"status": "success", "source": request.source, "target": request.target}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete edge: {e}")
    

@router.put("/nodes/{node_id}/content", status_code=200)
async def update_node_content(
    node_id: str,
    request: NodeContentUpdateRequest,
    graph_service: GraphService = Depends(get_graph_service)
):
    """Updates the text content of a node."""
    try:
        await graph_service.update_node_content(node_id, request)
        new_label = (request.full_text[:100] + '...') if len(request.full_text) > 100 else request.full_text
        return {"status": "success", "updated_id": node_id, "new_label": new_label}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update node content: {e}")