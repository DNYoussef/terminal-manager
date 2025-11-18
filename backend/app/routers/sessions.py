"""
Sessions endpoints for discovering and managing Claude Code sessions
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import logging

from app.services.session_discovery import get_session_discovery_service, SessionInfo

# Setup logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("/discover")
async def discover_sessions(
    search_paths: Optional[List[str]] = Query(None, description="Optional paths to search")
):
    """
    Discover Claude Code sessions by scanning for .claude/ directories

    Searches for .claude/ directories in allowed paths and parses session metadata
    including recent commands, agent usage, and last activity.

    Args:
        search_paths: Optional list of paths to search. If not provided, uses allowed directories.

    Returns:
        dict: Discovery results with session list and metadata
    """
    try:
        service = get_session_discovery_service()

        # Discover sessions
        sessions = service.discover_sessions(search_paths)

        # Convert to dict
        sessions_data = [session.to_dict() for session in sessions]

        logger.info(f"Discovered {len(sessions_data)} sessions")

        return {
            'success': True,
            'count': len(sessions_data),
            'sessions': sessions_data
        }

    except Exception as e:
        logger.error(f"Error discovering sessions: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to discover sessions")


@router.get("/{project_path:path}")
async def get_session(project_path: str):
    """
    Get session information for a specific project

    Args:
        project_path: Path to project directory

    Returns:
        dict: Session information

    Raises:
        HTTPException: If session not found
    """
    try:
        service = get_session_discovery_service()
        session = service.get_session(project_path)

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        return {
            'success': True,
            'session': session.to_dict()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting session: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get session")
