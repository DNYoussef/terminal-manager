"""
Terminal database model
"""
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.db_setup import Base


class TerminalStatus(str, Enum):
    """Terminal status enum"""
    ACTIVE = "active"
    IDLE = "idle"
    STOPPED = "stopped"
    ERROR = "error"


class Terminal(Base):
    """Terminal session model"""
    __tablename__ = "terminals"

    id = Column(String(36), primary_key=True)  # UUID
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)  # CRITICAL FIX #6
    pid = Column(Integer, nullable=False)
    working_dir = Column(Text, nullable=False)
    status = Column(String(20), default=TerminalStatus.ACTIVE.value, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_activity_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    project = relationship("Project", back_populates="terminals")
    output_lines = relationship("TerminalOutput", back_populates="terminal", cascade="all, delete-orphan")
    scheduled_claude_tasks = relationship("ScheduledClaudeTask", back_populates="terminal")

    def __repr__(self):
        return f"<Terminal(id={self.id}, project_id={self.project_id}, status={self.status})>"


class TerminalOutput(Base):
    """Terminal output line model"""
    __tablename__ = "terminal_output"

    id = Column(Integer, primary_key=True, autoincrement=True)
    terminal_id = Column(String(36), ForeignKey("terminals.id", ondelete="CASCADE"), nullable=False)
    line = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    terminal = relationship("Terminal", back_populates="output_lines")

    def __repr__(self):
        return f"<TerminalOutput(id={self.id}, terminal_id={self.terminal_id})>"
