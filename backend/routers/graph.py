# backend/routers/graph.py

from fastapi import APIRouter, HTTPException
from ..schemas import BrainstormRequest, StatusUpdateRequest
from ..services.llm_service import llm_service
from ..database import queries
import uuid

router = APIRouter(prefix="/api", tags=["graph"])

@router.get("/graph")
def get_graph():
    nodes_res, edges_res = queries.get_full_graph_db()
    
    # --- THE FIX ---
    # Create maps to easily look up nodes and attachments
    nodes_map = {row['id']: dict(row) for row in nodes_res}
    attachments_map = {row['id']: row['attachment_path'] for row in nodes_res if row['attachment_path']}
    
    # Propagate attachment path from source to target
    for edge in edges_res:
        source_id = edge['source_id']
        target_id = edge['target_id']
        # If the source node has an attachment and the target node is its direct child,
        # give the target node the same attachment path for display purposes.
        if source_id in attachments_map and target_id in nodes_map:
            nodes_map[target_id]['attachment_path'] = attachments_map[source_id]
    # --- END OF FIX ---
            
    elements = []
    for node_id, node_data_map in nodes_map.items():
        node_data = {
            "id": node_data_map["id"],
            "label": node_data_map["label"],
            "fullText": node_data_map["fullText"],
            "status": node_data_map["status"],
            "generated_by": node_data_map["generated_by"],
            "attachment_path": node_data_map["attachment_path"] # This is now correctly populated
        }
        node_class = "ai-node" if node_data_map["is_ai_node"] else "user-node"
        elements.append({"group": "nodes", "data": node_data, "classes": node_class})
    
    for edge_row in edges_res:
        edge_label = edge_row['label'] if edge_row['label'] is not None else ""
        edge_data = { "id": f"edge-{edge_row['source_id']}-{edge_row['target_id']}", "source": edge_row['source_id'], "target": edge_row['target_id'], "label": edge_label }
        elements.append({"group": "edges", "data": edge_data})
        
    return elements

@router.put("/nodes/{node_id}/status")
def update_node_status(node_id: str, request: StatusUpdateRequest):
    # (This function is unchanged)
    valid_statuses = ['Idea', 'InProgress', 'Completed', 'Archived']
    if request.status not in valid_statuses: raise HTTPException(status_code=400, detail="Invalid status value.")
    queries.update_node_status_db(node_id, request.status)
    return {"status": "success", "updated_id": node_id, "new_status": request.status}

@router.delete("/nodes/{node_id}")
def delete_node(node_id: str):
    # (This function is unchanged)
    queries.delete_branch_db(node_id)
    return {"status": "success", "deleted_root_id": node_id}


# --- THIS IS THE CORRECTED ENDPOINT ---
@router.post("/brainstorm")
async def brainstorm_idea(request: BrainstormRequest):
    try:
        # Pass attachment_path to the service
        result = llm_service.get_brainstorm_response(
            request.prompt, 
            request.parent_context,
            request.attachment_path
        )
        ai_response_data = result["response"]
        model_name_used = result["model_name"]
        
        source_node_id = request.source_node_id
        if request.parent_context and source_node_id:
            # Child nodes don't get attachments
            ai_node_id = queries.extend_idea_branch_db(source_node_id, request.prompt, ai_response_data, model_name_used)
        else:
            # Pass attachment_path to the DB query for the new root node
            ai_node_id = queries.create_new_idea_branch_db(source_node_id, request.prompt, ai_response_data, model_name_used, request.attachment_path)
        
        return { "user_node_id": source_node_id, "ai_node": {"id": ai_node_id, "label": ai_response_data["label"], "fullText": ai_response_data["fullText"]},}

    except ValueError as e:
        # --- THE FIX: Raise HTTPException for config errors ---
        print(f"Handled configuration error: {e}")
        raise HTTPException(status_code=400, detail=str(e)) # 400 is "Bad Request"
    except Exception as e:
        print(f"Error in LLM service call: {e}")
        raise HTTPException(status_code=500, detail=f"LLM service failed: {e}")