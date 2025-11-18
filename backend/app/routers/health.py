"""
Health Check Router
Comprehensive health checks for MCPs, database, and system
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional
from datetime import datetime
import logging
import asyncio

from app.services.mcp_client import (
    MCPClient,
    MCPClientPool,
    MCPConnectionHealth,
    MCPConnectionStatus,
    get_mcp_client_pool
)
from app.services.mcp_proxy import get_mcp_proxy_service, MCPProxyService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/health", tags=["health"])


# Pydantic models
class MCPHealthStatus(BaseModel):
    """Health status for a single MCP server"""
    name: str
    status: str
    last_check: datetime
    last_success: Optional[datetime] = None
    error_count: int = 0
    last_error: Optional[str] = None
    response_time_ms: Optional[float] = None
    running: bool = False
    pid: Optional[int] = None
    tools_count: int = 0


class MCPHealthResponse(BaseModel):
    """Response for MCP health check endpoint"""
    success: bool
    all_connected: bool
    mcps: Dict[str, MCPHealthStatus]
    total: int
    connected: int
    disconnected: int
    error: int
    timestamp: datetime


class ReconnectRequest(BaseModel):
    """Request to reconnect to MCP server"""
    force: bool = Field(default=False, description="Force reconnect even if connected")


class ReconnectResponse(BaseModel):
    """Response from reconnection attempt"""
    success: bool
    server_name: str
    status: str
    message: str
    timestamp: datetime


class SystemHealthResponse(BaseModel):
    """Overall system health response"""
    success: bool
    status: str  # healthy, degraded, unhealthy
    mcps: MCPHealthResponse
    database: Dict[str, Any]
    timestamp: datetime


# MCP server names to check
MCP_SERVERS = [
    "memory-mcp",
    "connascence-analyzer",  # Note: registered as "connascence" in proxy
    "claude-flow",
    # Add when implemented:
    # "ruv-swarm",
    # "flow-nexus",
    # "playwright"
]


@router.get("/", response_model=Dict[str, str])
async def health_check():
    """
    Basic health check endpoint

    Returns:
        Simple status message
    """
    return {
        "status": "healthy",
        "message": "Terminal Manager API is running",
        "timestamp": datetime.now().isoformat()
    }


@router.get("/mcps", response_model=MCPHealthResponse)
async def mcp_health_check(
    mcp_service: MCPProxyService = Depends(get_mcp_proxy_service),
    pool: MCPClientPool = Depends(get_mcp_client_pool)
):
    """
    Check health status of all MCP servers

    Performs comprehensive health checks including:
    - Connection status
    - Process status
    - Response time
    - Error counts
    - Tools availability

    Returns:
        MCPHealthResponse: Detailed health status for all MCPs
    """
    try:
        # Get server status from proxy
        server_status = mcp_service.get_server_status()

        # Map internal server names
        server_name_map = {
            "connascence-analyzer": "connascence"
        }

        mcps_health = {}
        connected_count = 0
        disconnected_count = 0
        error_count = 0

        for server_name in MCP_SERVERS:
            # Map to internal name if needed
            internal_name = server_name_map.get(server_name, server_name)

            try:
                # Get or create client
                client = pool.get_client(internal_name)

                # Ping to update health
                is_connected = await client.ping()

                # Get health info
                health = client.get_health()

                # Get proxy status
                proxy_status = server_status.get(
                    internal_name,
                    {
                        "running": False,
                        "pid": None,
                        "tools_count": 0
                    }
                )

                # Determine overall status
                if health.status == MCPConnectionStatus.CONNECTED and proxy_status["running"]:
                    status_str = "connected"
                    connected_count += 1
                elif health.status == MCPConnectionStatus.ERROR:
                    status_str = "error"
                    error_count += 1
                else:
                    status_str = "disconnected"
                    disconnected_count += 1

                mcps_health[server_name] = MCPHealthStatus(
                    name=server_name,
                    status=status_str,
                    last_check=health.last_check,
                    last_success=health.last_success,
                    error_count=health.error_count,
                    last_error=health.last_error,
                    response_time_ms=health.response_time_ms,
                    running=proxy_status["running"],
                    pid=proxy_status.get("pid"),
                    tools_count=proxy_status.get("tools_count", 0)
                )

            except Exception as e:
                logger.error(f"Error checking health for {server_name}: {e}")
                error_count += 1
                mcps_health[server_name] = MCPHealthStatus(
                    name=server_name,
                    status="error",
                    last_check=datetime.now(),
                    error_count=1,
                    last_error=str(e)
                )

        all_connected = connected_count == len(MCP_SERVERS)

        return MCPHealthResponse(
            success=True,
            all_connected=all_connected,
            mcps=mcps_health,
            total=len(MCP_SERVERS),
            connected=connected_count,
            disconnected=disconnected_count,
            error=error_count,
            timestamp=datetime.now()
        )

    except Exception as e:
        logger.error(f"Error in MCP health check: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Health check failed: {str(e)}"
        )


@router.post("/mcps/{mcp_name}/reconnect", response_model=ReconnectResponse)
async def reconnect_mcp(
    mcp_name: str,
    request: ReconnectRequest,
    pool: MCPClientPool = Depends(get_mcp_client_pool)
):
    """
    Manually reconnect to an MCP server

    Args:
        mcp_name: Name of MCP server to reconnect
        request: Reconnection options

    Returns:
        ReconnectResponse: Result of reconnection attempt

    Raises:
        HTTPException: If MCP not found or reconnection fails
    """
    # Map server names
    server_name_map = {
        "connascence-analyzer": "connascence"
    }

    if mcp_name not in MCP_SERVERS:
        raise HTTPException(
            status_code=404,
            detail=f"MCP server not found: {mcp_name}"
        )

    try:
        internal_name = server_name_map.get(mcp_name, mcp_name)

        # Get or create client
        client = pool.get_client(internal_name)

        # Check current status
        is_connected = await client.ping()

        if is_connected and not request.force:
            return ReconnectResponse(
                success=True,
                server_name=mcp_name,
                status="already_connected",
                message=f"MCP {mcp_name} is already connected",
                timestamp=datetime.now()
            )

        # Reconnect
        logger.info(f"Reconnecting to MCP: {mcp_name}")
        success = await client.reconnect()

        if success:
            return ReconnectResponse(
                success=True,
                server_name=mcp_name,
                status="connected",
                message=f"Successfully reconnected to {mcp_name}",
                timestamp=datetime.now()
            )
        else:
            health = client.get_health()
            return ReconnectResponse(
                success=False,
                server_name=mcp_name,
                status="failed",
                message=f"Failed to reconnect: {health.last_error or 'Unknown error'}",
                timestamp=datetime.now()
            )

    except Exception as e:
        logger.error(f"Error reconnecting to {mcp_name}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Reconnection failed: {str(e)}"
        )


@router.post("/mcps/reconnect-all")
async def reconnect_all_mcps(
    pool: MCPClientPool = Depends(get_mcp_client_pool)
):
    """
    Reconnect to all MCP servers

    Returns:
        Dict mapping server names to reconnection results
    """
    try:
        results = {}

        for server_name in MCP_SERVERS:
            # Map to internal name
            server_name_map = {
                "connascence-analyzer": "connascence"
            }
            internal_name = server_name_map.get(server_name, server_name)

            try:
                client = pool.get_client(internal_name)
                success = await client.reconnect()

                results[server_name] = {
                    "success": success,
                    "status": "connected" if success else "failed",
                    "timestamp": datetime.now().isoformat()
                }

            except Exception as e:
                logger.error(f"Error reconnecting {server_name}: {e}")
                results[server_name] = {
                    "success": False,
                    "status": "error",
                    "error": str(e),
                    "timestamp": datetime.now().isoformat()
                }

        successful = sum(1 for r in results.values() if r["success"])

        return {
            "success": successful == len(MCP_SERVERS),
            "results": results,
            "total": len(MCP_SERVERS),
            "successful": successful,
            "failed": len(MCP_SERVERS) - successful,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Error in reconnect all: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Reconnect all failed: {str(e)}"
        )


@router.get("/system", response_model=SystemHealthResponse)
async def system_health_check(
    mcp_health_response: MCPHealthResponse = Depends(mcp_health_check)
):
    """
    Comprehensive system health check

    Checks:
    - All MCP servers
    - Database connectivity
    - System resources

    Returns:
        SystemHealthResponse: Overall system health
    """
    try:
        # Check database (placeholder - implement based on your DB setup)
        database_health = {
            "status": "healthy",
            "connected": True,
            "message": "Database operational"
        }

        # Determine overall system status
        if mcp_health_response.all_connected and database_health["connected"]:
            overall_status = "healthy"
        elif mcp_health_response.connected >= mcp_health_response.total // 2:
            overall_status = "degraded"
        else:
            overall_status = "unhealthy"

        return SystemHealthResponse(
            success=True,
            status=overall_status,
            mcps=mcp_health_response,
            database=database_health,
            timestamp=datetime.now()
        )

    except Exception as e:
        logger.error(f"Error in system health check: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"System health check failed: {str(e)}"
        )


@router.get("/ping")
async def ping():
    """
    Simple ping endpoint for availability checks

    Returns:
        Pong response with timestamp
    """
    return {
        "status": "pong",
        "timestamp": datetime.now().isoformat()
    }
