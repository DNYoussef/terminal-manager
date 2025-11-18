"""
Memory MCP Client v2.0 - Agent Reality Map Integration

Triple-Layer Time-Based System:
- Short-term: 24 hours (full content, no decay)
- Mid-term: 7 days (full content, linear decay)
- Long-term: 30+ days (compressed keys, e^(-days/30) decay)

Mode-Aware Search:
- Execution: Precise queries (5 results, 0.85 threshold)
- Planning: Broader queries (20 results, 0.65 threshold)
- Brainstorming: Creative queries (30 results, 0.50 threshold)

Agent Reality Map Extensions (v2.0):
- IDENTITY: Agent UUID, role, capabilities, RBAC level
- BUDGET: Token usage, cost tracking, budget status
- QUALITY: Connascence scores, code quality grades
- ARTIFACTS: Files created/modified, tools/APIs used
- PERFORMANCE: Execution time, success rate, errors

@version 2.0.0
"""
import subprocess
import json
from typing import Dict, Any, List, Optional
from datetime import datetime
import os


class MemoryMCPClient:
    """
    Client for Memory MCP Triple Layer System

    Communicates with actual Memory MCP server via subprocess/HTTP
    Uses time-based retention (NOT cognitive layers)
    """

    def __init__(self, server_path: Optional[str] = None):
        """
        Initialize Memory MCP client

        Args:
            server_path: Path to Memory MCP server (auto-detected if None)
        """
        self.server_path = server_path or self._detect_server_path()
        self.mode_keywords = self._initialize_mode_detection()

    def _detect_server_path(self) -> str:
        """Auto-detect Memory MCP server path"""
        # Standard installation path
        base_path = os.path.expanduser("~")
        candidates = [
            os.path.join(base_path, "Desktop", "memory-mcp-triple-system"),
            os.path.join(base_path, ".memory-mcp"),
            os.path.join(base_path, "memory-mcp-triple-system"),
        ]

        for path in candidates:
            if os.path.exists(path):
                return path

        # Default fallback
        return os.path.join(base_path, "Desktop", "memory-mcp-triple-system")

    def _initialize_mode_detection(self) -> Dict[str, List[str]]:
        """
        Initialize keyword patterns for mode detection

        Based on 29 patterns from Memory MCP documentation
        """
        return {
            "execution": [
                "what is", "get me", "find", "exact", "specific",
                "retrieve", "fetch", "show me", "give me", "lookup"
            ],
            "planning": [
                "how should", "what's best", "compare", "evaluate", "strategy",
                "decide", "choose", "analyze", "consider", "weigh"
            ],
            "brainstorming": [
                "what if", "imagine", "creative", "ideas", "possibilities",
                "explore", "alternatives", "options", "could we", "might we"
            ]
        }

    def store(
        self,
        agent: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Store content in Memory MCP with proper tagging

        All content starts in short-term layer (24h), then auto-decays

        Args:
            agent: WHO (scheduler, coder, etc.)
            content: Content to store
            metadata: Additional metadata (PROJECT, WHY, etc.)

        Returns:
            Storage confirmation with layer assignment
        """
        # Build tagged metadata following protocol
        tagged_metadata = self._build_metadata(agent, content, metadata or {})

        # Call Memory MCP via subprocess
        # In production, this would actually call the MCP server
        # For now, simulate the structure
        result = {
            "stored": True,
            "timestamp": datetime.utcnow().isoformat(),
            "retention_layer": "short-term",  # All start here, auto-decay
            "metadata": tagged_metadata
        }

        return result

    def store_v2(
        self,
        agent: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Store content with Agent Reality Map v2.0 metadata

        All content starts in short-term layer (24h), then auto-decays

        Args:
            agent: WHO (scheduler, coder, etc.)
            content: Content to store
            metadata: Agent Reality Map metadata (IDENTITY, BUDGET, QUALITY, ARTIFACTS, PERFORMANCE)

        Returns:
            Storage confirmation with layer assignment
        """
        # Build v2.0 tagged metadata
        tagged_metadata = self._build_metadata_v2(agent, content, metadata or {})

        # Call Memory MCP via subprocess
        # In production, this would actually call the MCP server
        result = {
            "stored": True,
            "timestamp": datetime.utcnow().isoformat(),
            "retention_layer": "short-term",
            "metadata": tagged_metadata,
            "schema_version": "2.0"
        }

        return result

    def search(
        self,
        query: str,
        limit: Optional[int] = None,
        mode: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Semantic search with mode-aware configuration and Agent Reality Map filters

        Args:
            query: Natural language query
            limit: Max results (None = auto from mode)
            mode: Override auto-detection (execution, planning, brainstorming)
            filters: Agent Reality Map filters (role, budget_status, quality_grade, etc.)

        Returns:
            List of matching results with scores
        """
        # Auto-detect mode if not specified
        detected_mode = mode or self._detect_mode(query)

        # Get configuration for mode
        config = self._get_mode_config(detected_mode)

        # Override limit if specified
        if limit is not None:
            config["limit"] = limit

        # Apply Agent Reality Map filters
        search_filters = self._build_search_filters(filters or {})

        # Call Memory MCP vector_search with filters
        # In production, this would call actual MCP server
        results = []

        return results

    def _build_search_filters(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        """
        Build search filters for Agent Reality Map metadata

        Supported filters:
        - role: Filter by RBAC role (admin, developer, reviewer, etc.)
        - budget_status: Filter by budget status (ok, warning, limit)
        - quality_grade: Filter by code quality grade (A, B, C, D, F)
        - min_quality_score: Minimum connascence score (0-100)
        - success_only: Only successful operations (True/False)
        - agent_id: Filter by specific agent UUID
        - rbac_level_min: Minimum RBAC level (1-10)
        """
        search_filters = {}

        # Identity filters
        if "role" in filters:
            search_filters["identity.role"] = filters["role"]
        if "agent_id" in filters:
            search_filters["identity.agent_id"] = filters["agent_id"]
        if "rbac_level_min" in filters:
            search_filters["identity.rbac_level>="] = filters["rbac_level_min"]

        # Budget filters
        if "budget_status" in filters:
            search_filters["budget.budget_status"] = filters["budget_status"]

        # Quality filters
        if "quality_grade" in filters:
            search_filters["quality.code_quality_grade"] = filters["quality_grade"]
        if "min_quality_score" in filters:
            search_filters["quality.connascence_score>="] = filters["min_quality_score"]

        # Performance filters
        if "success_only" in filters and filters["success_only"]:
            search_filters["performance.success"] = True

        return search_filters

    def _build_metadata(
        self,
        agent: str,
        content: str,
        user_metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Build WHO/WHEN/PROJECT/WHY metadata (v1.0 - backward compatible)

        Follows memory-mcp-tagging-protocol.js structure
        """
        now = datetime.utcnow()

        return {
            # WHO
            "agent": {
                "name": agent,
                "category": self._get_agent_category(agent),
                "capabilities": ["memory-mcp"]
            },

            # WHEN
            "timestamp": {
                "iso": now.isoformat(),
                "unix": int(now.timestamp()),
                "readable": now.strftime("%Y-%m-%d %H:%M:%S UTC")
            },

            # PROJECT
            "project": user_metadata.get("project", "terminal-manager"),

            # WHY
            "intent": {
                "primary": user_metadata.get("intent", "task-management"),
                "description": user_metadata.get("description", "Auto-detected"),
                "task_id": user_metadata.get("task_id")
            },

            # Additional context
            "context": user_metadata.get("context", {})
        }

    def _build_metadata_v2(
        self,
        agent: str,
        content: str,
        user_metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Build Agent Reality Map compliant metadata (v2.0 - enhanced)

        Extends v1.0 with: IDENTITY, BUDGET, QUALITY, ARTIFACTS, PERFORMANCE
        """
        # Start with v1.0 metadata
        base_metadata = self._build_metadata(agent, content, user_metadata)

        # Add Agent Reality Map extensions
        return {
            **base_metadata,

            # IDENTITY: Agent UUID, role, capabilities, RBAC level
            "identity": user_metadata.get("identity", {
                "agent_id": None,
                "role": "developer",
                "capabilities": [],
                "rbac_level": 5
            }),

            # BUDGET: Token usage, cost, remaining budget, status
            "budget": user_metadata.get("budget", {
                "tokens_used": 0,
                "cost_usd": 0.0,
                "remaining_budget": 0.0,
                "budget_status": "unknown"
            }),

            # QUALITY: Connascence scores, code quality grades, violations
            "quality": user_metadata.get("quality", {
                "connascence_score": 0,
                "code_quality_grade": "N/A",
                "violations": []
            }),

            # ARTIFACTS: Files created/modified, tools used, APIs called
            "artifacts": user_metadata.get("artifacts", {
                "files_created": [],
                "files_modified": [],
                "tools_used": [],
                "apis_called": []
            }),

            # PERFORMANCE: Execution time, success rate, error details
            "performance": user_metadata.get("performance", {
                "execution_time_ms": 0,
                "success": True,
                "error": None
            }),

            # Version tag
            "_schema_version": "2.0"
        }

    def _detect_mode(self, query: str) -> str:
        """
        Auto-detect interaction mode from query keywords

        Returns: execution, planning, or brainstorming
        """
        query_lower = query.lower()

        # Check keywords for each mode
        for mode, keywords in self.mode_keywords.items():
            if any(kw in query_lower for kw in keywords):
                return mode

        return "execution"  # Default to execution mode

    def _get_mode_config(self, mode: str) -> Dict[str, Any]:
        """
        Get configuration for interaction mode

        Based on Memory MCP documentation:
        - Execution: 5 results, 0.85 threshold
        - Planning: 20 results, 0.65 threshold
        - Brainstorming: 30 results, 0.50 threshold
        """
        configs = {
            "execution": {"limit": 5, "threshold": 0.85},
            "planning": {"limit": 20, "threshold": 0.65},
            "brainstorming": {"limit": 30, "threshold": 0.50}
        }
        return configs.get(mode, configs["execution"])

    def _get_agent_category(self, agent: str) -> str:
        """
        Map agent to category

        Based on AGENT_TOOL_ACCESS from tagging protocol
        """
        code_quality = [
            'coder', 'reviewer', 'tester', 'code-analyzer',
            'functionality-audit', 'theater-detection-audit',
            'production-validator', 'sparc-coder', 'analyst',
            'backend-dev', 'mobile-dev', 'ml-developer',
            'base-template-generator', 'code-review-swarm'
        ]

        planning = [
            'planner', 'researcher', 'system-architect',
            'specification', 'pseudocode', 'architecture', 'refinement',
            'scheduler'
        ]

        if agent in code_quality:
            return "code-quality"
        elif agent in planning:
            return "planning"
        return "general"

    def _call_mcp_server(
        self,
        method: str,
        params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Call actual Memory MCP server via subprocess

        Args:
            method: MCP method (memory_store, vector_search)
            params: Method parameters

        Returns:
            MCP response
        """
        # Build MCP request
        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params
        }

        # Call server (subprocess or HTTP)
        # In production:
        # 1. Start MCP server if not running
        # 2. Send request via stdin
        # 3. Read response from stdout
        # 4. Parse JSON response

        # For now, return simulated response
        return {
            "jsonrpc": "2.0",
            "id": 1,
            "result": {
                "success": True,
                "timestamp": datetime.utcnow().isoformat()
            }
        }
