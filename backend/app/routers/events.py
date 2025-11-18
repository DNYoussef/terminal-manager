"""
Events Router - Event Ingestion and Broadcasting
Receives events from visibility pipeline and broadcasts to WebSocket clients
"""

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

from app.websocket.connection_manager import connection_manager
from app.websocket.notification_broadcaster import notification_broadcaster, NotificationType


router = APIRouter()


# ============================================================================
# MODELS
# ============================================================================

class EventType(str, Enum):
    """Event types matching visibility pipeline"""
    AGENT_SPAWNED = "agent_spawned"
    AGENT_ACTIVATED = "agent_activated"
    OPERATION_ALLOWED = "operation_allowed"
    OPERATION_DENIED = "operation_denied"
    BUDGET_UPDATED = "budget_updated"
    TASK_STARTED = "task_started"
    TASK_COMPLETED = "task_completed"
    TASK_FAILED = "task_failed"
    HOOK_EXECUTED = "hook_executed"
    PERMISSION_CHECK = "permission_check"
    AUDIT_TRAIL = "audit_trail"


class AgentEvent(BaseModel):
    """Agent event model"""
    event_type: EventType
    timestamp: str
    event_id: str
    agent_id: str
    agent_name: str
    agent_role: str = "worker"
    operation: str = "unknown"
    status: str = "success"
    metadata: Dict[str, Any] = Field(default_factory=dict)


class EventBatch(BaseModel):
    """Batch of events from visibility pipeline"""
    events: List[AgentEvent]
    batch_id: str
    timestamp: str


class EventIngestResponse(BaseModel):
    """Response for event ingestion"""
    success: bool
    events_received: int
    events_broadcasted: int
    errors: List[str] = Field(default_factory=list)
    timestamp: str


# ============================================================================
# EVENT STORAGE (In-Memory for now)
# ============================================================================

# Event store: event_type -> list of events
event_store: Dict[str, List[AgentEvent]] = {}
max_events_per_type = 1000  # Keep last N events per type


def store_event(event: AgentEvent):
    """Store event in memory"""
    event_type = event.event_type.value

    if event_type not in event_store:
        event_store[event_type] = []

    event_store[event_type].append(event)

    # Keep only last N events
    if len(event_store[event_type]) > max_events_per_type:
        event_store[event_type] = event_store[event_type][-max_events_per_type:]


def get_recent_events(event_type: Optional[str] = None, limit: int = 100) -> List[AgentEvent]:
    """Get recent events"""
    if event_type:
        return event_store.get(event_type, [])[-limit:]

    # Return all events, limited
    all_events = []
    for events in event_store.values():
        all_events.extend(events)

    # Sort by timestamp (newest first) and limit
    all_events.sort(key=lambda e: e.timestamp, reverse=True)
    return all_events[:limit]


# ============================================================================
# EVENT INGESTION ENDPOINT
# ============================================================================

@router.post("/events/ingest", response_model=EventIngestResponse)
async def ingest_events(batch: EventBatch):
    """
    Ingest events from visibility pipeline and broadcast to WebSocket clients

    Args:
        batch: Batch of agent events

    Returns:
        EventIngestResponse with processing results
    """
    errors = []
    broadcasted = 0

    try:
        for event in batch.events:
            try:
                # Store event
                store_event(event)

                # Prepare WebSocket message
                ws_message = {
                    "type": "agent_event",
                    "event": event.dict(),
                    "timestamp": datetime.now().isoformat()
                }

                # Broadcast to all connected clients
                await connection_manager.broadcast(ws_message)
                broadcasted += 1

                # Send targeted notifications for important events
                await send_event_notifications(event)

            except Exception as e:
                errors.append(f"Event {event.event_id}: {str(e)}")

        return EventIngestResponse(
            success=len(errors) == 0,
            events_received=len(batch.events),
            events_broadcasted=broadcasted,
            errors=errors,
            timestamp=datetime.now().isoformat()
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to ingest events: {str(e)}")


async def send_event_notifications(event: AgentEvent):
    """
    Send in-app notifications for important events

    Args:
        event: Agent event to notify about
    """
    # For now, broadcast to all users (user_id=1 as default)
    # In production, use actual user_id from event metadata
    user_id = event.metadata.get("user_id", 1)

    if event.event_type == EventType.AGENT_SPAWNED:
        await notification_broadcaster.info(
            user_id=user_id,
            title="Agent Spawned",
            message=f"Agent '{event.agent_name}' ({event.agent_role}) is now active",
            data=event.dict()
        )

    elif event.event_type == EventType.OPERATION_DENIED:
        await notification_broadcaster.warning(
            user_id=user_id,
            title="Operation Denied",
            message=f"Agent '{event.agent_name}' was denied: {event.operation}",
            data=event.dict()
        )

    elif event.event_type == EventType.TASK_COMPLETED:
        duration_ms = event.metadata.get("duration_ms", 0)
        duration_s = duration_ms / 1000 if duration_ms else 0

        await notification_broadcaster.success(
            user_id=user_id,
            title="Task Completed",
            message=f"Agent '{event.agent_name}' completed {event.operation} in {duration_s:.1f}s",
            data=event.dict()
        )

    elif event.event_type == EventType.TASK_FAILED:
        error = event.metadata.get("error", "Unknown error")

        await notification_broadcaster.error(
            user_id=user_id,
            title="Task Failed",
            message=f"Agent '{event.agent_name}' failed: {error[:100]}",
            data=event.dict()
        )


# ============================================================================
# EVENT RETRIEVAL ENDPOINTS
# ============================================================================

@router.get("/events/recent", response_model=List[AgentEvent])
async def get_events(
    event_type: Optional[EventType] = Query(None, description="Filter by event type"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum events to return")
):
    """
    Get recent events

    Args:
        event_type: Optional event type filter
        limit: Maximum number of events to return

    Returns:
        List of recent events
    """
    event_type_str = event_type.value if event_type else None
    return get_recent_events(event_type_str, limit)


@router.get("/events/stats")
async def get_event_stats():
    """
    Get event statistics

    Returns:
        Statistics about stored events
    """
    total_events = sum(len(events) for events in event_store.values())

    return {
        "total_events": total_events,
        "events_by_type": {
            event_type: len(events)
            for event_type, events in event_store.items()
        },
        "max_events_per_type": max_events_per_type,
        "event_types": list(event_store.keys())
    }


# ============================================================================
# WEBSOCKET ENDPOINT FOR REAL-TIME STREAMING
# ============================================================================

@router.websocket("/events/stream")
async def websocket_event_stream(websocket: WebSocket, user_id: Optional[int] = Query(None)):
    """
    WebSocket endpoint for real-time event streaming

    Args:
        websocket: WebSocket connection
        user_id: Optional user ID for targeted events
    """
    await connection_manager.connect(websocket, user_id, metadata={"stream": "events"})

    try:
        # Send initial connection success message
        await websocket.send_json({
            "type": "connected",
            "message": "Event stream connected",
            "timestamp": datetime.now().isoformat()
        })

        # Send recent events as history
        recent = get_recent_events(limit=50)
        await websocket.send_json({
            "type": "history",
            "events": [event.dict() for event in recent],
            "count": len(recent),
            "timestamp": datetime.now().isoformat()
        })

        # Keep connection alive and listen for client messages
        while True:
            try:
                data = await websocket.receive_text()

                # Handle client messages (ping, filter requests, etc.)
                try:
                    message = eval(data) if isinstance(data, str) else data

                    if message.get("type") == "ping":
                        await websocket.send_json({
                            "type": "pong",
                            "timestamp": datetime.now().isoformat()
                        })

                except Exception:
                    pass  # Ignore malformed messages

            except WebSocketDisconnect:
                break
            except Exception as e:
                print(f"WebSocket error: {e}")
                break

    finally:
        connection_manager.disconnect(websocket)


# ============================================================================
# AGENT ACTIVITY STREAM (Dashboard specific)
# ============================================================================

@router.websocket("/agents/activity/stream")
async def websocket_agent_activity(websocket: WebSocket, user_id: Optional[int] = Query(None)):
    """
    WebSocket endpoint for agent activity stream (dashboard)

    This is the endpoint mentioned in the task requirements.

    Args:
        websocket: WebSocket connection
        user_id: Optional user ID for user-specific agents
    """
    await connection_manager.connect(websocket, user_id, metadata={"stream": "agent_activity"})

    try:
        # Send initial connection message
        await websocket.send_json({
            "type": "connected",
            "message": "Agent activity stream connected",
            "active_agents": 0,  # TODO: Get from agent registry
            "timestamp": datetime.now().isoformat()
        })

        # Send recent agent events
        agent_events = [
            e for e in get_recent_events(limit=100)
            if e.event_type in [
                EventType.AGENT_SPAWNED,
                EventType.AGENT_ACTIVATED,
                EventType.TASK_STARTED,
                EventType.TASK_COMPLETED,
                EventType.TASK_FAILED
            ]
        ]

        await websocket.send_json({
            "type": "agent_history",
            "events": [event.dict() for event in agent_events],
            "count": len(agent_events),
            "timestamp": datetime.now().isoformat()
        })

        # Keep connection alive
        while True:
            try:
                data = await websocket.receive_text()

                # Handle ping/pong
                if data == "ping":
                    await websocket.send_text("pong")

            except WebSocketDisconnect:
                break
            except Exception as e:
                print(f"Agent activity stream error: {e}")
                break

    finally:
        connection_manager.disconnect(websocket)


# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get("/events/health")
async def events_health():
    """Health check for events system"""
    return {
        "status": "healthy",
        "active_connections": connection_manager.get_connection_count(),
        "total_events_stored": sum(len(events) for events in event_store.values()),
        "connection_stats": connection_manager.get_stats(),
        "timestamp": datetime.now().isoformat()
    }
