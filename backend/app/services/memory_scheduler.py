"""
Memory MCP Integration for Scheduled Tasks
Triple-layer memory system with semantic search and persistence
"""
import json
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel


class MemorySchedulerService:
    """
    Service for storing scheduled tasks in Memory MCP Triple Layer System

    Architecture:
    - Layer 1 (Procedural): Task execution state, completions, timestamps
    - Layer 2 (Episodic): Task history, user interactions, modifications
    - Layer 3 (Semantic): Task descriptions, searchable content, relationships
    """

    def __init__(self):
        self.layer_mapping = {
            "procedural": ["status", "created_at", "updated_at", "completed_at"],
            "episodic": ["history", "modifications", "user_interactions"],
            "semantic": ["title", "description", "tags", "type", "priority"]
        }

    async def store_task(self, task_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Store task across all three memory layers with proper metadata

        Args:
            task_data: Task information

        Returns:
            Task data with memory references
        """
        task_id = task_data.get("id") or str(uuid.uuid4())
        now = datetime.utcnow()

        # Build comprehensive metadata
        metadata = self._build_metadata(task_data, task_id, now)

        # Layer 1: Procedural - Task execution state
        procedural_content = self._build_procedural_content(task_data)
        procedural_key = f"task:procedural:{task_id}"

        # Layer 2: Episodic - Task history
        episodic_content = self._build_episodic_content(task_data, now)
        episodic_key = f"task:episodic:{task_id}"

        # Layer 3: Semantic - Searchable content
        semantic_content = self._build_semantic_content(task_data)
        semantic_key = f"task:semantic:{task_id}"

        # Store in all three layers
        # Note: In production, this would call Memory MCP via subprocess or HTTP
        # For now, we'll simulate the structure

        memory_refs = {
            "procedural": {
                "key": procedural_key,
                "content": procedural_content,
                "metadata": {**metadata, "layer": "procedural"}
            },
            "episodic": {
                "key": episodic_key,
                "content": episodic_content,
                "metadata": {**metadata, "layer": "episodic"}
            },
            "semantic": {
                "key": semantic_key,
                "content": semantic_content,
                "metadata": {**metadata, "layer": "semantic"}
            }
        }

        # Update task data with memory references
        task_data["memory_refs"] = memory_refs
        task_data["id"] = task_id

        return task_data

    async def retrieve_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve task from memory layers

        Args:
            task_id: Task identifier

        Returns:
            Complete task data or None
        """
        # In production, query Memory MCP
        # For now, return structure
        return {
            "id": task_id,
            "retrieval_method": "memory_mcp",
            "layers_queried": ["procedural", "episodic", "semantic"]
        }

    async def search_tasks(
        self,
        query: str,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Semantic search across task memories

        Args:
            query: Search query (natural language)
            filters: Additional filters (status, type, priority, date range)
            limit: Max results

        Returns:
            List of matching tasks
        """
        # Build search query for Memory MCP vector search
        search_metadata = {
            "project": "terminal-manager",
            "category": "scheduled-task",
            "intent": "search",
        }

        if filters:
            search_metadata.update(filters)

        # In production, call Memory MCP vector_search
        # For now, return structure
        return []

    async def update_task_status(
        self,
        task_id: str,
        status: str,
        completed_by: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Update task status in procedural layer

        Args:
            task_id: Task identifier
            status: New status (pending, completed, cancelled)
            completed_by: User/agent who completed the task

        Returns:
            Updated task data
        """
        now = datetime.utcnow()

        # Update procedural layer
        update_data = {
            "status": status,
            "updated_at": now.isoformat(),
        }

        if status == "completed":
            update_data["completed_at"] = now.isoformat()
            update_data["completed_by"] = completed_by or "user"

        # Record in episodic layer (history)
        history_entry = {
            "timestamp": now.isoformat(),
            "action": "status_change",
            "from_status": "pending",  # Would fetch current status
            "to_status": status,
            "actor": completed_by or "user"
        }

        return update_data

    def _build_metadata(
        self,
        task_data: Dict[str, Any],
        task_id: str,
        timestamp: datetime
    ) -> Dict[str, str]:
        """
        Build metadata following Memory MCP tagging protocol

        WHO: Agent/user creating task
        WHEN: Timestamp in multiple formats
        PROJECT: terminal-manager
        WHY: Intent (scheduling, reminder, task-management)
        """
        return {
            # WHO - Agent/User
            "agent": "scheduler",
            "agent_category": "system",
            "agent_capabilities": json.dumps(["task-scheduling", "calendar", "reminders"]),

            # WHEN - Timestamp
            "timestamp_iso": timestamp.isoformat(),
            "timestamp_unix": str(int(timestamp.timestamp())),
            "timestamp_readable": timestamp.strftime("%Y-%m-%d %H:%M:%S UTC"),

            # PROJECT - Identifier
            "project": "terminal-manager",
            "project_category": "scheduling",
            "project_namespace": "calendar",

            # WHY - Intent
            "intent": self._determine_intent(task_data),
            "task_type": task_data.get("type", "task"),
            "task_priority": task_data.get("priority", "medium"),

            # WHAT - Category
            "category": "scheduled-task",
            "subcategory": task_data.get("type", "task"),

            # Additional context
            "task_id": task_id,
            "status": task_data.get("status", "pending"),
        }

    def _determine_intent(self, task_data: Dict[str, Any]) -> str:
        """Determine intent based on task type and context"""
        task_type = task_data.get("type", "task")

        intent_mapping = {
            "prompt": "scheduled-prompt-execution",
            "task": "task-management",
            "reminder": "reminder-notification"
        }

        return intent_mapping.get(task_type, "task-management")

    def _build_procedural_content(self, task_data: Dict[str, Any]) -> str:
        """
        Build procedural layer content (execution state)

        Format: JSON with timestamps, status, execution metadata
        """
        procedural_data = {
            "task_id": task_data.get("id"),
            "status": task_data.get("status", "pending"),
            "created_at": task_data.get("created_at", datetime.utcnow().isoformat()),
            "updated_at": task_data.get("updated_at", datetime.utcnow().isoformat()),
            "start_time": task_data.get("start"),
            "end_time": task_data.get("end"),
            "execution_metadata": {
                "type": task_data.get("type"),
                "priority": task_data.get("priority"),
                "estimated_duration": self._calculate_duration(task_data)
            }
        }

        return json.dumps(procedural_data, indent=2)

    def _build_episodic_content(self, task_data: Dict[str, Any], timestamp: datetime) -> str:
        """
        Build episodic layer content (task history)

        Format: Chronological event log
        """
        episodic_data = {
            "task_id": task_data.get("id"),
            "creation_event": {
                "timestamp": timestamp.isoformat(),
                "action": "task_created",
                "actor": "user",
                "details": {
                    "title": task_data.get("title"),
                    "type": task_data.get("type"),
                    "priority": task_data.get("priority")
                }
            },
            "history": [
                {
                    "timestamp": timestamp.isoformat(),
                    "event": "created",
                    "status": "pending"
                }
            ]
        }

        return json.dumps(episodic_data, indent=2)

    def _build_semantic_content(self, task_data: Dict[str, Any]) -> str:
        """
        Build semantic layer content (searchable natural language)

        Format: Human-readable description for vector embedding
        """
        title = task_data.get("title", "Untitled task")
        description = task_data.get("description", "")
        task_type = task_data.get("type", "task")
        priority = task_data.get("priority", "medium")
        tags = task_data.get("tags", [])

        # Build natural language representation
        semantic_text = f"""
Task: {title}

Type: {task_type.capitalize()}
Priority: {priority.capitalize()}

{description if description else "No description provided."}

Scheduled from {task_data.get('start', 'unknown')} to {task_data.get('end', 'unknown')}.

Tags: {', '.join(tags) if tags else 'None'}

This is a {priority} priority {task_type} that needs to be completed between the scheduled times.
        """.strip()

        return semantic_text

    def _calculate_duration(self, task_data: Dict[str, Any]) -> Optional[int]:
        """Calculate task duration in minutes"""
        try:
            start = datetime.fromisoformat(str(task_data.get("start", "")))
            end = datetime.fromisoformat(str(task_data.get("end", "")))
            duration = (end - start).total_seconds() / 60
            return int(duration)
        except (ValueError, TypeError):
            return None

    async def add_to_history(
        self,
        task_id: str,
        event: str,
        actor: str = "user",
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Add event to episodic layer history

        Args:
            task_id: Task identifier
            event: Event description
            actor: Who performed the action
            details: Additional event details
        """
        history_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "event": event,
            "actor": actor,
            "details": details or {}
        }

        # In production, append to episodic layer in Memory MCP
        pass

    async def get_task_analytics(self) -> Dict[str, Any]:
        """
        Get analytics across all scheduled tasks

        Uses semantic layer for pattern analysis:
        - Most common task types
        - Priority distribution
        - Completion rates
        - Time patterns
        """
        # In production, query Memory MCP with aggregation
        return {
            "total_tasks": 0,
            "by_status": {},
            "by_type": {},
            "by_priority": {},
            "completion_rate": 0.0
        }
