"""
MCP Health Test Script
Quick verification of MCP integration and health endpoints
"""

import asyncio
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.mcp_client import MCPClient, get_mcp_client_pool
from app.services.mcp_proxy import get_mcp_proxy_service


async def test_mcp_proxy_service():
    """Test MCP Proxy Service"""
    print("\n" + "="*60)
    print("Testing MCP Proxy Service")
    print("="*60)

    service = get_mcp_proxy_service()

    # Get server status
    print("\nConfigured MCP Servers:")
    status = service.get_server_status()
    for name, info in status.items():
        print(f"  - {name}: {info['type']} ({info['description']})")
        print(f"    Enabled: {info['enabled']}, Running: {info['running']}")

    return service


async def test_memory_mcp(service):
    """Test Memory MCP connection and tools"""
    print("\n" + "="*60)
    print("Testing Memory MCP")
    print("="*60)

    server_name = "memory-mcp"

    try:
        print(f"\nStarting {server_name}...")
        success = await service.start_server(server_name)

        if success:
            print(f"[OK] {server_name} started successfully")

            # Get tools
            tools = service.tools_cache.get(server_name, [])
            print(f"\nAvailable tools ({len(tools)}):")
            for tool in tools:
                print(f"  - {tool.name}: {tool.description}")

            # Test tool call
            print(f"\nTesting memory_store tool...")
            result = await service.call_tool(
                "memory_store",
                {
                    "text": "Test memory from health check script",
                    "metadata": {
                        "test": True,
                        "source": "test_mcp_health.py"
                    }
                }
            )

            if result:
                print(f"[OK] memory_store succeeded: {result}")
            else:
                print("[FAIL] memory_store failed")

            # Stop server
            await service.stop_server(server_name)
            print(f"[OK] {server_name} stopped")
        else:
            print(f"[FAIL] Failed to start {server_name}")

    except Exception as e:
        print(f"[ERROR] Error testing {server_name}: {e}")


async def test_connascence_analyzer(service):
    """Test Connascence Analyzer connection and tools"""
    print("\n" + "="*60)
    print("Testing Connascence Analyzer")
    print("="*60)

    server_name = "connascence"

    try:
        print(f"\nStarting {server_name}...")
        success = await service.start_server(server_name)

        if success:
            print(f"[OK] {server_name} started successfully")

            # Get tools
            tools = service.tools_cache.get(server_name, [])
            print(f"\nAvailable tools ({len(tools)}):")
            for tool in tools:
                print(f"  - {tool.name}: {tool.description}")

            # Stop server
            await service.stop_server(server_name)
            print(f"[OK] {server_name} stopped")
        else:
            print(f"[FAIL] Failed to start {server_name}")
            print("  Note: This is expected if Connascence Analyzer is not installed")

    except Exception as e:
        print(f"[ERROR] Error testing {server_name}: {e}")


async def test_claude_flow(service):
    """Test Claude Flow connection and tools"""
    print("\n" + "="*60)
    print("Testing Claude Flow")
    print("="*60)

    server_name = "claude-flow"

    try:
        print(f"\nStarting {server_name}...")
        success = await service.start_server(server_name)

        if success:
            print(f"[OK] {server_name} started successfully")

            # Get tools
            tools = service.tools_cache.get(server_name, [])
            print(f"\nAvailable tools ({len(tools)}):")
            for tool in tools:
                print(f"  - {tool.name}: {tool.description}")

            # Stop server
            await service.stop_server(server_name)
            print(f"[OK] {server_name} stopped")
        else:
            print(f"[FAIL] Failed to start {server_name}")
            print("  Note: This is expected if Claude Flow is not installed")

    except Exception as e:
        print(f"[ERROR] Error testing {server_name}: {e}")


async def test_mcp_client_with_retry():
    """Test MCP Client with retry logic"""
    print("\n" + "="*60)
    print("Testing MCP Client with Retry Logic")
    print("="*60)

    client = MCPClient('memory-mcp', timeout=10.0)

    print("\nConnecting to memory-mcp with retry...")
    success = await client.connect()

    if success:
        print("[OK] Connected successfully")

        # Check health
        health = client.get_health()
        print(f"\nHealth Status:")
        print(f"  Status: {health.status}")
        print(f"  Last Check: {health.last_check}")
        print(f"  Last Success: {health.last_success}")
        print(f"  Error Count: {health.error_count}")

        # Ping
        print("\nPinging server...")
        is_alive = await client.ping()
        print(f"  Ping: {'[OK]' if is_alive else '[FAIL]'}")

        # Disconnect
        await client.disconnect()
        print("[OK] Disconnected")
    else:
        print("[FAIL] Failed to connect")


async def test_connection_pool():
    """Test MCP Connection Pool"""
    print("\n" + "="*60)
    print("Testing MCP Connection Pool")
    print("="*60)

    pool = get_mcp_client_pool()

    # Get clients
    print("\nGetting clients from pool...")
    client1 = pool.get_client('memory-mcp')
    client2 = pool.get_client('memory-mcp')

    print(f"  Client 1: {id(client1)}")
    print(f"  Client 2: {id(client2)}")
    print(f"  Same instance: {'[OK] Yes' if client1 is client2 else '[FAIL] No'}")

    # Connect all
    print("\nConnecting all clients in pool...")
    results = await pool.connect_all()

    for server_name, success in results.items():
        print(f"  {server_name}: {'[OK] Connected' if success else '[FAIL] Failed'}")

    # Health check all
    print("\nHealth check for all clients...")
    health_status = await pool.health_check_all()

    for server_name, health in health_status.items():
        print(f"  {server_name}:")
        print(f"    Status: {health.status}")
        print(f"    Error Count: {health.error_count}")

    # Disconnect all
    print("\nDisconnecting all clients...")
    await pool.disconnect_all()
    print("[OK] All disconnected")


async def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("MCP Integration Health Check")
    print("="*60)

    try:
        # Test proxy service
        service = await test_mcp_proxy_service()

        # Test individual MCPs
        await test_memory_mcp(service)
        await test_connascence_analyzer(service)
        await test_claude_flow(service)

        # Test client with retry
        await test_mcp_client_with_retry()

        # Test connection pool
        await test_connection_pool()

        print("\n" + "="*60)
        print("All tests completed!")
        print("="*60)

    except Exception as e:
        print(f"\n[FATAL] Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
