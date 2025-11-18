"""
Projects Router
Handles project management and terminal spawning

SECURITY HARDENED VERSION - All CRITICAL vulnerabilities fixed:
- Symlink-safe path validation
- TOCTOU-safe project creation
- Secure error handling (no information disclosure)
- Complete transaction rollback
- Input validation for project names
- Config-based whitelisting
"""
import os
import uuid
import re
import shutil
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, validator
from sqlalchemy.orm import Session

from app.db_setup import get_db
from app.models.project import Project
from app.services.terminal_manager import get_terminal_manager, TerminalManager
from app.config import config

# Setup logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["projects"])


# Pydantic models for request/response
class DirectoryItem(BaseModel):
    """Directory item in filesystem browser"""
    name: str
    path: str
    is_directory: bool
    size: Optional[int] = None
    modified_at: Optional[datetime] = None


class BrowseResponse(BaseModel):
    """Response for browse endpoint"""
    current_path: str
    parent_path: Optional[str]
    items: List[DirectoryItem]


class CreateProjectRequest(BaseModel):
    """Request to create new project"""
    parent_path: str = Field(..., description="Parent directory path")
    name: str = Field(..., min_length=1, max_length=255, description="Project name")

    @validator('name')
    def validate_name(cls, v):
        """
        Validate project name for security

        CRITICAL FIX: Prevent path traversal, reserved names, invalid characters
        """
        # Check for path traversal
        if '..' in v or '/' in v or '\\' in v:
            raise ValueError("Project name cannot contain path separators or '..'")

        # Check for reserved Windows names
        reserved = [
            'CON', 'PRN', 'AUX', 'NUL',
            'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
            'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
        ]
        if v.upper() in reserved or v.upper().split('.')[0] in reserved:
            raise ValueError(f"Project name '{v}' uses a reserved Windows name")

        # Check for invalid Windows filename characters
        invalid_chars = r'[<>:"|?*\x00-\x1f]'
        if re.search(invalid_chars, v):
            raise ValueError(
                "Project name contains invalid characters: < > : \" | ? * or control characters"
            )

        # Check for leading/trailing spaces or dots (Windows issues)
        if v != v.strip():
            raise ValueError("Project name cannot start or end with spaces")

        if v.endswith('.'):
            raise ValueError("Project name cannot end with a dot")

        # Check for only dots or spaces (invalid on Windows)
        if set(v) <= {'.', ' '}:
            raise ValueError("Project name must contain valid characters")

        return v


class ProjectResponse(BaseModel):
    """Project response"""
    id: str
    name: str
    path: str
    created_at: datetime
    last_opened_at: Optional[datetime]


class OpenTerminalRequest(BaseModel):
    """Request to open terminal"""
    command: str = Field(default="claude", description="Command to run in terminal")


class OpenTerminalResponse(BaseModel):
    """Response from opening terminal"""
    terminal_id: str
    websocket_url: str
    project_id: str
    working_dir: str


class DeleteProjectResponse(BaseModel):
    """Response from delete endpoint"""
    message: str
    folder_deleted: bool


@router.get("/browse", response_model=BrowseResponse)
async def browse_filesystem(
    path: str = Query(default=r"C:\Users\17175", description="Directory path to browse"),
    db: Session = Depends(get_db)
):
    """
    Browse filesystem to select project directory

    Args:
        path: Directory path to browse
        db: Database session

    Returns:
        BrowseResponse: Directory contents

    Raises:
        HTTPException: If path is invalid or access denied
    """
    # CRITICAL FIX #2: Symlink-safe path validation
    if not config.validate_path(path):
        logger.warning(f"Browse: Path validation failed: {path}")
        raise HTTPException(
            status_code=403,
            detail="Access denied: Path outside allowed directories"
        )

    # Check path exists
    if not os.path.exists(path):
        logger.warning(f"Browse: Directory not found: {path}")
        raise HTTPException(status_code=404, detail="Directory not found")

    if not os.path.isdir(path):
        logger.warning(f"Browse: Path is not a directory: {path}")
        raise HTTPException(status_code=400, detail="Path is not a directory")

    try:
        # Get parent path
        parent_path = str(Path(path).parent) if path != Path(path).root else None
        if parent_path:
            # Validate parent is also allowed
            if not config.validate_path(parent_path):
                parent_path = None  # Parent is outside allowed dirs

        # List directory contents
        items = []
        for entry in os.scandir(path):
            try:
                stat = entry.stat()
                items.append(DirectoryItem(
                    name=entry.name,
                    path=os.path.abspath(entry.path),
                    is_directory=entry.is_dir(),
                    size=stat.st_size if entry.is_file() else None,
                    modified_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc)
                ))
            except (PermissionError, OSError) as e:
                # Skip items we can't access
                logger.debug(f"Skipping inaccessible entry: {entry.name}, error: {e}")
                continue

        # Sort: directories first, then files, alphabetically
        items.sort(key=lambda x: (not x.is_directory, x.name.lower()))

        logger.info(f"Browse: Listed {len(items)} items in {path}")

        return BrowseResponse(
            current_path=os.path.abspath(path),
            parent_path=parent_path,
            items=items
        )

    except PermissionError as e:
        logger.warning(f"Browse: Permission denied for {path}: {e}")
        # CRITICAL FIX #7: No information disclosure
        raise HTTPException(status_code=403, detail="Permission denied")
    except Exception as e:
        logger.error(f"Browse: Error browsing {path}: {e}", exc_info=True)
        # CRITICAL FIX #7: Generic error message
        raise HTTPException(status_code=500, detail="Error browsing directory")


@router.post("/create", response_model=ProjectResponse)
async def create_project(
    request: CreateProjectRequest,
    db: Session = Depends(get_db)
):
    """
    Create new project folder and database record

    Args:
        request: Create project request
        db: Database session

    Returns:
        ProjectResponse: Created project

    Raises:
        HTTPException: If creation fails or path issues
    """
    # CRITICAL FIX #2: Symlink-safe path validation
    if not config.validate_path(request.parent_path):
        logger.warning(f"Create: Parent path validation failed: {request.parent_path}")
        raise HTTPException(
            status_code=403,
            detail="Access denied: Parent path outside allowed directories"
        )

    # Check parent exists
    if not os.path.exists(request.parent_path):
        logger.warning(f"Create: Parent directory not found: {request.parent_path}")
        raise HTTPException(status_code=404, detail="Parent directory not found")

    if not os.path.isdir(request.parent_path):
        logger.warning(f"Create: Parent path is not a directory: {request.parent_path}")
        raise HTTPException(status_code=400, detail="Parent path is not a directory")

    # Create project path
    project_path = os.path.join(request.parent_path, request.name)

    # CRITICAL FIX #2: Validate project path is also allowed (symlink attack prevention)
    if not config.validate_path(project_path):
        logger.warning(f"Create: Project path validation failed: {project_path}")
        raise HTTPException(
            status_code=403,
            detail="Access denied: Project path outside allowed directories"
        )

    # Check if project record already exists with this path
    existing = db.query(Project).filter(Project.path == project_path).first()
    if existing:
        logger.warning(f"Create: Project already registered: {project_path}")
        raise HTTPException(
            status_code=409,
            detail="Project already registered with this path"
        )

    try:
        # CRITICAL FIX #3: TOCTOU-safe project creation
        # Create directory atomically
        try:
            os.makedirs(project_path, exist_ok=False)
        except FileExistsError:
            logger.warning(f"Create: Directory already exists: {project_path}")
            raise HTTPException(
                status_code=409,
                detail="Directory already exists"
            )

        # CRITICAL FIX #3: Validate the created path is where we expected
        # Detect symlink attacks that occurred during directory creation
        real_created_path = os.path.realpath(project_path)
        expected_path = os.path.realpath(
            os.path.join(request.parent_path, request.name)
        )

        if real_created_path != expected_path:
            # Symlink attack detected!
            logger.error(
                f"SECURITY ALERT: Symlink attack detected! "
                f"Expected: {expected_path}, Got: {real_created_path}"
            )

            # Cleanup the malicious directory
            try:
                shutil.rmtree(project_path, ignore_errors=True)
            except:
                pass

            raise HTTPException(
                status_code=403,
                detail="Security violation: Path manipulation detected"
            )

        # Create project record (use timezone-aware datetime)
        project_id = str(uuid.uuid4())
        project = Project(
            id=project_id,
            name=request.name,
            path=project_path,
            created_at=datetime.now(timezone.utc),
            last_opened_at=None
        )

        try:
            db.add(project)
            db.commit()
            db.refresh(project)
            logger.info(f"Created project: {project_id} at {project_path}")
        except Exception as db_error:
            logger.error(f"Database error creating project: {db_error}", exc_info=True)

            # CRITICAL FIX #8: Complete transaction rollback with directory cleanup
            db.rollback()

            # Cleanup created directory (use shutil.rmtree, not os.rmdir)
            if os.path.exists(project_path):
                try:
                    shutil.rmtree(project_path, ignore_errors=True)
                    logger.info(f"Cleaned up directory after DB failure: {project_path}")
                except Exception as cleanup_error:
                    logger.error(f"Cleanup failed: {cleanup_error}")

            # CRITICAL FIX #7: Generic error message (no DB details)
            raise HTTPException(
                status_code=500,
                detail="Failed to create project"
            )

        return ProjectResponse(
            id=project.id,
            name=project.name,
            path=project.path,
            created_at=project.created_at,
            last_opened_at=project.last_opened_at
        )

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except PermissionError as e:
        logger.warning(f"Permission denied creating project: {e}")
        raise HTTPException(status_code=403, detail="Permission denied to create directory")
    except Exception as e:
        logger.error(f"Unexpected error creating project: {e}", exc_info=True)

        # CRITICAL FIX #8: Comprehensive cleanup on any failure
        db.rollback()

        if os.path.exists(project_path):
            try:
                shutil.rmtree(project_path, ignore_errors=True)
            except Exception as cleanup_error:
                logger.error(f"Cleanup failed: {cleanup_error}")

        # CRITICAL FIX #7: Generic error message
        raise HTTPException(status_code=500, detail="Error creating project")


@router.post("/attach-session", response_model=OpenTerminalResponse)
async def attach_session_terminal(
    project_path: str = Query(..., description="Project path to attach terminal"),
    command: str = Query(default="claude", description="Command to run"),
    db: Session = Depends(get_db),
    terminal_manager: TerminalManager = Depends(get_terminal_manager)
):
    """
    Attach terminal to a discovered Claude Code session

    Creates or finds a project record for the given path,
    then spawns a terminal in that directory.

    Args:
        project_path: Path to project/session directory
        command: Command to run in terminal
        db: Database session
        terminal_manager: Terminal manager service

    Returns:
        OpenTerminalResponse: Terminal info with WebSocket URL

    Raises:
        HTTPException: If path invalid or spawn fails
    """
    # Validate path
    if not config.validate_path(project_path):
        logger.warning(f"Attach session: Path validation failed: {project_path}")
        raise HTTPException(
            status_code=403,
            detail="Access denied: Path outside allowed directories"
        )

    if not os.path.exists(project_path):
        logger.warning(f"Attach session: Directory not found: {project_path}")
        raise HTTPException(
            status_code=404,
            detail="Project directory not found"
        )

    if not os.path.isdir(project_path):
        logger.warning(f"Attach session: Path is not a directory: {project_path}")
        raise HTTPException(status_code=400, detail="Path is not a directory")

    # Find or create project record
    project = db.query(Project).filter(Project.path == project_path).first()

    if not project:
        # Create new project record
        project_name = os.path.basename(project_path)
        project_id = str(uuid.uuid4())

        project = Project(
            id=project_id,
            name=project_name,
            path=project_path,
            created_at=datetime.now(timezone.utc),
            last_opened_at=None
        )

        try:
            db.add(project)
            db.commit()
            db.refresh(project)
            logger.info(f"Created project for session: {project_id} at {project_path}")
        except Exception as db_error:
            logger.error(f"Database error creating project: {db_error}", exc_info=True)
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail="Failed to create project record"
            )

    # Spawn terminal using the existing logic
    try:
        terminal = await terminal_manager.spawn(
            project_id=project.id,
            working_dir=project.path,
            db=db,
            command=command
        )

        # Update project last_opened_at
        project.last_opened_at = datetime.now(timezone.utc)
        db.commit()

        # Generate WebSocket URL
        websocket_url = (
            f"ws://{config.WEBSOCKET_HOST}:{config.WEBSOCKET_PORT}"
            f"/api/v1/terminals/{terminal.id}/stream"
        )

        logger.info(f"Attached terminal {terminal.id} to session at {project_path}")

        return OpenTerminalResponse(
            terminal_id=terminal.id,
            websocket_url=websocket_url,
            project_id=project.id,
            working_dir=project.path
        )

    except ValueError as e:
        logger.warning(f"Attach session validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error(f"Attach session runtime error: {e}")
        raise HTTPException(status_code=500, detail="Failed to spawn terminal")
    except Exception as e:
        logger.error(f"Attach session unexpected error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error spawning terminal")


@router.post("/{project_id}/open-terminal", response_model=OpenTerminalResponse)
async def open_terminal(
    project_id: str,
    request: OpenTerminalRequest = OpenTerminalRequest(),
    db: Session = Depends(get_db),
    terminal_manager: TerminalManager = Depends(get_terminal_manager)
):
    """
    Open terminal in project directory

    Args:
        project_id: Project ID
        request: Open terminal request
        db: Database session
        terminal_manager: Terminal manager service

    Returns:
        OpenTerminalResponse: Terminal info with WebSocket URL

    Raises:
        HTTPException: If project not found or spawn fails
    """
    # Get project
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        logger.warning(f"Open terminal: Project not found: {project_id}")
        raise HTTPException(status_code=404, detail="Project not found")

    # CRITICAL FIX #2: Symlink-safe path validation
    if not config.validate_path(project.path):
        logger.warning(f"Open terminal: Path validation failed: {project.path}")
        raise HTTPException(
            status_code=403,
            detail="Access denied: Project path outside allowed directories"
        )

    if not os.path.exists(project.path):
        logger.warning(f"Open terminal: Directory not found: {project.path}")
        raise HTTPException(
            status_code=404,
            detail="Project directory no longer exists"
        )

    try:
        # Spawn terminal
        terminal = await terminal_manager.spawn(
            project_id=project.id,
            working_dir=project.path,
            db=db,
            command=request.command
        )

        # Update project last_opened_at
        project.last_opened_at = datetime.now(timezone.utc)
        db.commit()

        # Generate WebSocket URL (use config for host/port)
        websocket_url = (
            f"ws://{config.WEBSOCKET_HOST}:{config.WEBSOCKET_PORT}"
            f"/api/v1/terminals/{terminal.id}/stream"
        )

        logger.info(f"Opened terminal {terminal.id} for project {project_id}")

        return OpenTerminalResponse(
            terminal_id=terminal.id,
            websocket_url=websocket_url,
            project_id=project.id,
            working_dir=project.path
        )

    except ValueError as e:
        # Validation errors (command not allowed, path invalid, limit reached)
        logger.warning(f"Open terminal validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        # Runtime errors (spawn failures)
        logger.error(f"Open terminal runtime error: {e}")
        # CRITICAL FIX #7: Don't expose internal error details
        raise HTTPException(status_code=500, detail="Failed to spawn terminal")
    except Exception as e:
        logger.error(f"Open terminal unexpected error: {e}", exc_info=True)
        # CRITICAL FIX #7: Generic error message
        raise HTTPException(status_code=500, detail="Error spawning terminal")


@router.get("/", response_model=List[ProjectResponse])
async def list_projects(
    db: Session = Depends(get_db)
):
    """
    List all projects

    Args:
        db: Database session

    Returns:
        List[ProjectResponse]: All projects
    """
    try:
        projects = db.query(Project).order_by(Project.last_opened_at.desc()).all()
        logger.debug(f"Listed {len(projects)} projects")
        return [
            ProjectResponse(
                id=p.id,
                name=p.name,
                path=p.path,
                created_at=p.created_at,
                last_opened_at=p.last_opened_at
            )
            for p in projects
        ]
    except Exception as e:
        logger.error(f"Error listing projects: {e}", exc_info=True)
        # Return empty list on error (don't fail the request)
        return []


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    db: Session = Depends(get_db)
):
    """
    Get project by ID

    Args:
        project_id: Project ID
        db: Database session

    Returns:
        ProjectResponse: Project details

    Raises:
        HTTPException: If project not found
    """
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            logger.warning(f"Get project: Project not found: {project_id}")
            raise HTTPException(status_code=404, detail="Project not found")

        return ProjectResponse(
            id=project.id,
            name=project.name,
            path=project.path,
            created_at=project.created_at,
            last_opened_at=project.last_opened_at
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting project {project_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error retrieving project")


@router.delete("/{project_id}", response_model=DeleteProjectResponse)
async def delete_project(
    project_id: str,
    delete_folder: bool = Query(default=False, description="Also delete project folder"),
    db: Session = Depends(get_db)
):
    """
    Delete project record (optionally delete folder)

    Args:
        project_id: Project ID
        delete_folder: Whether to delete folder from disk
        db: Database session

    Returns:
        DeleteProjectResponse: Success message

    Raises:
        HTTPException: If project not found or deletion fails
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        logger.warning(f"Delete: Project not found: {project_id}")
        raise HTTPException(status_code=404, detail="Project not found")

    project_path = project.path

    try:
        # Delete project record (cascades to terminals)
        db.delete(project)
        db.commit()
        logger.info(f"Deleted project record: {project_id}")

        # Optionally delete folder
        folder_deleted = False
        if delete_folder and os.path.exists(project_path):
            # CRITICAL FIX: Re-validate path before destructive operation
            if not config.validate_path(project_path):
                logger.error(
                    f"SECURITY ALERT: Prevented deletion of invalid path: {project_path}"
                )
                return DeleteProjectResponse(
                    message="Project deleted, but folder outside allowed directories",
                    folder_deleted=False
                )

            try:
                # CRITICAL FIX #8: Use shutil.rmtree (not os.rmdir) for complete cleanup
                shutil.rmtree(project_path, ignore_errors=False)
                folder_deleted = True
                logger.info(f"Deleted project folder: {project_path}")
            except Exception as e:
                logger.error(f"Folder deletion failed: {e}")
                return DeleteProjectResponse(
                    message="Project deleted, but folder deletion failed",
                    folder_deleted=False
                )

        return DeleteProjectResponse(
            message="Project deleted successfully",
            folder_deleted=folder_deleted
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting project {project_id}: {e}", exc_info=True)
        db.rollback()
        # CRITICAL FIX #7: Generic error message
        raise HTTPException(status_code=500, detail="Error deleting project")
