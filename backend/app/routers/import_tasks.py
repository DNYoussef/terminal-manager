"""
Import API Router - Task Import Functionality (JSON, CSV, YAML)
Phase 5, Task 5 - Data Portability

Provides import endpoints for tasks from multiple formats:
- JSON: JSON schema validation
- CSV: pandas parsing
- YAML: PyYAML parsing

Features:
- Schema validation (required fields: skill_name, schedule)
- Duplicate handling (skip or update based on query param)
- Bulk insert optimization (executemany)
- Import summary statistics
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import Literal, Optional
import json
import yaml
import pandas as pd
import io
from datetime import datetime
from pydantic import BaseModel, validator

from ..database import get_db
from ..models import Task, User
from ..auth import get_current_user

router = APIRouter(prefix="/api/v1/import", tags=["import"])


class ImportedTask(BaseModel):
    """Schema for validating imported tasks"""
    skill_name: str
    schedule: str
    project_id: Optional[int] = None
    params: Optional[dict] = None
    enabled: bool = True

    @validator('skill_name')
    def validate_skill_name(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError("skill_name cannot be empty")
        return v.strip()

    @validator('schedule')
    def validate_schedule(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError("schedule cannot be empty")
        # Basic cron validation (5 parts minimum)
        parts = v.strip().split()
        if len(parts) < 5:
            raise ValueError("Invalid cron schedule format")
        return v.strip()


class ImportSummary(BaseModel):
    """Summary of import operation"""
    total_records: int
    tasks_imported: int
    tasks_skipped: int
    tasks_updated: int
    errors: list[dict]
    duration_ms: int


@router.post("/tasks", response_model=ImportSummary)
async def import_tasks(
    file: UploadFile = File(...),
    on_duplicate: Literal["skip", "update"] = Query("skip", description="Duplicate handling strategy"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Import tasks from file (JSON, CSV, YAML)

    Query Parameters:
    - on_duplicate: skip|update (default: skip)
      - skip: Skip tasks with same skill_name + schedule
      - update: Update existing tasks with new data

    File Requirements:
    - Required fields: skill_name, schedule
    - Optional fields: project_id, params, enabled

    Returns:
    - Import summary with statistics and errors
    """

    start_time = datetime.utcnow()

    # Detect file format from extension
    filename = file.filename.lower()
    if filename.endswith('.json'):
        tasks_data = await _parse_json(file)
    elif filename.endswith('.csv'):
        tasks_data = await _parse_csv(file)
    elif filename.endswith('.yaml') or filename.endswith('.yml'):
        tasks_data = await _parse_yaml(file)
    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Use .json, .csv, .yaml, or .yml"
        )

    # Process import with duplicate handling
    summary = await _process_import(
        tasks_data=tasks_data,
        user_id=current_user.id,
        on_duplicate=on_duplicate,
        db=db
    )

    # Calculate duration
    end_time = datetime.utcnow()
    summary.duration_ms = int((end_time - start_time).total_seconds() * 1000)

    return summary


async def _parse_json(file: UploadFile) -> list[dict]:
    """Parse JSON file"""
    try:
        content = await file.read()
        data = json.loads(content.decode('utf-8'))

        # Handle both array and object with 'tasks' key
        if isinstance(data, dict) and 'tasks' in data:
            return data['tasks']
        elif isinstance(data, list):
            return data
        else:
            raise ValueError("JSON must be an array or object with 'tasks' key")
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing JSON: {str(e)}")


async def _parse_csv(file: UploadFile) -> list[dict]:
    """Parse CSV file using pandas"""
    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))

        # Convert DataFrame to list of dicts
        tasks = df.to_dict('records')

        # Parse JSON params if present
        for task in tasks:
            if 'params' in task and pd.notna(task['params']):
                try:
                    task['params'] = json.loads(task['params'])
                except json.JSONDecodeError:
                    task['params'] = None
            else:
                task['params'] = None

        return tasks
    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="CSV file is empty")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing CSV: {str(e)}")


async def _parse_yaml(file: UploadFile) -> list[dict]:
    """Parse YAML file using PyYAML"""
    try:
        content = await file.read()
        data = yaml.safe_load(content.decode('utf-8'))

        # Handle both array and object with 'tasks' key
        if isinstance(data, dict) and 'tasks' in data:
            return data['tasks']
        elif isinstance(data, list):
            return data
        else:
            raise ValueError("YAML must be an array or object with 'tasks' key")
    except yaml.YAMLError as e:
        raise HTTPException(status_code=400, detail=f"Invalid YAML: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing YAML: {str(e)}")


async def _process_import(
    tasks_data: list[dict],
    user_id: int,
    on_duplicate: str,
    db: Session
) -> ImportSummary:
    """Process imported tasks with validation and duplicate handling"""

    summary = ImportSummary(
        total_records=len(tasks_data),
        tasks_imported=0,
        tasks_skipped=0,
        tasks_updated=0,
        errors=[]
    )

    # Track processed tasks for bulk insert
    tasks_to_insert = []

    for idx, task_dict in enumerate(tasks_data):
        try:
            # Validate task schema
            imported_task = ImportedTask(**task_dict)

            # Check for duplicate (same skill_name + schedule)
            existing_task = db.query(Task).filter(
                and_(
                    Task.user_id == user_id,
                    Task.skill_name == imported_task.skill_name,
                    Task.schedule == imported_task.schedule
                )
            ).first()

            if existing_task:
                if on_duplicate == "skip":
                    summary.tasks_skipped += 1
                    continue
                elif on_duplicate == "update":
                    # Update existing task
                    existing_task.project_id = imported_task.project_id
                    existing_task.params = imported_task.params
                    existing_task.enabled = imported_task.enabled
                    existing_task.updated_at = datetime.utcnow()
                    summary.tasks_updated += 1
                    continue

            # Create new task for bulk insert
            new_task = Task(
                user_id=user_id,
                skill_name=imported_task.skill_name,
                schedule=imported_task.schedule,
                project_id=imported_task.project_id,
                params=imported_task.params,
                enabled=imported_task.enabled,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            tasks_to_insert.append(new_task)

        except Exception as e:
            summary.errors.append({
                "record_index": idx,
                "task_data": task_dict,
                "error": str(e)
            })

    # Bulk insert new tasks (optimized with executemany)
    if tasks_to_insert:
        db.bulk_save_objects(tasks_to_insert)
        db.commit()
        summary.tasks_imported = len(tasks_to_insert)

    return summary
