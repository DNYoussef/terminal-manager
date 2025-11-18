"""
Memory MCP & Obsidian Integration API
Endpoints for Memory Vault UI and Obsidian sync
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from app.services.obsidian_sync import ObsidianSyncService
from app.services.memory_scheduler import MemorySchedulerService
import os

router = APIRouter()


# ============================================================================
# MODELS
# ============================================================================

class ObsidianSyncRequest(BaseModel):
    """Request model for Obsidian sync"""
    vault_path: str = Field(..., description="Path to Obsidian vault")
    task_ids: Optional[List[str]] = Field(None, description="Specific task IDs to sync (None = all)")


class ObsidianSyncResponse(BaseModel):
    """Response model for Obsidian sync"""
    success: bool
    synced_count: int
    vault_path: str
    message: str


class MemoryLayerQuery(BaseModel):
    """Query model for memory layer (time-based retention)"""
    layer: str = Field(..., pattern="^(short-term|mid-term|long-term)$")
    task_id: Optional[str] = None
    limit: int = Field(default=50, le=500)


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
# IN-MEMORY STORAGE (TODO: Replace with Memory MCP actual integration)
# ============================================================================

memory_entries_db: List[Dict[str, Any]] = []


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/memory/sync-obsidian", response_model=ObsidianSyncResponse)
async def sync_to_obsidian(request: ObsidianSyncRequest) -> ObsidianSyncResponse:
    """
    Sync scheduled tasks to Obsidian vault

    Creates markdown notes for:
    - Tasks (in /Tasks/{status}/)
    - Memory layers (in /Memory/{layer}/)
    - Daily notes references

    Args:
        request: Sync configuration

    Returns:
        Sync result

    Raises:
        HTTPException: 400 if vault path invalid
    """
    # Validate vault path
    if not os.path.exists(request.vault_path):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Obsidian vault not found: {request.vault_path}"
        )

    try:
        # Initialize Obsidian sync service
        obsidian_sync = ObsidianSyncService(request.vault_path)

        # Get tasks to sync
        # In production, fetch from Memory MCP or database
        from app.routers.scheduled_tasks import tasks_db

        if request.task_ids:
            tasks_to_sync = [
                task for task_id, task in tasks_db.items()
                if task_id in request.task_ids
            ]
        else:
            tasks_to_sync = list(tasks_db.values())

        # Sync each task
        synced_count = 0
        for task in tasks_to_sync:
            # Create main task note
            obsidian_sync.sync_task_to_obsidian(task)

            # Create memory layer notes
            obsidian_sync.sync_memory_layers_to_obsidian(task)

            # Add to daily note
            obsidian_sync.add_to_daily_note(task)

            synced_count += 1

        return ObsidianSyncResponse(
            success=True,
            synced_count=synced_count,
            vault_path=request.vault_path,
            message=f"Successfully synced {synced_count} tasks to Obsidian vault"
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Obsidian sync failed: {str(e)}"
        )


@router.post("/memory/sync-from-obsidian")
async def sync_from_obsidian(vault_path: str) -> Dict[str, Any]:
    """
    Sync changes from Obsidian vault back to Memory MCP

    Watches vault for modifications and updates Memory MCP

    Args:
        vault_path: Path to Obsidian vault

    Returns:
        Sync result with modified tasks
    """
    try:
        obsidian_sync = ObsidianSyncService(vault_path)

        # Watch for vault changes
        modified_tasks = obsidian_sync.watch_vault_changes()

        # Update Memory MCP
        # In production, call Memory MCP to update

        return {
            "success": True,
            "modified_count": len(modified_tasks),
            "modified_tasks": modified_tasks
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Obsidian import failed: {str(e)}"
        )


@router.get("/memory/layers/{layer}", response_model=List[MemoryEntryResponse])
async def get_memory_layer(
    layer: str,
    task_id: Optional[str] = None,
    limit: int = 50
) -> List[MemoryEntryResponse]:
    """
    Fetch memories from specific retention layer

    Args:
        layer: Retention layer (short-term, mid-term, long-term)
        task_id: Optional filter by task ID
        limit: Max results

    Returns:
        List of memory entries
    """
    # Validate layer
    if layer not in ["short-term", "mid-term", "long-term"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Layer must be: short-term, mid-term, or long-term"
        )

    # In production, query Memory MCP
    # For now, return simulated data from tasks
    from app.routers.scheduled_tasks import tasks_db

    entries = []
    for task_id_key, task in list(tasks_db.items())[:limit]:
        if task_id and task_id_key != task_id:
            continue

        memory_ref = task.get("memory_refs", {}).get(layer, {})

        entry = {
            "id": f"mem_{task_id_key}_{layer}",
            "layer": layer,
            "task_id": task_id_key,
            "task_title": task.get("title", "Unknown"),
            "content": memory_ref.get("content", "No content"),
            "metadata": memory_ref.get("metadata", {}),
            "created_at": str(task.get("created_at", ""))
        }

        entries.append(entry)

    return entries


@router.get("/memory/search")
async def search_memory(
    query: str,
    layer: Optional[str] = None,
    limit: int = 10
) -> List[MemoryEntryResponse]:
    """
    Semantic search across memory layers

    Uses Memory MCP Layer 3 (Semantic) vector search

    Args:
        query: Natural language search query
        layer: Optional layer filter
        limit: Max results

    Returns:
        Matching memory entries
    """
    # In production, call Memory MCP vector_search
    # For now, simple text matching
    from app.routers.scheduled_tasks import tasks_db

    results = []
    query_lower = query.lower()

    for task_id_key, task in list(tasks_db.items())[:limit]:
        title = task.get("title", "").lower()
        description = task.get("description", "").lower()

        if query_lower in title or query_lower in description:
            # Return semantic layer content
            memory_ref = task.get("memory_refs", {}).get("semantic", {})

            result = {
                "id": f"mem_{task_id_key}_semantic",
                "layer": "semantic",
                "task_id": task_id_key,
                "task_title": task.get("title", "Unknown"),
                "content": memory_ref.get("content", ""),
                "metadata": memory_ref.get("metadata", {}),
                "created_at": str(task.get("created_at", ""))
            }

            results.append(result)

    return results


@router.get("/memory/analytics")
async def get_memory_analytics() -> Dict[str, Any]:
    """
    Get Memory MCP analytics

    Returns:
        Analytics across all layers
    """
    memory_scheduler = MemorySchedulerService()

    analytics = await memory_scheduler.get_task_analytics()

    # Add layer statistics
    from app.routers.scheduled_tasks import tasks_db

    analytics["total_memories"] = len(tasks_db) * 3  # 3 layers per task
    analytics["layers"] = {
        "procedural": len(tasks_db),
        "episodic": len(tasks_db),
        "semantic": len(tasks_db)
    }

    return analytics
