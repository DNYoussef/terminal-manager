"""
Memory MCP & Obsidian Integration API
Endpoints for Memory Vault UI and Obsidian sync
Now with LIVE Memory MCP HTTP integration (v2.1)
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from app.services.obsidian_sync import ObsidianSyncService
from app.services.memory_scheduler import MemorySchedulerService
from app.services.memory_mcp_client import get_memory_mcp_client
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# MODELS
# ============================================================================

class ObsidianSyncRequest(BaseModel):
    """Request model for Obsidian sync"""
    vault_path: str = Field(..., description="Path to Obsidian vault")
    task_ids: Optional[List[str]] = Field(None, description="Specific task IDs to sync")


class ObsidianSyncResponse(BaseModel):
    """Response model for Obsidian sync"""
    success: bool
    synced_count: int
    vault_path: str
    message: str


class MemoryEntryResponse(BaseModel):
    """Response model for memory entry"""
    id: str
    layer: str
    task_id: str
    task_title: str
    content: str
    metadata: Dict[str, Any]
    created_at: str


# ============================================================================
# OBSIDIAN SYNC ENDPOINTS
# ============================================================================

@router.post("/memory/sync-obsidian", response_model=ObsidianSyncResponse)
async def sync_to_obsidian(request: ObsidianSyncRequest) -> ObsidianSyncResponse:
    """Sync scheduled tasks to Obsidian vault"""
    if not os.path.exists(request.vault_path):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Obsidian vault not found: {request.vault_path}"
        )

    try:
        obsidian_sync = ObsidianSyncService(request.vault_path)
        from app.routers.scheduled_tasks import tasks_db

        if request.task_ids:
            tasks_to_sync = [task for task_id, task in tasks_db.items() if task_id in request.task_ids]
        else:
            tasks_to_sync = list(tasks_db.values())

        synced_count = 0
        for task in tasks_to_sync:
            obsidian_sync.sync_task_to_obsidian(task)
            obsidian_sync.sync_memory_layers_to_obsidian(task)
            obsidian_sync.add_to_daily_note(task)
            synced_count += 1

        return ObsidianSyncResponse(
            success=True,
            synced_count=synced_count,
            vault_path=request.vault_path,
            message=f"Successfully synced {synced_count} tasks"
        )

    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Obsidian sync failed: {str(e)}")


# ============================================================================
# LIVE MEMORY MCP ENDPOINTS (v2.1)
# ============================================================================

@router.get("/memory/mcp/health")
async def memory_mcp_health() -> Dict[str, Any]:
    """Check Memory MCP server health"""
    client = get_memory_mcp_client()
    return await client.health_check()


@router.post("/memory/mcp/store")
async def memory_mcp_store(
    agent: str,
    content: str,
    project: Optional[str] = "terminal-manager",
    intent: Optional[str] = "task-management"
) -> Dict[str, Any]:
    """Store content in Memory MCP with tagging"""
    client = get_memory_mcp_client()
    return await client.store(
        agent=agent,
        content=content,
        metadata={"project": project, "intent": intent}
    )


@router.get("/memory/mcp/search")
async def memory_mcp_search(
    query: str,
    limit: int = 10,
    mode: Optional[str] = None
) -> Dict[str, Any]:
    """Semantic search via Memory MCP with mode-aware configuration"""
    client = get_memory_mcp_client()
    results = await client.search(query=query, limit=limit, mode=mode)
    return {
        "query": query,
        "mode": mode or client._detect_mode(query),
        "results": results,
        "count": len(results)
    }


@router.get("/memory/analytics")
async def get_memory_analytics() -> Dict[str, Any]:
    """Get Memory MCP analytics"""
    memory_scheduler = MemorySchedulerService()
    analytics = await memory_scheduler.get_task_analytics()
    
    from app.routers.scheduled_tasks import tasks_db
    analytics["total_memories"] = len(tasks_db) * 3
    analytics["layers"] = {
        "procedural": len(tasks_db),
        "episodic": len(tasks_db),
        "semantic": len(tasks_db)
    }
    
    return analytics
