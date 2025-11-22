import os
import sys
from pathlib import Path

import pytest

from app.services.mcp_proxy import MCPProxyService


@pytest.mark.asyncio
async def test_start_server_with_stub(monkeypatch):
    stub_path = Path(__file__).resolve().parents[1] / "scripts" / "mcp_stub_server.py"
    monkeypatch.setenv("MCP_MEMORY_CMD", f"{sys.executable} {stub_path}")

    service = MCPProxyService()

    try:
        started = await service.start_server("memory-mcp")
        assert started is True
    finally:
        await service.stop_server("memory-mcp")
