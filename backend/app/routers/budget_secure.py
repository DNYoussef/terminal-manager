"""
Secure Budget Router - Fixed Command Injection Vulnerability
Uses temp JSON file for data passing instead of inline code
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, validator
from typing import Dict, Any, Optional
from datetime import datetime
import subprocess
import json
import os
import tempfile
import re

router = APIRouter()

# ============================================================================
# INPUT VALIDATION
# ============================================================================

def validate_agent_id(agent_id: str) -> str:
    """
    Validate agent_id to prevent injection
    Only allow alphanumeric, hyphens, and underscores
    """
    if not re.match(r'^[a-zA-Z0-9\-_]+$', agent_id):
        raise ValueError(f"Invalid agent_id format: {agent_id}")
    if len(agent_id) > 64:
        raise ValueError("agent_id too long (max 64 chars)")
    return agent_id

def validate_method(method: str) -> str:
    """Validate method name against whitelist"""
    valid_methods = ['checkBudget', 'deduct', 'getStatus', 'reset', 'initBudget']
    if method not in valid_methods:
        raise ValueError(f"Invalid method: {method}")
    return method

# ============================================================================
# MODELS (with validation)
# ============================================================================

class BudgetCheckRequest(BaseModel):
    agent_id: str = Field(..., description="Agent identifier")
    estimated_tokens: int = Field(default=10000, ge=0, le=10000000)
    estimated_cost: float = Field(default=0.01, ge=0, le=100)

    @validator('agent_id')
    def validate_agent(cls, v):
        return validate_agent_id(v)

class BudgetDeductRequest(BaseModel):
    agent_id: str = Field(..., description="Agent identifier")
    tokens_used: int = Field(..., ge=0, le=10000000)
    cost: float = Field(..., ge=0, le=100)

    @validator('agent_id')
    def validate_agent(cls, v):
        return validate_agent_id(v)

# ... (other models)

# ============================================================================
# SECURE BUDGET TRACKER CALLER
# ============================================================================

def get_budget_tracker_path():
    """Get validated path to budget-tracker.js"""
    base_path = os.path.abspath(os.path.join(
        os.path.dirname(__file__),
        "..", "..", "..", ".."  # Go up 4 levels to reach C:\Users\17175
    ))

    tracker_relative = os.path.join(
        "claude-code-plugins", "ruv-sparc-three-loop-system",
        "hooks", "12fa", "budget-tracker.js"
    )

    tracker_path = os.path.abspath(os.path.join(base_path, tracker_relative))

    # CRITICAL: Validate path is within allowed directory
    if not tracker_path.startswith(base_path):
        raise ValueError("Path traversal detected!")

    if not os.path.exists(tracker_path):
        raise FileNotFoundError(f"Budget tracker not found: {tracker_path}")

    return tracker_path

def call_budget_tracker_secure(method: str, agent_id: str, params: Optional[Dict] = None):
    """
    SECURE: Call budget-tracker.js via temp JSON file

    Security measures:
    1. Input validation (whitelist method, sanitize agent_id)
    2. Temp JSON file (no string interpolation)
    3. Subprocess timeout (5s)
    4. Path validation (prevent traversal)
    """
    # Validate inputs
    method = validate_method(method)
    agent_id = validate_agent_id(agent_id)

    tracker_path = get_budget_tracker_path()

    # Create temp JSON file with parameters
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json') as f:
        json.dump({
            'method': method,
            'agentId': agent_id,
            'params': params or {}
        }, f)
        temp_file = f.name

    try:
        # Secure Node.js command (no user input in -e code!)
        cmd = [
            'node',
            '-e',
            f"""
            const fs = require('fs');
            const tracker = require('{tracker_path.replace(chr(92), chr(92)+chr(92))}');
            const data = JSON.parse(fs.readFileSync('{temp_file.replace(chr(92), chr(92)+chr(92))}', 'utf8'));

            let result;
            if (data.method === 'checkBudget') {{
                result = tracker.checkBudget(data.agentId, data.params);
            }} else if (data.method === 'deduct') {{
                result = tracker.deduct(data.agentId, data.params);
            }} else if (data.method === 'getStatus') {{
                result = tracker.getStatus(data.agentId);
            }} else if (data.method === 'reset') {{
                result = tracker.reset(data.agentId);
            }} else if (data.method === 'initBudget') {{
                result = tracker.initBudget(data.agentId, data.params);
            }}

            console.log(JSON.stringify(result));
            """
        ]

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=5,
            shell=False  # CRITICAL: Never use shell=True
        )

        if result.returncode != 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Budget tracker error: {result.stderr}"
            )

        return json.loads(result.stdout.strip())

    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Budget tracker timed out"
        )
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Invalid response from budget tracker: {str(e)}"
        )
    finally:
        # Cleanup temp file
        try:
            os.unlink(temp_file)
        except:
            pass

# ============================================================================
# ENDPOINTS (same as before, using secure caller)
# ============================================================================

@router.post("/budget/check")
async def check_budget(request: BudgetCheckRequest):
    """Check if operation within budget (with input validation)"""
    result = call_budget_tracker_secure(
        "checkBudget",
        request.agent_id,
        {
            "estimatedTokens": request.estimated_tokens,
            "estimatedCost": request.estimated_cost
        }
    )

    if not result.get("allowed"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "Budget exceeded",
                "reason": result.get("reason"),
                "remaining": result.get("remaining"),
                "agent_id": request.agent_id
            }
        )

    return result

# ... (other endpoints using call_budget_tracker_secure)

@router.post("/budget/init/{agent_id}")
async def initialize_budget(
    agent_id: str,
    tokens_per_hour: int = 100000,
    tokens_per_day: int = 500000,
    max_cost_per_operation: float = 0.1
):
    """Initialize budget for a new agent (SECURE)"""
    result = call_budget_tracker_secure(
        "initBudget",
        agent_id,
        {
            "tokensPerHour": tokens_per_hour,
            "tokensPerDay": tokens_per_day,
            "maxCostPerOperation": max_cost_per_operation
        }
    )

    return {
        "success": result.get("success"),
        "agent_id": result.get("agentId"),
        "limits": result.get("limits"),
        "timestamp": datetime.now().isoformat()
    }


@router.post("/budget/deduct")
async def deduct_budget(request: BudgetDeductRequest):
    """Deduct actual token/cost usage from agent budget (SECURE)"""
    result = call_budget_tracker_secure(
        "deduct",
        request.agent_id,
        {
            "tokensUsed": request.tokens_used,
            "cost": request.cost
        }
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("reason", "Budget deduction failed")
        )

    return {
        "success": result["success"],
        "agent_id": result["agentId"],
        "deducted": result["deducted"],
        "remaining": result["remaining"],
        "deduct_time": result["deductTime"],
        "timestamp": datetime.now().isoformat()
    }


@router.get("/budget/status/{agent_id}")
async def get_budget_status(agent_id: str):
    """Get current budget status for an agent (SECURE)"""
    result = call_budget_tracker_secure("getStatus", agent_id)

    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result["error"]
        )

    return {
        "agent_id": result["agentId"],
        "limits": result["limits"],
        "usage": result["usage"],
        "remaining": result["remaining"],
        "timestamp": datetime.now().isoformat()
    }


@router.post("/budget/reset/{agent_id}")
async def reset_budget(agent_id: str):
    """Reset agent budget (clear usage counters) (SECURE)"""
    result = call_budget_tracker_secure("reset", agent_id)

    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("reason", "Budget reset failed")
        )

    return {
        "success": result["success"],
        "agent_id": result["agentId"],
        "timestamp": datetime.now().isoformat()
    }


@router.get("/budget/health")
async def budget_health():
    """Health check with path validation"""
    try:
        tracker_path = get_budget_tracker_path()
        return {
            "status": "healthy",
            "budget_tracker_path": tracker_path,
            "budget_tracker_exists": os.path.exists(tracker_path),
            "security": "hardened",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "status": "degraded",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }
