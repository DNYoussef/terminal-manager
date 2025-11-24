"""
Budget Router - Agent Budget Management and Enforcement
Provides HTTP endpoints for budget checking, deduction, and status reporting.
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from datetime import datetime
import subprocess
import json
import os

router = APIRouter()


# ============================================================================
# MODELS
# ============================================================================

class BudgetCheckRequest(BaseModel):
    """Request to check if operation is within budget"""
    agent_id: str = Field(..., description="Agent identifier")
    estimated_tokens: int = Field(default=10000, description="Estimated token usage")
    estimated_cost: float = Field(default=0.01, description="Estimated cost in USD")


class BudgetDeductRequest(BaseModel):
    """Request to deduct actual usage from budget"""
    agent_id: str = Field(..., description="Agent identifier")
    tokens_used: int = Field(..., description="Actual tokens used")
    cost: float = Field(..., description="Actual cost in USD")


class BudgetStatusRequest(BaseModel):
    """Request for budget status"""
    agent_id: str = Field(..., description="Agent identifier")


class BudgetCheckResponse(BaseModel):
    """Response for budget check"""
    allowed: bool
    reason: str
    agent_id: str
    estimate: Dict[str, Any]
    remaining: Dict[str, Any]
    check_time: float
    timestamp: str


class BudgetDeductResponse(BaseModel):
    """Response for budget deduction"""
    success: bool
    agent_id: str
    deducted: Dict[str, Any]
    remaining: Dict[str, Any]
    deduct_time: float
    timestamp: str


class BudgetStatusResponse(BaseModel):
    """Response for budget status"""
    agent_id: str
    limits: Dict[str, Any]
    usage: Dict[str, Any]
    remaining: Dict[str, Any]
    timestamp: str


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_budget_tracker_path():
    """Get path to budget-tracker.js script"""
    # Path relative to backend
    base_path = os.path.join(
        os.path.dirname(__file__),
        "..", "..", "..", "..",
        "claude-code-plugins", "ruv-sparc-three-loop-system", "hooks", "12fa",
        "budget-tracker.js"
    )
    return os.path.abspath(base_path)


def call_budget_tracker(method: str, agent_id: str, params: Optional[Dict] = None):
    """
    Call budget-tracker.js methods via Node.js subprocess

    Args:
        method: Method to call (checkBudget, deduct, getStatus, reset)
        agent_id: Agent identifier
        params: Optional parameters for the method

    Returns:
        Result from budget tracker
    """
    tracker_path = get_budget_tracker_path()

    if not os.path.exists(tracker_path):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Budget tracker not found at {tracker_path}"
        )

    # Build Node.js command to invoke budget tracker
    # For now, we'll use a simple approach - in production, use IPC or HTTP
    cmd_script = f"""
    const tracker = require('{tracker_path.replace(chr(92), chr(92)+chr(92))}');
    const method = '{method}';
    const agentId = '{agent_id}';
    const params = {json.dumps(params or {})};

    let result;
    if (method === 'checkBudget') {{
        result = tracker.checkBudget(agentId, params);
    }} else if (method === 'deduct') {{
        result = tracker.deduct(agentId, params);
    }} else if (method === 'getStatus') {{
        result = tracker.getStatus(agentId);
    }} else if (method === 'reset') {{
        result = tracker.reset(agentId);
    }} else if (method === 'initBudget') {{
        result = tracker.initBudget(agentId, params);
    }}

    console.log(JSON.stringify(result));
    """

    try:
        result = subprocess.run(
            ['node', '-e', cmd_script],
            capture_output=True,
            text=True,
            timeout=5
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


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/budget/check", response_model=BudgetCheckResponse)
async def check_budget(request: BudgetCheckRequest):
    """
    Check if an operation is within budget limits

    Returns 200 if allowed, 429 if budget exceeded
    """
    result = call_budget_tracker(
        "checkBudget",
        request.agent_id,
        {
            "estimatedTokens": request.estimated_tokens,
            "estimatedCost": request.estimated_cost
        }
    )

    # BLOCKER-4: Return 429 if budget exceeded
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

    return BudgetCheckResponse(
        allowed=result["allowed"],
        reason=result["reason"],
        agent_id=result["agentId"],
        estimate=result["estimate"],
        remaining=result["remaining"],
        check_time=result["checkTime"],
        timestamp=datetime.now().isoformat()
    )


@router.post("/budget/deduct", response_model=BudgetDeductResponse)
async def deduct_budget(request: BudgetDeductRequest):
    """
    Deduct actual token/cost usage from agent budget
    """
    result = call_budget_tracker(
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

    return BudgetDeductResponse(
        success=result["success"],
        agent_id=result["agentId"],
        deducted=result["deducted"],
        remaining=result["remaining"],
        deduct_time=result["deductTime"],
        timestamp=datetime.now().isoformat()
    )


@router.get("/budget/status/{agent_id}", response_model=BudgetStatusResponse)
async def get_budget_status(agent_id: str):
    """
    Get current budget status for an agent
    """
    result = call_budget_tracker("getStatus", agent_id)

    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result["error"]
        )

    return BudgetStatusResponse(
        agent_id=result["agentId"],
        limits=result["limits"],
        usage=result["usage"],
        remaining=result["remaining"],
        timestamp=datetime.now().isoformat()
    )


@router.post("/budget/init/{agent_id}")
async def initialize_budget(
    agent_id: str,
    tokens_per_hour: int = 100000,
    tokens_per_day: int = 500000,
    max_cost_per_operation: float = 0.1
):
    """
    Initialize budget for a new agent
    """
    result = call_budget_tracker(
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


@router.post("/budget/reset/{agent_id}")
async def reset_budget(agent_id: str):
    """
    Reset agent budget (clear usage counters)
    """
    result = call_budget_tracker("reset", agent_id)

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


# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get("/budget/health")
async def budget_health():
    """Health check for budget system"""
    tracker_path = get_budget_tracker_path()

    return {
        "status": "healthy" if os.path.exists(tracker_path) else "degraded",
        "budget_tracker_path": tracker_path,
        "budget_tracker_exists": os.path.exists(tracker_path),
        "timestamp": datetime.now().isoformat()
    }
