"""
Enhanced MCP Client
Provides connection pooling, retry logic, and health checks for MCP servers
"""

import asyncio
import logging
from typing import Dict, Any, Optional, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class MCPConnectionStatus(str, Enum):
    """MCP connection status"""
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"
    CONNECTING = "connecting"


@dataclass
class MCPConnectionHealth:
    """Health information for MCP connection"""
    status: MCPConnectionStatus
    last_check: datetime
    last_success: Optional[datetime] = None
    error_count: int = 0
    last_error: Optional[str] = None
    response_time_ms: Optional[float] = None


class MCPRetryPolicy:
    """Retry policy for MCP operations"""

    def __init__(
        self,
        max_retries: int = 3,
        initial_delay: float = 0.5,
        max_delay: float = 10.0,
        exponential_base: float = 2.0
    ):
        self.max_retries = max_retries
        self.initial_delay = initial_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base

    def get_delay(self, attempt: int) -> float:
        """Calculate delay for given attempt number"""
        delay = self.initial_delay * (self.exponential_base ** attempt)
        return min(delay, self.max_delay)


class MCPClient:
    """
    Enhanced MCP Client with retry logic and health monitoring

    Features:
    - Exponential backoff retry (3 retries default)
    - Connection health monitoring
    - Timeout handling (10s default)
    - Connection pooling via shared service
    - Health check endpoint support
    """

    def __init__(
        self,
        server_name: str,
        timeout: float = 10.0,
        retry_policy: Optional[MCPRetryPolicy] = None
    ):
        """
        Initialize MCP client

        Args:
            server_name: Name of MCP server to connect to
            timeout: Request timeout in seconds
            retry_policy: Custom retry policy (uses default if None)
        """
        self.server_name = server_name
        self.timeout = timeout
        self.retry_policy = retry_policy or MCPRetryPolicy()
        self.health = MCPConnectionHealth(
            status=MCPConnectionStatus.DISCONNECTED,
            last_check=datetime.now()
        )

        # Import here to avoid circular dependency
        from app.services.mcp_proxy import get_mcp_proxy_service
        self._service = get_mcp_proxy_service()

    async def connect(self) -> bool:
        """
        Connect to MCP server with retry logic

        Returns:
            bool: True if connected successfully
        """
        self.health.status = MCPConnectionStatus.CONNECTING
        self.health.last_check = datetime.now()

        for attempt in range(self.retry_policy.max_retries + 1):
            try:
                logger.info(
                    f"Connecting to {self.server_name} (attempt {attempt + 1}/"
                    f"{self.retry_policy.max_retries + 1})"
                )

                success = await self._service.start_server(self.server_name)

                if success:
                    self.health.status = MCPConnectionStatus.CONNECTED
                    self.health.last_success = datetime.now()
                    self.health.error_count = 0
                    logger.info(f"Connected to {self.server_name}")
                    return True
                else:
                    raise Exception(f"Failed to start {self.server_name}")

            except Exception as e:
                self.health.error_count += 1
                self.health.last_error = str(e)
                logger.warning(
                    f"Connection attempt {attempt + 1} failed for {self.server_name}: {e}"
                )

                # Don't retry on last attempt
                if attempt < self.retry_policy.max_retries:
                    delay = self.retry_policy.get_delay(attempt)
                    logger.info(f"Retrying in {delay:.2f}s...")
                    await asyncio.sleep(delay)
                else:
                    self.health.status = MCPConnectionStatus.ERROR
                    logger.error(f"Failed to connect to {self.server_name} after {attempt + 1} attempts")
                    return False

        return False

    async def disconnect(self) -> bool:
        """
        Disconnect from MCP server

        Returns:
            bool: True if disconnected successfully
        """
        try:
            success = await self._service.stop_server(self.server_name)

            if success:
                self.health.status = MCPConnectionStatus.DISCONNECTED
                logger.info(f"Disconnected from {self.server_name}")
                return True
            else:
                return False

        except Exception as e:
            logger.error(f"Error disconnecting from {self.server_name}: {e}")
            return False

    async def call(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
        timeout: Optional[float] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Call MCP tool with retry logic and timeout

        Args:
            tool_name: Name of tool to call
            arguments: Tool arguments
            timeout: Override default timeout

        Returns:
            Tool result or None if failed
        """
        timeout = timeout or self.timeout
        start_time = datetime.now()

        for attempt in range(self.retry_policy.max_retries + 1):
            try:
                logger.debug(
                    f"Calling {tool_name} on {self.server_name} "
                    f"(attempt {attempt + 1}/{self.retry_policy.max_retries + 1})"
                )

                # Call with timeout
                result = await asyncio.wait_for(
                    self._service.call_tool(tool_name, arguments),
                    timeout=timeout
                )

                # Update health metrics
                elapsed = (datetime.now() - start_time).total_seconds() * 1000
                self.health.response_time_ms = elapsed
                self.health.last_success = datetime.now()
                self.health.error_count = 0

                return result

            except asyncio.TimeoutError:
                self.health.error_count += 1
                self.health.last_error = f"Timeout after {timeout}s"
                logger.warning(
                    f"Tool call timeout for {tool_name} on {self.server_name} "
                    f"(attempt {attempt + 1})"
                )

                if attempt < self.retry_policy.max_retries:
                    delay = self.retry_policy.get_delay(attempt)
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"Tool call failed after {attempt + 1} attempts")
                    return None

            except Exception as e:
                self.health.error_count += 1
                self.health.last_error = str(e)
                logger.error(f"Error calling {tool_name} on {self.server_name}: {e}")

                if attempt < self.retry_policy.max_retries:
                    delay = self.retry_policy.get_delay(attempt)
                    await asyncio.sleep(delay)
                else:
                    return None

        return None

    async def ping(self) -> bool:
        """
        Ping MCP server to check if it's responsive

        Returns:
            bool: True if server responds
        """
        self.health.last_check = datetime.now()

        try:
            # Check if server is in processes
            status = self._service.get_server_status()

            if self.server_name not in status:
                self.health.status = MCPConnectionStatus.DISCONNECTED
                return False

            server_status = status[self.server_name]

            if server_status["running"]:
                self.health.status = MCPConnectionStatus.CONNECTED
                self.health.last_success = datetime.now()
                return True
            else:
                self.health.status = MCPConnectionStatus.DISCONNECTED
                return False

        except Exception as e:
            self.health.status = MCPConnectionStatus.ERROR
            self.health.last_error = str(e)
            logger.error(f"Error pinging {self.server_name}: {e}")
            return False

    def is_connected(self) -> bool:
        """
        Check if client is connected

        Returns:
            bool: True if connected
        """
        return self.health.status == MCPConnectionStatus.CONNECTED

    def get_health(self) -> MCPConnectionHealth:
        """
        Get connection health information

        Returns:
            MCPConnectionHealth: Current health status
        """
        return self.health

    async def reconnect(self) -> bool:
        """
        Reconnect to MCP server

        Returns:
            bool: True if reconnected successfully
        """
        logger.info(f"Reconnecting to {self.server_name}...")

        # Disconnect first if connected
        if self.is_connected():
            await self.disconnect()

        # Wait a bit before reconnecting
        await asyncio.sleep(1.0)

        # Connect with retry logic
        return await self.connect()


class MCPClientPool:
    """
    Connection pool for MCP clients

    Manages multiple MCP client instances with connection reuse
    """

    def __init__(self):
        self.clients: Dict[str, MCPClient] = {}
        self.health_check_interval = 30.0  # seconds
        self._health_check_task: Optional[asyncio.Task] = None

    def get_client(
        self,
        server_name: str,
        timeout: float = 10.0,
        retry_policy: Optional[MCPRetryPolicy] = None
    ) -> MCPClient:
        """
        Get or create MCP client for server

        Args:
            server_name: Name of MCP server
            timeout: Request timeout
            retry_policy: Custom retry policy

        Returns:
            MCPClient: Client instance
        """
        if server_name not in self.clients:
            self.clients[server_name] = MCPClient(
                server_name,
                timeout=timeout,
                retry_policy=retry_policy
            )
            logger.info(f"Created new MCP client for {server_name}")

        return self.clients[server_name]

    async def connect_all(self) -> Dict[str, bool]:
        """
        Connect all clients in pool

        Returns:
            Dict mapping server name to connection success
        """
        results = {}

        for server_name, client in self.clients.items():
            results[server_name] = await client.connect()

        return results

    async def disconnect_all(self) -> Dict[str, bool]:
        """
        Disconnect all clients in pool

        Returns:
            Dict mapping server name to disconnection success
        """
        results = {}

        for server_name, client in self.clients.items():
            results[server_name] = await client.disconnect()

        return results

    async def health_check_all(self) -> Dict[str, MCPConnectionHealth]:
        """
        Check health of all clients

        Returns:
            Dict mapping server name to health status
        """
        health = {}

        for server_name, client in self.clients.items():
            await client.ping()
            health[server_name] = client.get_health()

        return health

    async def start_health_monitoring(self):
        """Start periodic health check monitoring"""
        if self._health_check_task is not None:
            logger.warning("Health monitoring already running")
            return

        async def monitor():
            while True:
                try:
                    await asyncio.sleep(self.health_check_interval)
                    health = await self.health_check_all()

                    # Log unhealthy clients
                    for server_name, health_info in health.items():
                        if health_info.status != MCPConnectionStatus.CONNECTED:
                            logger.warning(
                                f"MCP server {server_name} unhealthy: {health_info.status}"
                            )

                except asyncio.CancelledError:
                    logger.info("Health monitoring stopped")
                    break
                except Exception as e:
                    logger.error(f"Error in health monitoring: {e}")

        self._health_check_task = asyncio.create_task(monitor())
        logger.info("Started health monitoring")

    async def stop_health_monitoring(self):
        """Stop periodic health check monitoring"""
        if self._health_check_task is not None:
            self._health_check_task.cancel()
            try:
                await self._health_check_task
            except asyncio.CancelledError:
                pass
            self._health_check_task = None
            logger.info("Stopped health monitoring")


# Global connection pool
_mcp_client_pool: Optional[MCPClientPool] = None


def get_mcp_client_pool() -> MCPClientPool:
    """Get global MCP client pool instance"""
    global _mcp_client_pool
    if _mcp_client_pool is None:
        _mcp_client_pool = MCPClientPool()
    return _mcp_client_pool
