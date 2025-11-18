"""
Memory MCP Scheduler Service - Corrected Time-Based Architecture

Uses actual Memory MCP Triple-Layer System:
- Short-term: 24 hours (full content, no decay)
- Mid-term: 7 days (full content, linear decay)
- Long-term: 30+ days (compressed keys, e^(-days/30) decay)

NOT the fabricated procedural/episodic/semantic layers!
"""
import json
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.services.memory_mcp_client import MemoryMCPClient


class MemorySchedulerService:
    """
    Service for storing scheduled tasks in Memory MCP

    Correct Architecture:
    - Time-based retention (short/mid/long term)
    - Mode-aware search (execution/planning/brainstorming)
    - Proper WHO/WHEN/PROJECT/WHY tagging
    """

    def __init__(self):
        self.memory_client = MemoryMCPClient()

    async def store_task(self, task_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Store task in Memory MCP with proper tagging

        All tasks start in short-term layer (24h), then auto-decay based on:
        - Unaccessed after 24h -> mid-term (7d linear decay)
        - Unaccessed after 7d -> long-term (30d+ exponential decay)

        Args:
            task_data: Task information

        Returns:
            Task data with memory references
        """
        task_id = task_data.get("id") or str(uuid.uuid4())

        # Build natural language content for vector search
        content = self._build_searchable_content(task_data)

        # Store with proper tagging
        result = self.memory_client.store(
            agent="scheduler",
            content=content,
            metadata={
                "project": "terminal-manager",
                "intent": "task-management",
                "task_id": task_id,
                "task_type": task_data.get("type", "task"),
                "priority": task_data.get("priority", "medium"),
                "status": task_data.get("status", "pending"),
                "start_time": str(task_data.get("start", "")),
                "end_time": str(task_data.get("end", "")),
            }
        )

        # Update task data with memory reference
        task_data["memory_ref"] = {
            "stored_at": result["timestamp"],
            "retention_layer": result["retention_layer"],  # Will be "short-term" initially
            "mcp_metadata": result["metadata"]
        }
        task_data["id"] = task_id

        return task_data

    async def retrieve_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve task from Memory MCP

        Args:
            task_id: Task identifier

        Returns:
            Complete task data or None
        """
        # Search for task by ID
        query = f"task_id:{task_id}"
        results = self.memory_client.search(query, limit=1, mode="execution")

        if results:
            return results[0]
        return None

    async def search_tasks(
        self,
        query: str,
        mode: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Semantic search for tasks with mode-aware configuration

        Auto-detects mode from query:
        - "What tasks..." -> Execution mode (5 results, precise)
        - "How should I prioritize..." -> Planning mode (20 results, broader)
        - "What if I reschedule..." -> Brainstorming mode (30 results, creative)

        Args:
            query: Natural language search query
            mode: Override auto-detection (execution, planning, brainstorming)
            filters: Additional filters (status, priority, type)
            limit: Override default limit from mode

        Returns:
            List of matching tasks
        """
        # Build enhanced query with filters
        enhanced_query = query
        if filters:
            filter_parts = []
            for key, value in filters.items():
                filter_parts.append(f"{key}:{value}")
            if filter_parts:
                enhanced_query = f"{query} {' '.join(filter_parts)}"

        # Search with mode-aware configuration
        results = self.memory_client.search(
            enhanced_query,
            limit=limit,
            mode=mode
        )

        return results

    async def update_task_status(
        self,
        task_id: str,
        status: str,
        completed_by: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Update task status

        Creates new memory entry with updated status
        (Memory MCP handles versioning through time-based retention)

        Args:
            task_id: Task identifier
            status: New status (pending, completed, cancelled)
            completed_by: User/agent who completed the task

        Returns:
            Updated task data
        """
        # Retrieve current task
        task = await self.retrieve_task(task_id)
        if not task:
            raise ValueError(f"Task not found: {task_id}")

        # Update status
        task["status"] = status
        if status == "completed":
            task["completed_at"] = datetime.utcnow().isoformat()
            task["completed_by"] = completed_by or "user"

        # Store updated version (new memory entry)
        result = await self.store_task(task)

        return result

    async def get_task_analytics(self) -> Dict[str, Any]:
        """
        Get analytics across all scheduled tasks

        Uses semantic search to aggregate patterns

        Returns:
            Analytics summary
        """
        # Search for all tasks (planning mode for broader results)
        all_tasks = await self.search_tasks(
            "scheduled tasks analytics summary",
            mode="planning",
            limit=100
        )

        # Aggregate statistics
        analytics = {
            "total_tasks": len(all_tasks),
            "by_status": {},
            "by_type": {},
            "by_priority": {},
            "completion_rate": 0.0
        }

        # Count by status, type, priority
        for task in all_tasks:
            metadata = task.get("metadata", {})

            status = metadata.get("status", "unknown")
            analytics["by_status"][status] = analytics["by_status"].get(status, 0) + 1

            task_type = metadata.get("task_type", "unknown")
            analytics["by_type"][task_type] = analytics["by_type"].get(task_type, 0) + 1

            priority = metadata.get("priority", "unknown")
            analytics["by_priority"][priority] = analytics["by_priority"].get(priority, 0) + 1

        # Calculate completion rate
        completed = analytics["by_status"].get("completed", 0)
        total = analytics["total_tasks"]
        if total > 0:
            analytics["completion_rate"] = (completed / total) * 100

        return analytics

    def _build_searchable_content(self, task_data: Dict[str, Any]) -> str:
        """
        Build natural language content for vector embedding

        This is what gets stored in Memory MCP and searched semantically

        Returns:
            Human-readable task description
        """
        title = task_data.get("title", "Untitled task")
        description = task_data.get("description", "")
        task_type = task_data.get("type", "task")
        priority = task_data.get("priority", "medium")
        tags = task_data.get("tags", [])
        start = task_data.get("start", "")
        end = task_data.get("end", "")

        # Build natural language representation
        content = f"""Task: {title}

Type: {task_type.capitalize()}
Priority: {priority.capitalize()}
Status: {task_data.get('status', 'pending').capitalize()}

{description if description else 'No description provided.'}

Scheduled from {start} to {end}.

Tags: {', '.join(tags) if tags else 'None'}

This is a {priority} priority {task_type} that needs to be completed between the scheduled times.
        """.strip()

        return content

    def _calculate_duration(self, task_data: Dict[str, Any]) -> Optional[int]:
        """Calculate task duration in minutes"""
        try:
            start = datetime.fromisoformat(str(task_data.get("start", "")))
            end = datetime.fromisoformat(str(task_data.get("end", "")))
            duration = (end - start).total_seconds() / 60
            return int(duration)
        except (ValueError, TypeError):
            return None
