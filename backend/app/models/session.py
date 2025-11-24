"""
Session database model
Tracks Claude Code sessions for continuity and restoration
"""
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, Float, JSON, Text, Index
from app.db_setup import Base


class Session(Base):
    """
    Session tracking for context preservation and restoration
    Enables resuming work after restarts with full context
    """
    __tablename__ = "sessions"

    # Primary identification
    id = Column(String(36), primary_key=True)  # UUID
    session_id = Column(String(100), nullable=False, unique=True, index=True)  # Unique session identifier

    # Session metadata
    project = Column(String(255), nullable=True, index=True)
    description = Column(Text, nullable=True)

    # Temporal tracking
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    ended_at = Column(DateTime, nullable=True, index=True)
    duration_seconds = Column(Integer, nullable=True)  # Total duration

    # Session state
    status = Column(String(50), nullable=False, default='active', index=True)  # active, completed, abandoned

    # Aggregated metrics
    total_tasks = Column(Integer, default=0, nullable=False)
    successful_tasks = Column(Integer, default=0, nullable=False)
    failed_tasks = Column(Integer, default=0, nullable=False)
    total_edits = Column(Integer, default=0, nullable=False)
    total_lines_changed = Column(Integer, default=0, nullable=False)
    total_bytes_changed = Column(Integer, default=0, nullable=False)
    total_tokens_used = Column(Integer, default=0, nullable=False)
    total_cost = Column(Float, default=0.0, nullable=False)

    # Agent participation
    agents_used = Column(JSON, nullable=True)  # List of agent IDs that participated
    primary_agent = Column(String(100), nullable=True, index=True)  # Most active agent

    # Correlation
    trace_ids = Column(JSON, nullable=True)  # List of trace IDs in this session
    parent_session_id = Column(String(100), nullable=True, index=True)  # For nested sessions

    # Restoration metadata
    correlation_stats = Column(JSON, nullable=True)  # Correlation ID statistics
    budget_snapshot = Column(JSON, nullable=True)  # Budget state at session end
    context_snapshot = Column(JSON, nullable=True)  # Full context for restoration

    # Audit
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Composite indexes for queries
    __table_args__ = (
        Index('ix_project_started', 'project', 'started_at'),
        Index('ix_status_started', 'status', 'started_at'),
        Index('ix_agent_started', 'primary_agent', 'started_at'),
    )

    def __repr__(self):
        return f"<Session(id={self.id}, session_id={self.session_id}, project={self.project}, status={self.status})>"

    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'session_id': self.session_id,
            'project': self.project,
            'description': self.description,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'ended_at': self.ended_at.isoformat() if self.ended_at else None,
            'duration_seconds': self.duration_seconds,
            'status': self.status,
            'total_tasks': self.total_tasks,
            'successful_tasks': self.successful_tasks,
            'failed_tasks': self.failed_tasks,
            'total_edits': self.total_edits,
            'total_lines_changed': self.total_lines_changed,
            'total_bytes_changed': self.total_bytes_changed,
            'total_tokens_used': self.total_tokens_used,
            'total_cost': self.total_cost,
            'agents_used': self.agents_used,
            'primary_agent': self.primary_agent,
            'trace_ids': self.trace_ids,
            'parent_session_id': self.parent_session_id,
            'correlation_stats': self.correlation_stats,
            'budget_snapshot': self.budget_snapshot,
            'context_snapshot': self.context_snapshot,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
