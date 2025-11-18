"""
Logs API Router
Provides endpoints for querying, filtering, and exporting structured logs
Integrates with log rotation service and structured logger
"""

from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import PlainTextResponse
from typing import Optional, List, Dict, Any
from datetime import datetime
import logging

from app.services.log_rotation import get_log_rotation_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/logs/files")
async def list_log_files():
    """
    List all log files with metadata

    Returns:
        List of log files with size, modified date, etc.
    """
    try:
        service = get_log_rotation_service()
        files = service.get_log_files_info()
        return {
            "success": True,
            "files": files,
            "total_files": len(files)
        }
    except Exception as e:
        logger.error(f"Failed to list log files: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs/query")
async def query_logs(
    filename: Optional[str] = Query(None, description="Log file to query (defaults to current day)"),
    level: Optional[str] = Query(None, description="Filter by log level (DEBUG, INFO, WARN, ERROR, FATAL)"),
    agent_name: Optional[str] = Query(None, description="Filter by agent name"),
    correlation_id: Optional[str] = Query(None, description="Filter by correlation ID"),
    start_time: Optional[str] = Query(None, description="Start time (ISO format)"),
    end_time: Optional[str] = Query(None, description="End time (ISO format)"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of logs to return"),
    offset: int = Query(0, ge=0, description="Number of logs to skip")
):
    """
    Query logs with filters

    Args:
        filename: Log file to query
        level: Filter by log level
        agent_name: Filter by agent name
        correlation_id: Filter by correlation ID
        start_time: Start time filter
        end_time: End time filter
        limit: Maximum results
        offset: Skip results

    Returns:
        Filtered log entries
    """
    try:
        service = get_log_rotation_service()

        # Default to current day's log if no filename specified
        if not filename:
            today = datetime.now().strftime("%Y-%m-%d")
            filename = f"hooks-{today}.log"

        # Build filters
        filters = {}
        if level:
            filters["level"] = level
        if agent_name:
            filters["agent_name"] = agent_name
        if correlation_id:
            filters["correlation_id"] = correlation_id
        if start_time:
            filters["start_time"] = start_time
        if end_time:
            filters["end_time"] = end_time

        # Query logs
        entries = service.read_log_entries(
            filename=filename,
            limit=limit,
            offset=offset,
            filters=filters
        )

        return {
            "success": True,
            "logs": entries,
            "count": len(entries),
            "filters": filters,
            "pagination": {
                "limit": limit,
                "offset": offset
            }
        }

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to query logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs/export")
async def export_logs(
    filename: str = Query(..., description="Log file to export"),
    format: str = Query("json", description="Export format (json or csv)"),
    level: Optional[str] = Query(None, description="Filter by log level"),
    agent_name: Optional[str] = Query(None, description="Filter by agent name"),
    correlation_id: Optional[str] = Query(None, description="Filter by correlation ID")
):
    """
    Export logs to JSON or CSV

    Args:
        filename: Log file to export
        format: Export format (json or csv)
        level: Filter by log level
        agent_name: Filter by agent name
        correlation_id: Filter by correlation ID

    Returns:
        Exported logs as file
    """
    try:
        service = get_log_rotation_service()

        # Build filters
        filters = {}
        if level:
            filters["level"] = level
        if agent_name:
            filters["agent_name"] = agent_name
        if correlation_id:
            filters["correlation_id"] = correlation_id

        # Export logs
        exported = service.export_logs(
            filename=filename,
            output_format=format,
            filters=filters
        )

        # Return as downloadable file
        media_type = "application/json" if format == "json" else "text/csv"
        export_filename = filename.replace(".log", f".{format}")

        return PlainTextResponse(
            content=exported,
            media_type=media_type,
            headers={
                "Content-Disposition": f"attachment; filename={export_filename}"
            }
        )

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to export logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/logs/rotate")
async def rotate_logs():
    """
    Manually trigger log rotation

    Returns:
        Rotation statistics
    """
    try:
        service = get_log_rotation_service()
        stats = service.rotate_logs()

        return {
            "success": True,
            "message": "Log rotation completed",
            "stats": stats
        }

    except Exception as e:
        logger.error(f"Log rotation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs/stats")
async def get_log_stats():
    """
    Get aggregated log statistics

    Returns:
        Log statistics by level, agent, etc.
    """
    try:
        service = get_log_rotation_service()

        # Get files info
        files_info = service.get_log_files_info()

        # Calculate total size
        total_size_mb = sum(f["size_mb"] for f in files_info)

        # Get current day's log for recent stats
        today = datetime.now().strftime("%Y-%m-%d")
        current_log = f"hooks-{today}.log"

        recent_entries = []
        try:
            recent_entries = service.read_log_entries(
                filename=current_log,
                limit=1000
            )
        except FileNotFoundError:
            pass

        # Aggregate stats
        level_counts = {}
        agent_counts = {}

        for entry in recent_entries:
            level = entry.get("level", "UNKNOWN")
            level_counts[level] = level_counts.get(level, 0) + 1

            agent_name = entry.get("agent", {}).get("name", "unknown")
            agent_counts[agent_name] = agent_counts.get(agent_name, 0) + 1

        return {
            "success": True,
            "total_files": len(files_info),
            "total_size_mb": round(total_size_mb, 2),
            "recent_entries": len(recent_entries),
            "by_level": level_counts,
            "by_agent": agent_counts,
            "files": files_info
        }

    except Exception as e:
        logger.error(f"Failed to get log stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs/correlation/{correlation_id}")
async def trace_correlation(correlation_id: str):
    """
    Trace all logs for a specific correlation ID across all files

    Args:
        correlation_id: Correlation ID to trace

    Returns:
        All log entries with matching correlation ID
    """
    try:
        service = get_log_rotation_service()
        files_info = service.get_log_files_info()

        all_entries = []

        # Search across all log files
        for file_info in files_info:
            filename = file_info["filename"]
            try:
                entries = service.read_log_entries(
                    filename=filename,
                    limit=10000,
                    filters={"correlation_id": correlation_id}
                )
                all_entries.extend(entries)
            except Exception as e:
                logger.warning(f"Failed to read {filename}: {e}")
                continue

        # Sort by timestamp
        all_entries.sort(key=lambda x: x.get("timestamp", ""))

        return {
            "success": True,
            "correlation_id": correlation_id,
            "trace": all_entries,
            "count": len(all_entries),
            "files_searched": len(files_info)
        }

    except Exception as e:
        logger.error(f"Failed to trace correlation ID: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs/errors/recent")
async def get_recent_errors(
    limit: int = Query(50, ge=1, le=500, description="Maximum number of errors to return"),
    hours: int = Query(24, ge=1, le=168, description="Hours to look back")
):
    """
    Get recent error and fatal logs

    Args:
        limit: Maximum number of errors
        hours: Hours to look back

    Returns:
        Recent error logs
    """
    try:
        service = get_log_rotation_service()

        # Calculate start time
        start_time = datetime.now().replace(microsecond=0) - timedelta(hours=hours)

        # Read critical error log
        critical_errors = []
        try:
            critical_errors = service.read_log_entries(
                filename="critical.log",
                limit=limit,
                filters={"start_time": start_time.isoformat()}
            )
        except FileNotFoundError:
            pass

        # Also check current day's log for errors
        today = datetime.now().strftime("%Y-%m-%d")
        current_log = f"hooks-{today}.log"

        regular_errors = []
        try:
            regular_errors = service.read_log_entries(
                filename=current_log,
                limit=limit,
                filters={
                    "level": "ERROR",
                    "start_time": start_time.isoformat()
                }
            )
        except FileNotFoundError:
            pass

        # Combine and sort
        all_errors = critical_errors + regular_errors
        all_errors.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

        return {
            "success": True,
            "errors": all_errors[:limit],
            "count": len(all_errors[:limit]),
            "time_range": {
                "start": start_time.isoformat(),
                "end": datetime.now().isoformat()
            }
        }

    except Exception as e:
        logger.error(f"Failed to get recent errors: {e}")
        raise HTTPException(status_code=500, detail=str(e))


from datetime import timedelta
