"""
Export API Router - Task Export Functionality (JSON, CSV, YAML)
Phase 5, Task 5 - Data Portability

Provides export endpoints for tasks in multiple formats:
- JSON: Pydantic serialization
- CSV: pandas DataFrame
- YAML: PyYAML
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Literal
import json
import yaml
import pandas as pd
import io
from datetime import datetime

from ..database import get_db
from ..models import Task, User
from ..auth import get_current_user
from ..schemas import TaskResponse

router = APIRouter(prefix="/api/v1/export", tags=["export"])


@router.get("/tasks")
async def export_tasks(
    format: Literal["json", "csv", "yaml"] = Query("json", description="Export format"),
    project_id: int = Query(None, description="Filter by project ID (optional)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export tasks in requested format (JSON, CSV, YAML)

    Query Parameters:
    - format: json|csv|yaml (default: json)
    - project_id: Filter tasks by project (optional)

    Returns:
    - Downloadable file with Content-Disposition: attachment
    """

    # Query all user's tasks
    query = db.query(Task).filter(Task.user_id == current_user.id)

    # Optional project filter
    if project_id is not None:
        query = query.filter(Task.project_id == project_id)

    tasks = query.all()

    if not tasks:
        raise HTTPException(status_code=404, detail="No tasks found for export")

    # Generate filename with timestamp
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"tasks_export_{timestamp}.{format}"

    # Serialize based on format
    if format == "json":
        return _export_json(tasks, filename)
    elif format == "csv":
        return _export_csv(tasks, filename)
    elif format == "yaml":
        return _export_yaml(tasks, filename)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {format}")


def _export_json(tasks: list[Task], filename: str) -> StreamingResponse:
    """Export tasks as JSON using Pydantic serialization"""

    # Convert to Pydantic models for proper serialization
    task_data = [TaskResponse.from_orm(task).dict() for task in tasks]

    # Serialize to JSON with proper datetime handling
    json_str = json.dumps(task_data, indent=2, default=str)

    # Create streaming response
    buffer = io.BytesIO(json_str.encode('utf-8'))

    return StreamingResponse(
        buffer,
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Type": "application/json"
        }
    )


def _export_csv(tasks: list[Task], filename: str) -> StreamingResponse:
    """Export tasks as CSV using pandas DataFrame"""

    # Extract task data for CSV
    task_data = []
    for task in tasks:
        task_data.append({
            "id": task.id,
            "skill_name": task.skill_name,
            "schedule": task.schedule,
            "project_id": task.project_id,
            "params": json.dumps(task.params) if task.params else None,
            "enabled": task.enabled,
            "last_run": task.last_run.isoformat() if task.last_run else None,
            "next_run": task.next_run.isoformat() if task.next_run else None,
            "created_at": task.created_at.isoformat(),
            "updated_at": task.updated_at.isoformat()
        })

    # Convert to DataFrame
    df = pd.DataFrame(task_data)

    # Export to CSV
    buffer = io.StringIO()
    df.to_csv(buffer, index=False)
    buffer.seek(0)

    # Convert to bytes
    bytes_buffer = io.BytesIO(buffer.getvalue().encode('utf-8'))

    return StreamingResponse(
        bytes_buffer,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Type": "text/csv; charset=utf-8"
        }
    )


def _export_yaml(tasks: list[Task], filename: str) -> StreamingResponse:
    """Export tasks as YAML using PyYAML"""

    # Extract task data for YAML
    task_data = []
    for task in tasks:
        task_data.append({
            "id": task.id,
            "skill_name": task.skill_name,
            "schedule": task.schedule,
            "project_id": task.project_id,
            "params": task.params,
            "enabled": task.enabled,
            "last_run": task.last_run.isoformat() if task.last_run else None,
            "next_run": task.next_run.isoformat() if task.next_run else None,
            "created_at": task.created_at.isoformat(),
            "updated_at": task.updated_at.isoformat()
        })

    # Serialize to YAML
    yaml_str = yaml.dump(
        {"tasks": task_data},
        default_flow_style=False,
        allow_unicode=True,
        sort_keys=False
    )

    # Create streaming response
    buffer = io.BytesIO(yaml_str.encode('utf-8'))

    return StreamingResponse(
        buffer,
        media_type="application/x-yaml",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Type": "application/x-yaml"
        }
    )
