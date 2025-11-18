"""
Database models for scheduled Claude Code tasks and execution reports
"""

from sqlalchemy import Column, String, Text, DateTime, Boolean, Integer, ForeignKey, ARRAY, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
import os

from app.db_setup import Base

# Use JSONB for PostgreSQL, JSON for others
try:
    if 'postgresql' in os.getenv('DATABASE_URL', '').lower():
        from sqlalchemy.dialects.postgresql import JSONB as JSONBType
    else:
        JSONBType = JSON
except:
    JSONBType = JSON


class ScheduledClaudeTask(Base):
    """Scheduled Claude Code task model"""
    __tablename__ = "scheduled_claude_tasks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Scheduling Information
    title = Column(String(255), nullable=False)
    description = Column(Text)
    scheduled_time = Column(DateTime(timezone=True), nullable=False)
    recurrence = Column(String(50))  # 'once', 'daily', 'weekly', 'monthly'
    recurrence_config = Column(JSONBType, default=dict)

    # Claude Code Configuration
    prompt = Column(Text, nullable=False)
    yolo_mode_enabled = Column(Boolean, default=True)
    max_execution_time = Column(Integer, default=3600)  # seconds
    working_directory = Column(String(500))

    # Agent Configuration
    agent_type = Column(String(100))  # 'coder', 'researcher', 'reviewer', etc.
    playbook = Column(String(100))  # Optional playbook to use
    skills = Column(ARRAY(String))  # Array of skills to enable

    # Context
    project_id = Column(String(36), ForeignKey('projects.id', ondelete='SET NULL'))
    terminal_id = Column(String(36), ForeignKey('terminals.id', ondelete='SET NULL'))

    # Execution Control
    status = Column(String(50), default='pending')  # 'pending', 'active', 'completed', 'failed', 'cancelled'
    last_execution_time = Column(DateTime(timezone=True))
    next_execution_time = Column(DateTime(timezone=True))
    execution_count = Column(Integer, default=0)

    # Audit
    created_by = Column(String(255))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Task Metadata (renamed from metadata to avoid SQLAlchemy conflict)
    task_metadata = Column(JSONBType, default=dict)

    # Relationships
    project = relationship("Project", back_populates="scheduled_claude_tasks")
    terminal = relationship("Terminal", back_populates="scheduled_claude_tasks")
    execution_reports = relationship("TaskExecutionReport", back_populates="scheduled_task", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ScheduledClaudeTask(id={self.id}, title={self.title}, status={self.status})>"


class TaskExecutionReport(Base):
    """Execution report for scheduled Claude Code tasks"""
    __tablename__ = "task_execution_reports"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Task Reference
    scheduled_task_id = Column(String(36), ForeignKey('scheduled_claude_tasks.id', ondelete='CASCADE'), nullable=False)

    # Execution Details
    execution_start_time = Column(DateTime(timezone=True), nullable=False)
    execution_end_time = Column(DateTime(timezone=True))
    duration_seconds = Column(Integer)

    # Results
    status = Column(String(50), nullable=False)  # 'success', 'failed', 'timeout', 'error'
    exit_code = Column(Integer)
    stdout_log = Column(Text)  # Claude's output
    stderr_log = Column(Text)  # Error messages

    # Metrics
    files_created = Column(ARRAY(String))  # Files created during execution
    files_modified = Column(ARRAY(String))  # Files modified
    commands_executed = Column(Integer, default=0)
    api_calls_made = Column(Integer, default=0)

    # Agent Activity
    agent_activities = Column(JSONBType)  # Array of agent activity objects from post-task hooks

    # Report
    summary = Column(Text)  # AI-generated summary of what was accomplished
    success = Column(Boolean)
    errors = Column(ARRAY(String))  # List of errors encountered

    # Audit Trail
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Full Logs
    full_log_path = Column(String(500))  # Path to complete log file

    # Relationships
    scheduled_task = relationship("ScheduledClaudeTask", back_populates="execution_reports")

    def __repr__(self):
        return f"<TaskExecutionReport(id={self.id}, status={self.status}, success={self.success})>"
