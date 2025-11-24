"""
Stored Event database model
Persistent storage for agent events with full context preservation
"""
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, Integer, Float, JSON, Index
from app.db_setup import Base


class StoredEvent(Base):
    """
    Persistent event storage with WHO/WHEN/PROJECT/WHY metadata
    Enables historical analysis, session reconstruction, and audit trails
    """
    __tablename__ = "stored_events"

    # Primary identification
    id = Column(String(36), primary_key=True)  # UUID
    event_id = Column(String(100), nullable=False, index=True)  # From event payload
    batch_id = Column(String(100), nullable=True, index=True)  # From EventBatch

    # Event classification
    event_type = Column(String(100), nullable=False, index=True)  # task-started, file-edited, etc.
    operation = Column(String(100), nullable=True, index=True)  # pre-task, post-edit, etc.
    status = Column(String(50), nullable=False, default='success')  # success, failed, blocked

    # WHO metadata (Agent Reality Map)
    agent_id = Column(String(100), nullable=False, index=True)  # coder, researcher, etc.
    agent_name = Column(String(255), nullable=True)
    agent_type = Column(String(100), nullable=True, index=True)  # From tagging protocol
    agent_role = Column(String(100), nullable=True)  # worker, coordinator, etc.
    agent_category = Column(String(100), nullable=True)  # delivery/development, etc.

    # WHEN metadata
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    timestamp_iso = Column(String(50), nullable=True)  # ISO8601 string
    timestamp_unix = Column(Float, nullable=True)  # Unix timestamp

    # PROJECT metadata
    project = Column(String(255), nullable=True, index=True)  # ruv-sparc, terminal-manager, etc.
    session_id = Column(String(100), nullable=True, index=True)  # Session identifier

    # WHY metadata
    intent = Column(String(100), nullable=True, index=True)  # implementation, bugfix, refactor, etc.
    description = Column(Text, nullable=True)  # Human-readable description

    # Correlation and tracing
    trace_id = Column(String(100), nullable=True, index=True)  # For distributed tracing
    span_id = Column(String(50), nullable=True)  # OpenTelemetry span ID
    parent_trace_id = Column(String(100), nullable=True)  # For hierarchical traces

    # Task/operation context
    task_id = Column(String(100), nullable=True, index=True)
    file_path = Column(Text, nullable=True)  # For edit events

    # Metrics
    duration = Column(Integer, nullable=True)  # Duration in milliseconds
    tokens_used = Column(Integer, nullable=True)  # Token usage
    cost = Column(Float, nullable=True)  # Cost in USD
    lines_changed = Column(Integer, nullable=True)  # For edit events
    bytes_changed = Column(Integer, nullable=True)  # For edit events
    files_modified = Column(Integer, nullable=True)  # Number of files changed
    commands_executed = Column(Integer, nullable=True)  # Number of commands run

    # Full event payload (JSON)
    event_metadata = Column(JSON, nullable=True)  # Full WHO/WHEN/PROJECT/WHY from tagging protocol (renamed from 'metadata')
    raw_payload = Column(JSON, nullable=False)  # Complete original event data

    # Audit fields
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    indexed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Composite indexes for common queries (prefixed to avoid conflicts with budget_history)
    __table_args__ = (
        Index('ix_stored_event_agent_timestamp', 'agent_id', 'timestamp'),
        Index('ix_stored_event_project_timestamp', 'project', 'timestamp'),
        Index('ix_stored_event_session_timestamp', 'session_id', 'timestamp'),
        Index('ix_stored_event_trace_timestamp', 'trace_id', 'timestamp'),
        Index('ix_stored_event_event_type_timestamp', 'event_type', 'timestamp'),
        Index('ix_stored_event_intent_timestamp', 'intent', 'timestamp'),
        Index('ix_stored_event_agent_intent', 'agent_id', 'intent'),
    )

    def __repr__(self):
        return f"<StoredEvent(id={self.id}, event_type={self.event_type}, agent={self.agent_id}, timestamp={self.timestamp})>"

    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'event_id': self.event_id,
            'batch_id': self.batch_id,
            'event_type': self.event_type,
            'operation': self.operation,
            'status': self.status,
            'agent_id': self.agent_id,
            'agent_name': self.agent_name,
            'agent_type': self.agent_type,
            'agent_role': self.agent_role,
            'agent_category': self.agent_category,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'timestamp_iso': self.timestamp_iso,
            'timestamp_unix': self.timestamp_unix,
            'project': self.project,
            'session_id': self.session_id,
            'intent': self.intent,
            'description': self.description,
            'trace_id': self.trace_id,
            'span_id': self.span_id,
            'parent_trace_id': self.parent_trace_id,
            'task_id': self.task_id,
            'file_path': self.file_path,
            'duration': self.duration,
            'tokens_used': self.tokens_used,
            'cost': self.cost,
            'lines_changed': self.lines_changed,
            'bytes_changed': self.bytes_changed,
            'files_modified': self.files_modified,
            'commands_executed': self.commands_executed,
            'event_metadata': self.event_metadata,
            'raw_payload': self.raw_payload,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'indexed_at': self.indexed_at.isoformat() if self.indexed_at else None,
        }
