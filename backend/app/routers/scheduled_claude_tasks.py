"""
API router for scheduled Claude Code tasks
Provides CRUD operations and execution management for calendar-triggered Claude instances
"""

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid

from app.db_setup import get_db
from app.models.scheduled_claude_task import ScheduledClaudeTask, TaskExecutionReport
from app.services.claude_scheduler import schedule_task, cancel_scheduled_task, trigger_task_now

router = APIRouter(prefix="/scheduled-tasks", tags=["scheduled-claude-tasks"])


class ScheduledTaskCreate(BaseModel):
    """Request model for creating scheduled task"""
    title: str
    description: Optional[str] = None
    scheduled_time: datetime
    recurrence: Optional[str] = 'once'  # 'once', 'daily', 'weekly', 'monthly'
    recurrence_config: Optional[dict] = {}

    prompt: str
    yolo_mode_enabled: bool = True
    max_execution_time: int = 3600
    working_directory: Optional[str] = None

    agent_type: Optional[str] = 'general-purpose'
    playbook: Optional[str] = None
    skills: Optional[List[str]] = []

    project_id: Optional[str] = None
    terminal_id: Optional[str] = None

    created_by: Optional[str] = 'system'
    task_metadata: Optional[dict] = {}


class ScheduledTaskResponse(BaseModel):
    """Response model for scheduled task"""
    id: str
    title: str
    description: Optional[str]
    scheduled_time: datetime
    recurrence: str

    prompt: str
    yolo_mode_enabled: bool
    agent_type: str

    status: str
    next_execution_time: Optional[datetime]
    execution_count: int

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ExecutionReportResponse(BaseModel):
    """Response model for execution report"""
    id: str
    scheduled_task_id: str

    execution_start_time: datetime
    execution_end_time: Optional[datetime]
    duration_seconds: Optional[int]

    status: str
    success: bool
    summary: Optional[str]

    files_created: List[str]
    files_modified: List[str]
    commands_executed: int

    created_at: datetime

    class Config:
        from_attributes = True


@router.post("/", response_model=ScheduledTaskResponse)
async def create_scheduled_task(
    task: ScheduledTaskCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Create a new scheduled Claude Code task"""

    # Create database record
    new_task = ScheduledClaudeTask(
        id=uuid.uuid4(),
        title=task.title,
        description=task.description,
        scheduled_time=task.scheduled_time,
        recurrence=task.recurrence,
        recurrence_config=task.recurrence_config,
        prompt=task.prompt,
        yolo_mode_enabled=task.yolo_mode_enabled,
        max_execution_time=task.max_execution_time,
        working_directory=task.working_directory,
        agent_type=task.agent_type,
        playbook=task.playbook,
        skills=task.skills,
        project_id=task.project_id,
        terminal_id=task.terminal_id,
        next_execution_time=task.scheduled_time,
        created_by=task.created_by,
        task_metadata=task.task_metadata
    )

    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    # Register with APScheduler
    background_tasks.add_task(schedule_task, str(new_task.id), task.scheduled_time, task.recurrence)

    return ScheduledTaskResponse(
        id=str(new_task.id),
        title=new_task.title,
        description=new_task.description,
        scheduled_time=new_task.scheduled_time,
        recurrence=new_task.recurrence,
        prompt=new_task.prompt,
        yolo_mode_enabled=new_task.yolo_mode_enabled,
        agent_type=new_task.agent_type,
        status=new_task.status,
        next_execution_time=new_task.next_execution_time,
        execution_count=new_task.execution_count,
        created_at=new_task.created_at,
        updated_at=new_task.updated_at
    )


@router.get("/", response_model=List[ScheduledTaskResponse])
async def list_scheduled_tasks(
    limit: int = Query(default=50, le=200),
    status: Optional[str] = None,
    project_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all scheduled Claude Code tasks"""
    query = db.query(ScheduledClaudeTask).order_by(ScheduledClaudeTask.scheduled_time.asc())

    if status:
        query = query.filter(ScheduledClaudeTask.status == status)
    if project_id:
        query = query.filter(ScheduledClaudeTask.project_id == project_id)

    tasks = query.limit(limit).all()

    return [
        ScheduledTaskResponse(
            id=str(t.id),
            title=t.title,
            description=t.description,
            scheduled_time=t.scheduled_time,
            recurrence=t.recurrence,
            prompt=t.prompt,
            yolo_mode_enabled=t.yolo_mode_enabled,
            agent_type=t.agent_type,
            status=t.status,
            next_execution_time=t.next_execution_time,
            execution_count=t.execution_count,
            created_at=t.created_at,
            updated_at=t.updated_at
        )
        for t in tasks
    ]


@router.get("/{task_id}", response_model=ScheduledTaskResponse)
async def get_scheduled_task(task_id: str, db: Session = Depends(get_db)):
    """Get specific scheduled task details"""
    task = db.query(ScheduledClaudeTask).filter(ScheduledClaudeTask.id == task_id).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return ScheduledTaskResponse(
        id=str(task.id),
        title=task.title,
        description=task.description,
        scheduled_time=task.scheduled_time,
        recurrence=task.recurrence,
        prompt=task.prompt,
        yolo_mode_enabled=task.yolo_mode_enabled,
        agent_type=task.agent_type,
        status=task.status,
        next_execution_time=task.next_execution_time,
        execution_count=task.execution_count,
        created_at=task.created_at,
        updated_at=task.updated_at
    )


@router.delete("/{task_id}")
async def delete_scheduled_task(
    task_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Delete scheduled task and cancel from scheduler"""
    task = db.query(ScheduledClaudeTask).filter(ScheduledClaudeTask.id == task_id).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Cancel from APScheduler
    background_tasks.add_task(cancel_scheduled_task, task_id)

    # Delete from database
    db.delete(task)
    db.commit()

    return {"message": "Task deleted successfully", "task_id": task_id}


@router.post("/{task_id}/trigger")
async def trigger_task_manually(
    task_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Manually trigger task execution immediately"""
    task = db.query(ScheduledClaudeTask).filter(ScheduledClaudeTask.id == task_id).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Trigger execution in background
    background_tasks.add_task(trigger_task_now, task_id)

    return {"message": "Task triggered", "task_id": task_id}


@router.get("/{task_id}/reports", response_model=List[ExecutionReportResponse])
async def get_task_execution_reports(
    task_id: str,
    limit: int = Query(default=20, le=100),
    db: Session = Depends(get_db)
):
    """Get execution history for a scheduled task"""
    reports = db.query(TaskExecutionReport).filter(
        TaskExecutionReport.scheduled_task_id == task_id
    ).order_by(
        TaskExecutionReport.execution_start_time.desc()
    ).limit(limit).all()

    return [
        ExecutionReportResponse(
            id=str(r.id),
            scheduled_task_id=str(r.scheduled_task_id),
            execution_start_time=r.execution_start_time,
            execution_end_time=r.execution_end_time,
            duration_seconds=r.duration_seconds,
            status=r.status,
            success=r.success,
            summary=r.summary,
            files_created=r.files_created or [],
            files_modified=r.files_modified or [],
            commands_executed=r.commands_executed,
            created_at=r.created_at
        )
        for r in reports
    ]


@router.get("/{task_id}/reports/{report_id}/logs")
async def get_execution_logs(
    task_id: str,
    report_id: str,
    db: Session = Depends(get_db)
):
    """Get full execution logs for a report"""
    report = db.query(TaskExecutionReport).filter(
        TaskExecutionReport.id == report_id,
        TaskExecutionReport.scheduled_task_id == task_id
    ).first()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    return {
        "report_id": str(report.id),
        "stdout": report.stdout_log,
        "stderr": report.stderr_log,
        "log_file_path": report.full_log_path
    }
