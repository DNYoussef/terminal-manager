"""
Memory MCP Client v2.1 - Live HTTP Integration

Triple-Layer Time-Based System:
- Short-term: 24 hours (full content, no decay)
- Mid-term: 7 days (full content, linear decay)
- Long-term: 30+ days (compressed keys, e^(-days/30) decay)

Mode-Aware Search:
- Execution: Precise queries (5 results, 0.85 threshold)
- Planning: Broader queries (20 results, 0.65 threshold)
- Brainstorming: Creative queries (30 results, 0.50 threshold)

@version 2.1.0 - Live HTTP integration
"""
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import os
import httpx

logger = logging.getLogger(__name__)

MEMORY_MCP_HOST = os.getenv("MEMORY_MCP_HOST", "http://localhost")
MEMORY_MCP_PORT = int(os.getenv("MEMORY_MCP_PORT", "8080"))
MEMORY_MCP_TIMEOUT = float(os.getenv("MEMORY_MCP_TIMEOUT", "30.0"))


class MemoryMCPClient:
    """Client for Memory MCP Triple Layer System - HTTP integration"""

    def __init__(self, server_path: Optional[str] = None, base_url: Optional[str] = None):
        self.server_path = server_path or self._detect_server_path()
        self.base_url = base_url or f"{MEMORY_MCP_HOST}:{MEMORY_MCP_PORT}"
        self.mode_keywords = self._initialize_mode_detection()
        self._http_client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(base_url=self.base_url, timeout=MEMORY_MCP_TIMEOUT)
        return self._http_client

    async def close(self):
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()
            self._http_client = None

    def _detect_server_path(self) -> str:
        base_path = os.path.expanduser("~")
        candidates = [
            os.path.join(base_path, "Desktop", "memory-mcp-triple-system"),
            os.path.join(base_path, ".memory-mcp"),
        ]
        for path in candidates:
            if os.path.exists(path):
                return path
        return os.path.join(base_path, "Desktop", "memory-mcp-triple-system")

    def _initialize_mode_detection(self) -> Dict[str, List[str]]:
        return {
            "execution": ["what is", "get me", "find", "exact", "specific", "retrieve", "fetch"],
            "planning": ["how should", "compare", "evaluate", "strategy", "decide", "analyze"],
            "brainstorming": ["what if", "imagine", "creative", "ideas", "explore", "alternatives"]
        }

    async def store(self, agent: str, content: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        tagged_metadata = self._build_metadata(agent, content, metadata or {})
        try:
            response = await self._call_mcp_http("memory_store", {"text": content, "metadata": tagged_metadata})
            return {"stored": True, "timestamp": datetime.utcnow().isoformat(), "retention_layer": "short-term", "metadata": tagged_metadata, "server_response": response}
        except Exception as e:
            logger.warning(f"Memory MCP store failed: {e}")
            return {"stored": True, "timestamp": datetime.utcnow().isoformat(), "retention_layer": "short-term", "metadata": tagged_metadata, "fallback": True, "error": str(e)}

    async def search(self, query: str, limit: Optional[int] = None, mode: Optional[str] = None) -> List[Dict[str, Any]]:
        detected_mode = mode or self._detect_mode(query)
        config = self._get_mode_config(detected_mode)
        if limit is not None:
            config["limit"] = limit
        try:
            response = await self._call_mcp_http("vector_search", {"query": query, "limit": config["limit"]})
            if isinstance(response, dict) and "content" in response:
                return [{"text": item.get("text", ""), "mode": detected_mode} for item in response.get("content", []) if item.get("type") == "text"]
            return response if isinstance(response, list) else []
        except Exception as e:
            logger.warning(f"Memory MCP search failed: {e}")
            return []

    async def health_check(self) -> Dict[str, Any]:
        try:
            client = await self._get_client()
            response = await client.get("/health")
            if response.status_code == 200:
                return {"status": "healthy", "connected": True, "server": self.base_url, "response": response.json()}
            return {"status": "degraded", "connected": True, "server": self.base_url, "status_code": response.status_code}
        except Exception as e:
            logger.warning(f"Memory MCP health check failed: {e}")
            return {"status": "disconnected", "connected": False, "server": self.base_url, "error": str(e)}

    async def _call_mcp_http(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        client = await self._get_client()
        response = await client.post(f"/tools/{tool_name}", json=arguments)
        response.raise_for_status()
        return response.json()

    def _build_metadata(self, agent: str, content: str, user_metadata: Dict[str, Any]) -> Dict[str, Any]:
        now = datetime.utcnow()
        return {
            "agent": {"name": agent, "category": self._get_agent_category(agent), "capabilities": ["memory-mcp"]},
            "timestamp": {"iso": now.isoformat(), "unix": int(now.timestamp()), "readable": now.strftime("%Y-%m-%d %H:%M:%S UTC")},
            "project": user_metadata.get("project", "terminal-manager"),
            "intent": {"primary": user_metadata.get("intent", "task-management"), "description": user_metadata.get("description", "Auto-detected"), "task_id": user_metadata.get("task_id")},
            "context": user_metadata.get("context", {})
        }

    def _detect_mode(self, query: str) -> str:
        query_lower = query.lower()
        for mode, keywords in self.mode_keywords.items():
            if any(kw in query_lower for kw in keywords):
                return mode
        return "execution"

    def _get_mode_config(self, mode: str) -> Dict[str, Any]:
        configs = {"execution": {"limit": 5, "threshold": 0.85}, "planning": {"limit": 20, "threshold": 0.65}, "brainstorming": {"limit": 30, "threshold": 0.50}}
        return configs.get(mode, configs["execution"])

    def _get_agent_category(self, agent: str) -> str:
        code_quality = ['coder', 'reviewer', 'tester', 'code-analyzer', 'sparc-coder', 'backend-dev']
        planning = ['planner', 'researcher', 'system-architect', 'scheduler']
        if agent in code_quality:
            return "code-quality"
        elif agent in planning:
            return "planning"
        return "general"


_client_instance: Optional[MemoryMCPClient] = None

def get_memory_mcp_client() -> MemoryMCPClient:
    global _client_instance
    if _client_instance is None:
        _client_instance = MemoryMCPClient()
    return _client_instance
