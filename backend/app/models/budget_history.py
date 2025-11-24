"""
Budget History database model
Tracks budget usage over time for analytics and cost management
"""
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, Float, JSON, Text, Index
from app.db_setup import Base


class BudgetHistory(Base):
    """
    Historical budget tracking for cost analysis and reporting
    Enables budget trend analysis and cost optimization
    """
    __tablename__ = "budget_history"

    # Primary identification
    id = Column(String(36), primary_key=True)  # UUID
    history_id = Column(String(100), nullable=False, unique=True, index=True)

    # Agent identification
    agent_id = Column(String(100), nullable=False, index=True)
    agent_type = Column(String(100), nullable=True)

    # Operation that triggered deduction
    operation_type = Column(String(100), nullable=True, index=True)  # task, edit, etc.
    operation_id = Column(String(100), nullable=True, index=True)  # task_id, edit_id, etc.
    session_id = Column(String(100), nullable=True, index=True)
    trace_id = Column(String(100), nullable=True, index=True)

    # Temporal
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    period = Column(String(20), nullable=False, index=True)  # hourly, daily, monthly

    # Budget metrics BEFORE operation
    budget_before = Column(JSON, nullable=True)  # Full budget state
    tokens_remaining_before = Column(Integer, nullable=True)
    cost_remaining_before = Column(Float, nullable=True)

    # Operation usage
    tokens_used = Column(Integer, nullable=False, default=0)
    cost = Column(Float, nullable=False, default=0.0)
    duration_ms = Column(Integer, nullable=True)  # Operation duration

    # Budget metrics AFTER operation
    budget_after = Column(JSON, nullable=True)  # Full budget state
    tokens_remaining_after = Column(Integer, nullable=True)
    cost_remaining_after = Column(Float, nullable=True)

    # Budget limits (at time of operation)
    tokens_per_hour_limit = Column(Integer, nullable=True)
    tokens_per_day_limit = Column(Integer, nullable=True)
    max_cost_per_operation_limit = Column(Float, nullable=True)

    # Status flags
    blocked = Column(Integer, default=0, nullable=False)  # 1 if operation was blocked
    block_reason = Column(Text, nullable=True)  # Why it was blocked

    # Metadata
    description = Column(Text, nullable=True)
    event_metadata = Column(JSON, nullable=True)  # Additional context (renamed from 'metadata')

    # Audit
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Composite indexes for analytics queries
    __table_args__ = (
        Index('ix_budget_hist_agent_timestamp', 'agent_id', 'timestamp'),
        Index('ix_budget_hist_agent_period', 'agent_id', 'period'),
        Index('ix_budget_hist_session_timestamp', 'session_id', 'timestamp'),
        Index('ix_budget_hist_operation_timestamp', 'operation_type', 'timestamp'),
        Index('ix_budget_hist_blocked_timestamp', 'blocked', 'timestamp'),
    )

    def __repr__(self):
        return f"<BudgetHistory(id={self.id}, agent={self.agent_id}, tokens_used={self.tokens_used}, timestamp={self.timestamp})>"

    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'history_id': self.history_id,
            'agent_id': self.agent_id,
            'agent_type': self.agent_type,
            'operation_type': self.operation_type,
            'operation_id': self.operation_id,
            'session_id': self.session_id,
            'trace_id': self.trace_id,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'period': self.period,
            'budget_before': self.budget_before,
            'tokens_remaining_before': self.tokens_remaining_before,
            'cost_remaining_before': self.cost_remaining_before,
            'tokens_used': self.tokens_used,
            'cost': self.cost,
            'duration_ms': self.duration_ms,
            'budget_after': self.budget_after,
            'tokens_remaining_after': self.tokens_remaining_after,
            'cost_remaining_after': self.cost_remaining_after,
            'tokens_per_hour_limit': self.tokens_per_hour_limit,
            'tokens_per_day_limit': self.tokens_per_day_limit,
            'max_cost_per_operation_limit': self.max_cost_per_operation_limit,
            'blocked': self.blocked,
            'block_reason': self.block_reason,
            'description': self.description,
            'event_metadata': self.event_metadata,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
