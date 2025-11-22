"""
MCP Proxy Service
Manages stdio connections to MCP servers (memory-mcp, claude-flow, connascence-analyzer)
"""

import asyncio
import json
import logging
import uuid
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum

from app.config import config

logger = logging.getLogger(__name__)


class MCPServerType(str, Enum):
    """MCP Server types"""
    MEMORY = "memory-mcp"
    CLAUDE_FLOW = "claude-flow"
    CONNASCENCE = "connascence-analyzer"


@dataclass
class MCPServerConfig:
    """Configuration for an MCP server"""
    name: str
    type: MCPServerType
    command: List[str]
    description: str
    enabled: bool = True


@dataclass
class MCPTool:
    """MCP Tool definition"""
    name: str
    description: str
    inputSchema: Dict[str, Any]
    server: str  # Which MCP server provides this tool


class MCPProxyService:
    """
    MCP Proxy Service

    Manages connections to multiple MCP servers via stdio
    and proxies tool calls from the frontend.
    """

    def __init__(self):
        self.servers: Dict[str, MCPServerConfig] = {}
        self.processes: Dict[str, asyncio.subprocess.Process] = {}
        self.tools_cache: Dict[str, List[MCPTool]] = {}
        self.request_counter = 0

        # Configure available MCP servers
        self._configure_servers()

    def _configure_servers(self):
        """Configure available MCP servers"""

        python_exec = config.PYTHON_EXECUTABLE

        memory_default = [python_exec, "-m", "memory_mcp.server"]
        claude_default = ["npx", "claude-flow@alpha", "mcp", "start"]
        connascence_default = [python_exec, "-m", "connascence_analyzer.mcp_server"]

        # Memory MCP Server
        self.servers["memory-mcp"] = MCPServerConfig(
            name="memory-mcp",
            type=MCPServerType.MEMORY,
            command=config.get_mcp_command("MCP_MEMORY_CMD", memory_default),
            description="Memory MCP - Vector search and semantic memory storage",
            enabled=True
        )

        # Claude Flow MCP Server
        self.servers["claude-flow"] = MCPServerConfig(
            name="claude-flow",
            type=MCPServerType.CLAUDE_FLOW,
            command=config.get_mcp_command("MCP_CLAUDE_FLOW_CMD", claude_default),
            description="Claude Flow - Swarm coordination and task orchestration",
            enabled=True
        )

        # Connascence Analyzer MCP Server
        self.servers["connascence"] = MCPServerConfig(
            name="connascence",
            type=MCPServerType.CONNASCENCE,
            command=config.get_mcp_command("MCP_CONNASCENCE_CMD", connascence_default),
            description="Connascence Analyzer - Code quality and coupling detection",
            enabled=True
        )

    async def start_server(self, server_name: str) -> bool:
        """
        Start an MCP server process

        Args:
            server_name: Name of server to start

        Returns:
            bool: True if started successfully
        """
        if server_name not in self.servers:
            logger.error(f"Unknown MCP server: {server_name}")
            return False

        config = self.servers[server_name]

        if not config.enabled:
            logger.warning(f"MCP server disabled: {server_name}")
            return False

        # Check if already running
        if server_name in self.processes:
            process = self.processes[server_name]
            if process.returncode is None:  # Still running
                logger.info(f"MCP server already running: {server_name}")
                return True

        try:
            # Start process with stdio pipes
            process = await asyncio.create_subprocess_exec(
                *config.command,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            self.processes[server_name] = process
            logger.info(f"Started MCP server: {server_name} (PID: {process.pid})")

            # Initialize connection (send initialize request)
            initialized = await self._initialize_server(server_name)
            if not initialized:
                logger.error(f"Failed to initialize MCP server: {server_name}")
                await self.stop_server(server_name)
                return False

            # Fetch available tools
            await self._fetch_tools(server_name)

            return True

        except FileNotFoundError as e:
            logger.error(f"MCP server command not found: {config.command[0]}: {e}")
            return False
        except Exception as e:
            logger.error(f"Error starting MCP server {server_name}: {e}", exc_info=True)
            return False

    async def stop_server(self, server_name: str) -> bool:
        """
        Stop an MCP server process

        Args:
            server_name: Name of server to stop

        Returns:
            bool: True if stopped successfully
        """
        if server_name not in self.processes:
            return True

        process = self.processes[server_name]

        try:
            # Graceful shutdown
            process.terminate()

            # Wait for termination (max 5 seconds)
            try:
                await asyncio.wait_for(process.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                # Force kill
                process.kill()
                await process.wait()

            del self.processes[server_name]
            logger.info(f"Stopped MCP server: {server_name}")
            return True

        except Exception as e:
            logger.error(f"Error stopping MCP server {server_name}: {e}", exc_info=True)
            return False

    async def _initialize_server(self, server_name: str) -> bool:
        """
        Send initialize request to MCP server

        Args:
            server_name: Name of server to initialize

        Returns:
            bool: True if initialized successfully
        """
        request = {
            "jsonrpc": "2.0",
            "id": self._next_request_id(),
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {
                    "name": "terminal-manager",
                    "version": "1.0.0"
                }
            }
        }

        try:
            response = await self._send_request(server_name, request)

            if response and "result" in response:
                logger.info(f"Initialized MCP server: {server_name}")
                return True
            else:
                logger.error(f"Initialize failed for {server_name}: {response}")
                return False

        except Exception as e:
            logger.error(f"Error initializing {server_name}: {e}", exc_info=True)
            return False

    async def _fetch_tools(self, server_name: str) -> List[MCPTool]:
        """
        Fetch available tools from MCP server

        Args:
            server_name: Name of server

        Returns:
            List of MCPTool objects
        """
        request = {
            "jsonrpc": "2.0",
            "id": self._next_request_id(),
            "method": "tools/list",
            "params": {}
        }

        try:
            response = await self._send_request(server_name, request)

            if response and "result" in response and "tools" in response["result"]:
                tools_data = response["result"]["tools"]

                tools = [
                    MCPTool(
                        name=tool["name"],
                        description=tool.get("description", ""),
                        inputSchema=tool.get("inputSchema", {}),
                        server=server_name
                    )
                    for tool in tools_data
                ]

                self.tools_cache[server_name] = tools
                logger.info(f"Fetched {len(tools)} tools from {server_name}")
                return tools
            else:
                logger.warning(f"No tools found for {server_name}")
                return []

        except Exception as e:
            logger.error(f"Error fetching tools from {server_name}: {e}", exc_info=True)
            return []

    async def _send_request(
        self,
        server_name: str,
        request: Dict[str, Any],
        timeout: float = 30.0
    ) -> Optional[Dict[str, Any]]:
        """
        Send JSON-RPC request to MCP server via stdio

        Args:
            server_name: Name of server
            request: JSON-RPC request dict
            timeout: Request timeout in seconds

        Returns:
            JSON-RPC response dict or None if failed
        """
        if server_name not in self.processes:
            logger.error(f"MCP server not running: {server_name}")
            return None

        process = self.processes[server_name]

        if process.stdin is None or process.stdout is None:
            logger.error(f"Process pipes not available for {server_name}")
            return None

        try:
            # Send request (JSON-RPC over stdio)
            request_json = json.dumps(request) + "\n"
            process.stdin.write(request_json.encode('utf-8'))
            await process.stdin.drain()

            # Read response (with timeout)
            response_line = await asyncio.wait_for(
                process.stdout.readline(),
                timeout=timeout
            )

            if not response_line:
                logger.error(f"Empty response from {server_name}")
                return None

            response = json.loads(response_line.decode('utf-8'))
            return response

        except asyncio.TimeoutError:
            logger.error(f"Request timeout for {server_name}")
            return None
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON from {server_name}: {e}")
            return None
        except Exception as e:
            logger.error(f"Error sending request to {server_name}: {e}", exc_info=True)
            return None

    async def call_tool(
        self,
        tool_name: str,
        arguments: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Call an MCP tool

        Args:
            tool_name: Name of tool to call
            arguments: Tool arguments

        Returns:
            Tool result or None if failed
        """
        # Find which server provides this tool
        server_name = None
        for srv, tools in self.tools_cache.items():
            if any(tool.name == tool_name for tool in tools):
                server_name = srv
                break

        if not server_name:
            logger.error(f"Tool not found: {tool_name}")
            return None

        request = {
            "jsonrpc": "2.0",
            "id": self._next_request_id(),
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            }
        }

        try:
            response = await self._send_request(server_name, request)

            if response and "result" in response:
                return response["result"]
            elif response and "error" in response:
                logger.error(f"Tool call error: {response['error']}")
                return None
            else:
                logger.error(f"Invalid tool response: {response}")
                return None

        except Exception as e:
            logger.error(f"Error calling tool {tool_name}: {e}", exc_info=True)
            return None

    def get_all_tools(self) -> List[MCPTool]:
        """
        Get all available tools from all servers

        Returns:
            List of all MCPTool objects
        """
        all_tools = []
        for tools in self.tools_cache.values():
            all_tools.extend(tools)
        return all_tools

    def get_server_status(self) -> Dict[str, Dict[str, Any]]:
        """
        Get status of all MCP servers

        Returns:
            Dict mapping server name to status info
        """
        status = {}

        for server_name, config in self.servers.items():
            is_running = False
            pid = None

            if server_name in self.processes:
                process = self.processes[server_name]
                is_running = process.returncode is None
                pid = process.pid if is_running else None

            status[server_name] = {
                "name": server_name,
                "type": config.type.value,
                "description": config.description,
                "enabled": config.enabled,
                "running": is_running,
                "pid": pid,
                "tools_count": len(self.tools_cache.get(server_name, []))
            }

        return status

    def _next_request_id(self) -> int:
        """Generate next request ID"""
        self.request_counter += 1
        return self.request_counter


# Global singleton
_mcp_proxy_service: Optional[MCPProxyService] = None


def get_mcp_proxy_service() -> MCPProxyService:
    """Get global MCPProxyService instance"""
    global _mcp_proxy_service
    if _mcp_proxy_service is None:
        _mcp_proxy_service = MCPProxyService()
    return _mcp_proxy_service
