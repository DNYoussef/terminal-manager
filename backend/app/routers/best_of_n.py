"""
Best-of-N Competitive Execution API Router

Provides REST endpoints for orchestrating competitive agent executions
and retrieving/comparing results.

Endpoints:
- POST /api/v1/best-of-n/execute - Start competitive execution
- GET /api/v1/best-of-n/{task_id}/results - Get execution results
- POST /api/v1/best-of-n/{task_id}/select - Record human selection
- GET /api/v1/best-of-n/history - Get execution history
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid
import json
import logging

router = APIRouter(prefix="/api/v1/best-of-n", tags=["best-of-n"])
logger = logging.getLogger(__name__)

# In-memory storage for execution results (replace with DB in production)
execution_results = {}
execution_history = []


class ScoringWeights(BaseModel):
    """Custom scoring weights for multi-criteria evaluation"""
    code_quality: float = Field(0.4, ge=0, le=1)
    test_coverage: float = Field(0.3, ge=0, le=1)
    documentation: float = Field(0.2, ge=0, le=1)
    performance: float = Field(0.1, ge=0, le=1)


class SandboxConfig(BaseModel):
    """E2B sandbox configuration"""
    timeout_ms: int = Field(600000, ge=60000, le=1800000)
    memory_mb: int = Field(2048, ge=512, le=8192)
    cpu_cores: int = Field(1, ge=1, le=4)
    cleanup_on_complete: bool = True


class ExecuteRequest(BaseModel):
    """Request model for competitive execution"""
    task: str = Field(..., min_length=10, max_length=5000)
    n: int = Field(3, ge=2, le=10)
    agents: List[str] = Field(default=["coder", "backend-dev", "ml-developer"])
    context: Dict[str, Any] = Field(default_factory=dict)
    scoring: Optional[ScoringWeights] = None
    sandbox: Optional[SandboxConfig] = None


class ArtifactMetrics(BaseModel):
    """Metrics for code/test/doc artifacts"""
    quality_score: float
    normalized_score: float
    additional_metrics: Dict[str, Any]


class AgentResult(BaseModel):
    """Single agent execution result"""
    agent_id: str
    agent_type: str
    score: float
    breakdown: Dict[str, float]
    artifacts: Dict[str, Any]
    metrics: Dict[str, Any]
    comparison: Dict[str, ArtifactMetrics]


class ExecutionResponse(BaseModel):
    """Response model for execution results"""
    task_id: str
    status: str
    winner: Optional[AgentResult] = None
    all_results: Optional[List[AgentResult]] = None
    execution_time_ms: Optional[int] = None
    created_at: datetime
    completed_at: Optional[datetime] = None


class SelectionRequest(BaseModel):
    """Request model for human selection override"""
    selected_agent_id: str
    rationale: str = Field(..., min_length=10, max_length=1000)


class HistoryItem(BaseModel):
    """History item for past executions"""
    task_id: str
    task: str
    winner_agent: str
    winner_score: float
    agent_count: int
    execution_time_ms: int
    created_at: datetime


@router.post("/execute", response_model=ExecutionResponse)
async def execute_best_of_n(
    request: ExecuteRequest,
    background_tasks: BackgroundTasks
):
    """
    Start a best-of-N competitive execution

    Spawns N agents in parallel sandboxes, executes the task,
    compares outputs, and selects the best result.

    Args:
        request: Execution configuration
        background_tasks: FastAPI background tasks

    Returns:
        ExecutionResponse with task_id and initial status
    """
    task_id = str(uuid.uuid4())

    logger.info(f"Starting best-of-N execution: {task_id}", extra={
        "task_id": task_id,
        "n": request.n,
        "agents": request.agents
    })

    # Initialize execution result
    execution = {
        "task_id": task_id,
        "status": "running",
        "task": request.task,
        "n": request.n,
        "agents": request.agents,
        "created_at": datetime.utcnow(),
        "completed_at": None,
        "winner": None,
        "all_results": [],
        "execution_time_ms": None
    }

    execution_results[task_id] = execution

    # Schedule background execution
    background_tasks.add_task(
        run_competitive_execution,
        task_id,
        request
    )

    return ExecutionResponse(
        task_id=task_id,
        status="running",
        created_at=execution["created_at"]
    )


async def run_competitive_execution(task_id: str, request: ExecuteRequest):
    """
    Background task for running competitive execution

    This would invoke the Node.js best-of-n-pipeline.js module
    via subprocess or IPC in production.
    """
    import time
    import random

    try:
        # Simulate execution (replace with actual Node.js invocation)
        start_time = time.time()

        # Mock agent results
        all_results = []
        for i, agent_type in enumerate(request.agents[:request.n]):
            agent_id = str(uuid.uuid4())

            # Mock scoring
            code_score = random.uniform(70, 100)
            test_score = random.uniform(70, 100)
            doc_score = random.uniform(70, 100)
            perf_score = random.uniform(70, 100)

            weights = request.scoring or ScoringWeights()
            total_score = (
                code_score * weights.code_quality +
                test_score * weights.test_coverage +
                doc_score * weights.documentation +
                perf_score * weights.performance
            )

            result = {
                "agent_id": agent_id,
                "agent_type": agent_type,
                "score": round(total_score, 2),
                "breakdown": {
                    "code_quality": round(code_score * weights.code_quality, 2),
                    "test_coverage": round(test_score * weights.test_coverage, 2),
                    "documentation": round(doc_score * weights.documentation, 2),
                    "performance": round(perf_score * weights.performance, 2)
                },
                "artifacts": {
                    "code": {
                        "files": [f"src/module_{i}.js"],
                        "quality_score": round(code_score, 2),
                        "lines_of_code": random.randint(100, 500)
                    },
                    "tests": {
                        "files": [f"tests/module_{i}.test.js"],
                        "count": random.randint(5, 20),
                        "coverage": round(test_score, 2),
                        "passing": random.randint(5, 20)
                    },
                    "docs": {
                        "files": [f"docs/module_{i}.md"],
                        "completeness": round(doc_score, 2),
                        "word_count": random.randint(200, 1000)
                    }
                },
                "metrics": {
                    "execution_time_ms": random.randint(5000, 30000),
                    "tokens_used": random.randint(10000, 50000),
                    "cost_usd": round(random.uniform(0.1, 0.5), 2)
                },
                "comparison": {
                    "code_metrics": {
                        "quality_score": code_score,
                        "normalized_score": code_score / 100,
                        "additional_metrics": {}
                    },
                    "test_metrics": {
                        "quality_score": test_score,
                        "normalized_score": test_score / 100,
                        "additional_metrics": {}
                    },
                    "doc_metrics": {
                        "quality_score": doc_score,
                        "normalized_score": doc_score / 100,
                        "additional_metrics": {}
                    },
                    "performance_metrics": {
                        "quality_score": perf_score,
                        "normalized_score": perf_score / 100,
                        "additional_metrics": {}
                    }
                }
            }

            all_results.append(result)

        # Sort by score and select winner
        all_results.sort(key=lambda x: x["score"], reverse=True)
        winner = all_results[0]

        execution_time_ms = int((time.time() - start_time) * 1000)

        # Update execution result
        execution_results[task_id].update({
            "status": "completed",
            "completed_at": datetime.utcnow(),
            "winner": winner,
            "all_results": all_results,
            "execution_time_ms": execution_time_ms
        })

        # Add to history
        execution_history.append({
            "task_id": task_id,
            "task": request.task,
            "winner_agent": winner["agent_type"],
            "winner_score": winner["score"],
            "agent_count": request.n,
            "execution_time_ms": execution_time_ms,
            "created_at": execution_results[task_id]["created_at"]
        })

        logger.info(f"Best-of-N execution completed: {task_id}", extra={
            "task_id": task_id,
            "winner_agent": winner["agent_type"],
            "winner_score": winner["score"],
            "execution_time_ms": execution_time_ms
        })

    except Exception as e:
        logger.error(f"Best-of-N execution failed: {task_id}", extra={
            "task_id": task_id,
            "error": str(e)
        })

        execution_results[task_id].update({
            "status": "failed",
            "completed_at": datetime.utcnow(),
            "error": str(e)
        })


@router.get("/{task_id}/results", response_model=ExecutionResponse)
async def get_execution_results(task_id: str):
    """
    Get results for a specific execution

    Args:
        task_id: Execution task ID

    Returns:
        ExecutionResponse with current status and results
    """
    if task_id not in execution_results:
        raise HTTPException(status_code=404, detail="Execution not found")

    execution = execution_results[task_id]

    return ExecutionResponse(
        task_id=task_id,
        status=execution["status"],
        winner=execution.get("winner"),
        all_results=execution.get("all_results"),
        execution_time_ms=execution.get("execution_time_ms"),
        created_at=execution["created_at"],
        completed_at=execution.get("completed_at")
    )


@router.post("/{task_id}/select")
async def record_human_selection(
    task_id: str,
    request: SelectionRequest
):
    """
    Record human selection override

    Allows users to override automatic winner selection and
    provide feedback for learning.

    Args:
        task_id: Execution task ID
        request: Selection details with rationale

    Returns:
        Confirmation with recorded selection
    """
    if task_id not in execution_results:
        raise HTTPException(status_code=404, detail="Execution not found")

    execution = execution_results[task_id]

    if execution["status"] != "completed":
        raise HTTPException(
            status_code=400,
            detail="Execution must be completed before recording selection"
        )

    # Validate selected agent exists in results
    agent_ids = [r["agent_id"] for r in execution["all_results"]]
    if request.selected_agent_id not in agent_ids:
        raise HTTPException(status_code=400, detail="Invalid agent_id")

    # Store human selection
    selection = {
        "task_id": task_id,
        "selected_agent_id": request.selected_agent_id,
        "rationale": request.rationale,
        "timestamp": datetime.utcnow()
    }

    execution["human_selection"] = selection

    logger.info(f"Human selection recorded: {task_id}", extra={
        "task_id": task_id,
        "selected_agent_id": request.selected_agent_id
    })

    return {
        "success": True,
        "task_id": task_id,
        "selection": selection
    }


@router.get("/history", response_model=List[HistoryItem])
async def get_execution_history(
    limit: int = 20,
    offset: int = 0
):
    """
    Get execution history

    Args:
        limit: Maximum number of items to return
        offset: Number of items to skip

    Returns:
        List of historical executions
    """
    # Sort by created_at descending
    sorted_history = sorted(
        execution_history,
        key=lambda x: x["created_at"],
        reverse=True
    )

    # Apply pagination
    paginated = sorted_history[offset:offset + limit]

    return [HistoryItem(**item) for item in paginated]


@router.delete("/{task_id}")
async def delete_execution(task_id: str):
    """
    Delete execution results

    Args:
        task_id: Execution task ID

    Returns:
        Confirmation of deletion
    """
    if task_id not in execution_results:
        raise HTTPException(status_code=404, detail="Execution not found")

    del execution_results[task_id]

    # Remove from history
    global execution_history
    execution_history = [
        h for h in execution_history
        if h["task_id"] != task_id
    ]

    logger.info(f"Execution deleted: {task_id}", extra={"task_id": task_id})

    return {"success": True, "task_id": task_id}


@router.get("/stats")
async def get_execution_stats():
    """
    Get aggregate statistics across all executions

    Returns:
        Statistics including average scores, execution times, etc.
    """
    if not execution_history:
        return {
            "total_executions": 0,
            "average_winner_score": 0,
            "average_execution_time_ms": 0,
            "agent_performance": {}
        }

    total = len(execution_history)
    avg_score = sum(h["winner_score"] for h in execution_history) / total
    avg_time = sum(h["execution_time_ms"] for h in execution_history) / total

    # Calculate per-agent performance
    agent_wins = {}
    for h in execution_history:
        agent = h["winner_agent"]
        if agent not in agent_wins:
            agent_wins[agent] = 0
        agent_wins[agent] += 1

    return {
        "total_executions": total,
        "average_winner_score": round(avg_score, 2),
        "average_execution_time_ms": int(avg_time),
        "agent_performance": {
            agent: {
                "wins": count,
                "win_rate": round(count / total * 100, 2)
            }
            for agent, count in agent_wins.items()
        }
    }
