"""
Feedback Loops API Router

Handles:
- Prompt refinement approvals
- Tool tuning approvals
- Workflow optimization approvals
- Feedback loop statistics
- Pending approvals management
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import json

from ..database import get_db
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


# Pydantic models
class PromptRefinementRecommendation(BaseModel):
    agent_id: str
    recommendations: Dict[str, Any]
    status: str = "pending_approval"
    requires_approval: bool = True


class RBACRecommendation(BaseModel):
    agent_id: str
    recommendations: Dict[str, Any]
    status: str = "pending_approval"
    requires_approval: bool = True


class WorkflowRecommendation(BaseModel):
    workflow_id: str
    recommendations: Dict[str, Any]
    simulation: Dict[str, Any]
    status: str = "pending_approval"
    requires_approval: bool = True


class ApprovalRequest(BaseModel):
    approved: bool
    notes: Optional[str] = ""


# In-memory storage (replace with database in production)
prompt_recommendations: Dict[str, Dict[str, Any]] = {}
rbac_recommendations: Dict[str, Dict[str, Any]] = {}
workflow_recommendations: Dict[str, Dict[str, Any]] = {}


# Prompt Refinement Endpoints
@router.post("/prompt-recommendations")
async def create_prompt_recommendation(rec: PromptRefinementRecommendation):
    """Store prompt refinement recommendation for approval"""
    rec_id = f"prompt-{rec.agent_id}-{int(datetime.now().timestamp() * 1000)}"

    prompt_recommendations[rec_id] = {
        "id": rec_id,
        "type": "prompt_refinement",
        "agent_id": rec.agent_id,
        "timestamp": datetime.now().isoformat(),
        "status": rec.status,
        "data": rec.recommendations,
        "requires_approval": rec.requires_approval
    }

    return {
        "recommendation_id": rec_id,
        "status": "pending_approval",
        "message": "Recommendation created successfully"
    }


@router.get("/prompt-recommendations/{rec_id}")
async def get_prompt_recommendation(rec_id: str):
    """Get prompt refinement recommendation details"""
    if rec_id not in prompt_recommendations:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    return prompt_recommendations[rec_id]


@router.post("/prompt-recommendations/{rec_id}/approve")
async def approve_prompt_recommendation(rec_id: str, approval: ApprovalRequest):
    """Approve or reject prompt refinement recommendation"""
    if rec_id not in prompt_recommendations:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    rec = prompt_recommendations[rec_id]

    if approval.approved:
        # Apply the refinement
        # In production, this would update the agent's prompt in the database
        rec["status"] = "approved"
        rec["approval_notes"] = approval.notes
        rec["approved_at"] = datetime.now().isoformat()

        # TODO: Apply prompt refinement to agent
        # await update_agent_prompt(rec["agent_id"], rec["data"]["new_prompt"])

        return {
            "status": "approved",
            "message": "Prompt refinement applied successfully",
            "recommendation_id": rec_id
        }
    else:
        rec["status"] = "rejected"
        rec["rejection_notes"] = approval.notes
        rec["rejected_at"] = datetime.now().isoformat()

        return {
            "status": "rejected",
            "message": "Prompt refinement rejected",
            "recommendation_id": rec_id
        }


# RBAC/Tool Tuning Endpoints
@router.post("/rbac-recommendations")
async def create_rbac_recommendation(rec: RBACRecommendation):
    """Store RBAC/tool tuning recommendation for approval"""
    rec_id = f"rbac-{rec.agent_id}-{int(datetime.now().timestamp() * 1000)}"

    rbac_recommendations[rec_id] = {
        "id": rec_id,
        "type": "tool_tuning",
        "agent_id": rec.agent_id,
        "timestamp": datetime.now().isoformat(),
        "status": rec.status,
        "data": rec.recommendations,
        "requires_approval": rec.requires_approval
    }

    return {
        "recommendation_id": rec_id,
        "status": "pending_approval",
        "message": "RBAC recommendation created successfully"
    }


@router.get("/rbac-recommendations/{rec_id}")
async def get_rbac_recommendation(rec_id: str):
    """Get RBAC recommendation details"""
    if rec_id not in rbac_recommendations:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    return rbac_recommendations[rec_id]


@router.post("/rbac-recommendations/{rec_id}/approve")
async def approve_rbac_recommendation(rec_id: str, approval: ApprovalRequest):
    """Approve or reject RBAC recommendation"""
    if rec_id not in rbac_recommendations:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    rec = rbac_recommendations[rec_id]

    if approval.approved:
        rec["status"] = "approved"
        rec["approval_notes"] = approval.notes
        rec["approved_at"] = datetime.now().isoformat()

        # TODO: Apply RBAC changes
        # - Remove unused tools
        # - Allow denied tools
        # await apply_rbac_changes(rec["agent_id"], rec["data"])

        return {
            "status": "approved",
            "message": "RBAC changes applied successfully",
            "recommendation_id": rec_id
        }
    else:
        rec["status"] = "rejected"
        rec["rejection_notes"] = approval.notes
        rec["rejected_at"] = datetime.now().isoformat()

        return {
            "status": "rejected",
            "message": "RBAC changes rejected",
            "recommendation_id": rec_id
        }


# Workflow Optimization Endpoints
@router.post("/workflow-recommendations")
async def create_workflow_recommendation(rec: WorkflowRecommendation):
    """Store workflow optimization recommendation for approval"""
    rec_id = f"workflow-{rec.workflow_id}-{int(datetime.now().timestamp() * 1000)}"

    workflow_recommendations[rec_id] = {
        "id": rec_id,
        "type": "workflow_optimization",
        "workflow_id": rec.workflow_id,
        "timestamp": datetime.now().isoformat(),
        "status": rec.status,
        "data": rec.recommendations,
        "simulation": rec.simulation,
        "requires_approval": rec.requires_approval
    }

    return {
        "recommendation_id": rec_id,
        "status": "pending_approval",
        "message": "Workflow optimization recommendation created successfully"
    }


@router.get("/workflow-recommendations/{rec_id}")
async def get_workflow_recommendation(rec_id: str):
    """Get workflow optimization recommendation details"""
    if rec_id not in workflow_recommendations:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    return workflow_recommendations[rec_id]


@router.post("/workflow-recommendations/{rec_id}/approve")
async def approve_workflow_recommendation(rec_id: str, approval: ApprovalRequest):
    """Approve or reject workflow optimization recommendation"""
    if rec_id not in workflow_recommendations:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    rec = workflow_recommendations[rec_id]

    if approval.approved:
        rec["status"] = "approved"
        rec["approval_notes"] = approval.notes
        rec["approved_at"] = datetime.now().isoformat()

        # TODO: Apply workflow optimizations
        # await apply_workflow_optimizations(rec["workflow_id"], rec["data"])

        return {
            "status": "approved",
            "message": "Workflow optimizations applied successfully",
            "recommendation_id": rec_id,
            "estimated_improvement": rec["simulation"]
        }
    else:
        rec["status"] = "rejected"
        rec["rejection_notes"] = approval.notes
        rec["rejected_at"] = datetime.now().isoformat()

        return {
            "status": "rejected",
            "message": "Workflow optimizations rejected",
            "recommendation_id": rec_id
        }


# General Endpoints
@router.get("/pending-approvals")
async def get_pending_approvals():
    """Get all pending approval recommendations"""
    pending = []

    # Collect all pending recommendations
    for rec_id, rec in prompt_recommendations.items():
        if rec["status"] == "pending_approval":
            pending.append(rec)

    for rec_id, rec in rbac_recommendations.items():
        if rec["status"] == "pending_approval":
            pending.append(rec)

    for rec_id, rec in workflow_recommendations.items():
        if rec["status"] == "pending_approval":
            pending.append(rec)

    # Sort by timestamp (most recent first)
    pending.sort(key=lambda x: x["timestamp"], reverse=True)

    return {
        "count": len(pending),
        "recommendations": pending
    }


@router.get("/stats")
async def get_feedback_stats():
    """Get feedback loop statistics"""
    # In production, this would query Memory MCP
    # For now, return mock data

    return {
        "prompt_refinement": {
            "runs": 10,
            "last_run": datetime.now().isoformat(),
            "total_refinements": 25
        },
        "tool_tuning": {
            "runs": 5,
            "last_run": datetime.now().isoformat(),
            "total_recommendations": 15
        },
        "workflow_optimizer": {
            "runs": 5,
            "last_run": datetime.now().isoformat(),
            "total_optimizations": 12
        }
    }


@router.get("/recommendations/history")
async def get_recommendation_history(
    type: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50
):
    """Get recommendation history with optional filtering"""
    all_recommendations = []

    # Collect all recommendations
    all_recommendations.extend(prompt_recommendations.values())
    all_recommendations.extend(rbac_recommendations.values())
    all_recommendations.extend(workflow_recommendations.values())

    # Apply filters
    if type:
        all_recommendations = [r for r in all_recommendations if r["type"] == type]

    if status:
        all_recommendations = [r for r in all_recommendations if r["status"] == status]

    # Sort by timestamp (most recent first)
    all_recommendations.sort(key=lambda x: x["timestamp"], reverse=True)

    # Limit results
    all_recommendations = all_recommendations[:limit]

    return {
        "total": len(all_recommendations),
        "recommendations": all_recommendations
    }


@router.post("/notifications/email")
async def send_email_notification(
    to: str,
    subject: str,
    body: str,
    data: Optional[Dict[str, Any]] = None
):
    """Send email notification (placeholder)"""
    # TODO: Implement email sending
    print(f"Email notification: {subject}")
    print(f"To: {to}")
    print(f"Body: {body}")
    print(f"Data: {data}")

    return {
        "status": "sent",
        "message": "Email notification sent successfully"
    }


@router.delete("/recommendations/{rec_id}")
async def delete_recommendation(rec_id: str):
    """Delete a recommendation"""
    # Check all stores
    if rec_id in prompt_recommendations:
        del prompt_recommendations[rec_id]
        return {"status": "deleted", "recommendation_id": rec_id}

    if rec_id in rbac_recommendations:
        del rbac_recommendations[rec_id]
        return {"status": "deleted", "recommendation_id": rec_id}

    if rec_id in workflow_recommendations:
        del workflow_recommendations[rec_id]
        return {"status": "deleted", "recommendation_id": rec_id}

    raise HTTPException(status_code=404, detail="Recommendation not found")


@router.get("/metrics")
async def get_feedback_metrics():
    """Get detailed feedback loop metrics"""
    total_recommendations = (
        len(prompt_recommendations) +
        len(rbac_recommendations) +
        len(workflow_recommendations)
    )

    approved_count = sum(
        1 for rec in list(prompt_recommendations.values()) +
                         list(rbac_recommendations.values()) +
                         list(workflow_recommendations.values())
        if rec["status"] == "approved"
    )

    rejected_count = sum(
        1 for rec in list(prompt_recommendations.values()) +
                         list(rbac_recommendations.values()) +
                         list(workflow_recommendations.values())
        if rec["status"] == "rejected"
    )

    pending_count = sum(
        1 for rec in list(prompt_recommendations.values()) +
                         list(rbac_recommendations.values()) +
                         list(workflow_recommendations.values())
        if rec["status"] == "pending_approval"
    )

    return {
        "total_recommendations": total_recommendations,
        "approved": approved_count,
        "rejected": rejected_count,
        "pending": pending_count,
        "approval_rate": approved_count / total_recommendations if total_recommendations > 0 else 0,
        "breakdown": {
            "prompt_refinement": len(prompt_recommendations),
            "tool_tuning": len(rbac_recommendations),
            "workflow_optimization": len(workflow_recommendations)
        }
    }
