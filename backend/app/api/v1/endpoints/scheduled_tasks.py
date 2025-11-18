"""
Scheduled Tasks API Endpoints
Handles task scheduling, prompts, and reminders
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter()


# ============================================================================
# MODELS
# ============================================================================

class ScheduledTaskCreate(BaseModel):
    """Model for creating a scheduled task"""
    title: str = Field(..., min_length=1, max_length=200, description="Task title")
    description: Optional[str] = Field(None, max_length=1000, description="Task description")
    start: datetime = Field(..., description="Task start time")
    end: datetime = Field(..., description="Task end time")
    type: str = Field(..., pattern="^(prompt|task|reminder)$", description="Task type")
    status: str = Field(default="pending", pattern="^(pending|completed|cancelled)$", description="Task status")
    priority: str = Field(default="medium", pattern="^(low|medium|high)$", description="Task priority")
    tags: Optional[List[str]] = Field(default=None, description="Task tags")


class ScheduledTaskUpdate(BaseModel):
    """Model for updating a scheduled task"""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    type: Optional[str] = Field(None, pattern="^(prompt|task|reminder)$")
    status: Optional[str] = Field(None, pattern="^(pending|completed|cancelled)$")
    priority: Optional[str] = Field(None, pattern="^(low|medium|high)$")
    tags: Optional[List[str]] = None


class ScheduledTaskResponse(BaseModel):
    """Model for scheduled task response"""
    id: str = Field(..., description="Task ID")
    title: str
    description: Optional[str]
    start: datetime
    end: datetime
    type: str
    status: str
    priority: str
    tags: Optional[List[str]]
    created_at: datetime
    updated_at: datetime


# ============================================================================
# IN-MEMORY STORAGE (TODO: Replace with database)
# ============================================================================

tasks_db: dict[str, dict] = {}
task_counter = 0


def generate_task_id() -> str:
    """Generate a new task ID"""
    global task_counter
    task_counter += 1
    return f"task_{task_counter}"


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/scheduled-tasks", response_model=List[ScheduledTaskResponse])
async def get_scheduled_tasks(
    status: Optional[str] = None,
    type: Optional[str] = None,
    priority: Optional[str] = None,
) -> List[ScheduledTaskResponse]:
    """
    Get all scheduled tasks with optional filtering

    Args:
        status: Filter by task status (pending, completed, cancelled)
        type: Filter by task type (prompt, task, reminder)
        priority: Filter by priority (low, medium, high)

    Returns:
        List of scheduled tasks
    """
    tasks = list(tasks_db.values())

    # Apply filters
    if status:
        tasks = [t for t in tasks if t["status"] == status]
    if type:
        tasks = [t for t in tasks if t["type"] == type]
    if priority:
        tasks = [t for t in tasks if t["priority"] == priority]

    return tasks


@router.get("/scheduled-tasks/{task_id}", response_model=ScheduledTaskResponse)
async def get_scheduled_task(task_id: str) -> ScheduledTaskResponse:
    """
    Get a specific scheduled task by ID

    Args:
        task_id: Task ID

    Returns:
        Scheduled task details

    Raises:
        HTTPException: 404 if task not found
    """
    if task_id not in tasks_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found"
        )

    return tasks_db[task_id]


@router.post("/scheduled-tasks", response_model=ScheduledTaskResponse, status_code=status.HTTP_201_CREATED)
async def create_scheduled_task(task: ScheduledTaskCreate) -> ScheduledTaskResponse:
    """
    Create a new scheduled task

    Args:
        task: Task data

    Returns:
        Created task

    Raises:
        HTTPException: 400 if validation fails
    """
    # Validate dates
    if task.end <= task.start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End time must be after start time"
        )

    # Create task
    task_id = generate_task_id()
    now = datetime.utcnow()

    task_data = {
        "id": task_id,
        "title": task.title,
        "description": task.description,
        "start": task.start,
        "end": task.end,
        "type": task.type,
        "status": task.status,
        "priority": task.priority,
        "tags": task.tags or [],
        "created_at": now,
        "updated_at": now,
    }

    tasks_db[task_id] = task_data

    return task_data


@router.put("/scheduled-tasks/{task_id}", response_model=ScheduledTaskResponse)
async def update_scheduled_task(task_id: str, updates: ScheduledTaskUpdate) -> ScheduledTaskResponse:
    """
    Update a scheduled task

    Args:
        task_id: Task ID
        updates: Task updates

    Returns:
        Updated task

    Raises:
        HTTPException: 404 if task not found, 400 if validation fails
    """
    if task_id not in tasks_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found"
        )

    task = tasks_db[task_id]

    # Apply updates
    update_data = updates.model_dump(exclude_unset=True)

    # Validate dates if both provided
    new_start = update_data.get("start", task["start"])
    new_end = update_data.get("end", task["end"])

    if new_end <= new_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End time must be after start time"
        )

    # Update task
    for key, value in update_data.items():
        task[key] = value

    task["updated_at"] = datetime.utcnow()

    return task


@router.delete("/scheduled-tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scheduled_task(task_id: str):
    """
    Delete a scheduled task

    Args:
        task_id: Task ID

    Raises:
        HTTPException: 404 if task not found
    """
    if task_id not in tasks_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found"
        )

    del tasks_db[task_id]


@router.post("/scheduled-tasks/{task_id}/complete", response_model=ScheduledTaskResponse)
async def complete_scheduled_task(task_id: str) -> ScheduledTaskResponse:
    """
    Mark a task as completed

    Args:
        task_id: Task ID

    Returns:
        Updated task

    Raises:
        HTTPException: 404 if task not found
    """
    if task_id not in tasks_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found"
        )

    task = tasks_db[task_id]
    task["status"] = "completed"
    task["updated_at"] = datetime.utcnow()

    return task


@router.post("/scheduled-tasks/{task_id}/cancel", response_model=ScheduledTaskResponse)
async def cancel_scheduled_task(task_id: str) -> ScheduledTaskResponse:
    """
    Cancel a task

    Args:
        task_id: Task ID

    Returns:
        Updated task

    Raises:
        HTTPException: 404 if task not found
    """
    if task_id not in tasks_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found"
        )

    task = tasks_db[task_id]
    task["status"] = "cancelled"
    task["updated_at"] = datetime.utcnow()

    return task
