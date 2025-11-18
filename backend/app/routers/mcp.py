"""
MCP Router
Endpoints for MCP proxy - list tools and call them
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional
import logging

from app.services.mcp_proxy import get_mcp_proxy_service, MCPProxyService, MCPTool

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mcp", tags=["mcp"])


# Pydantic models
class ToolResponse(BaseModel):
    """Tool definition response"""
    name: str
    description: str
    inputSchema: Dict[str, Any]
    server: str


class ToolsListResponse(BaseModel):
    """Response for tools list endpoint"""
    success: bool
    count: int
    tools: List[ToolResponse]


class CallToolRequest(BaseModel):
    """Request to call an MCP tool"""
    tool_name: str = Field(..., description="Name of tool to call")
    arguments: Dict[str, Any] = Field(default_factory=dict, description="Tool arguments")


class CallToolResponse(BaseModel):
    """Response from calling an MCP tool"""
    success: bool
    tool_name: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class ServerStatus(BaseModel):
    """MCP Server status"""
    name: str
    type: str
    description: str
    enabled: bool
    running: bool
    pid: Optional[int]
    tools_count: int


class StatusResponse(BaseModel):
    """Response for status endpoint"""
    success: bool
    servers: Dict[str, ServerStatus]


class StartServerRequest(BaseModel):
    """Request to start MCP server"""
    server_name: str = Field(..., description="Name of server to start")


class StartServerResponse(BaseModel):
    """Response from starting server"""
    success: bool
    server_name: str
    message: str


@router.get("/tools", response_model=ToolsListResponse)
async def list_tools(
    mcp_service: MCPProxyService = Depends(get_mcp_proxy_service)
):
    """
    List all available MCP tools from all servers

    Returns all tools with their schemas from connected MCP servers.
    Tools can be called using the /mcp/call endpoint.

    Returns:
        ToolsListResponse: List of all available tools
    """
    try:
        # Get all tools from cache
        all_tools = mcp_service.get_all_tools()

        tools_response = [
            ToolResponse(
                name=tool.name,
                description=tool.description,
                inputSchema=tool.inputSchema,
                server=tool.server
            )
            for tool in all_tools
        ]

        logger.info(f"Listed {len(tools_response)} MCP tools")

        return ToolsListResponse(
            success=True,
            count=len(tools_response),
            tools=tools_response
        )

    except Exception as e:
        logger.error(f"Error listing MCP tools: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to list MCP tools")


@router.post("/call", response_model=CallToolResponse)
async def call_tool(
    request: CallToolRequest,
    mcp_service: MCPProxyService = Depends(get_mcp_proxy_service)
):
    """
    Call an MCP tool

    Executes a tool call on the appropriate MCP server
    and returns the result.

    Args:
        request: Tool call request with name and arguments

    Returns:
        CallToolResponse: Tool execution result

    Raises:
        HTTPException: If tool not found or execution fails
    """
    try:
        logger.info(f"Calling MCP tool: {request.tool_name}")

        result = await mcp_service.call_tool(
            tool_name=request.tool_name,
            arguments=request.arguments
        )

        if result is not None:
            return CallToolResponse(
                success=True,
                tool_name=request.tool_name,
                result=result
            )
        else:
            return CallToolResponse(
                success=False,
                tool_name=request.tool_name,
                error="Tool call failed or returned no result"
            )

    except Exception as e:
        logger.error(f"Error calling MCP tool {request.tool_name}: {e}", exc_info=True)
        return CallToolResponse(
            success=False,
            tool_name=request.tool_name,
            error=str(e)
        )


@router.get("/status", response_model=StatusResponse)
async def get_status(
    mcp_service: MCPProxyService = Depends(get_mcp_proxy_service)
):
    """
    Get status of all MCP servers

    Returns information about each MCP server including
    whether it's running, PID, and tools count.

    Returns:
        StatusResponse: Status of all MCP servers
    """
    try:
        status_data = mcp_service.get_server_status()

        servers_status = {
            name: ServerStatus(**info)
            for name, info in status_data.items()
        }

        logger.debug(f"Retrieved MCP server status: {len(servers_status)} servers")

        return StatusResponse(
            success=True,
            servers=servers_status
        )

    except Exception as e:
        logger.error(f"Error getting MCP status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get MCP status")


@router.post("/servers/{server_name}/start", response_model=StartServerResponse)
async def start_server(
    server_name: str,
    mcp_service: MCPProxyService = Depends(get_mcp_proxy_service)
):
    """
    Start an MCP server

    Starts the specified MCP server process and initializes
    the connection.

    Args:
        server_name: Name of server to start

    Returns:
        StartServerResponse: Start result

    Raises:
        HTTPException: If server not found or start fails
    """
    try:
        success = await mcp_service.start_server(server_name)

        if success:
            logger.info(f"Started MCP server: {server_name}")
            return StartServerResponse(
                success=True,
                server_name=server_name,
                message=f"Server {server_name} started successfully"
            )
        else:
            logger.error(f"Failed to start MCP server: {server_name}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to start server {server_name}"
            )

    except Exception as e:
        logger.error(f"Error starting MCP server {server_name}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error starting server {server_name}: {str(e)}"
        )


@router.post("/servers/{server_name}/stop", response_model=StartServerResponse)
async def stop_server(
    server_name: str,
    mcp_service: MCPProxyService = Depends(get_mcp_proxy_service)
):
    """
    Stop an MCP server

    Gracefully stops the specified MCP server process.

    Args:
        server_name: Name of server to stop

    Returns:
        StartServerResponse: Stop result

    Raises:
        HTTPException: If server not found or stop fails
    """
    try:
        success = await mcp_service.stop_server(server_name)

        if success:
            logger.info(f"Stopped MCP server: {server_name}")
            return StartServerResponse(
                success=True,
                server_name=server_name,
                message=f"Server {server_name} stopped successfully"
            )
        else:
            logger.error(f"Failed to stop MCP server: {server_name}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to stop server {server_name}"
            )

    except Exception as e:
        logger.error(f"Error stopping MCP server {server_name}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error stopping server {server_name}: {str(e)}"
        )
