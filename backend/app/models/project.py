"""
Project database model
"""
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.orm import relationship
from app.db_setup import Base


class Project(Base):
    """Project model"""
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True)  # UUID
    name = Column(String(255), nullable=False)
    path = Column(Text, nullable=False, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_opened_at = Column(DateTime, nullable=True)

    # Relationships
    terminals = relationship("Terminal", back_populates="project", cascade="all, delete-orphan")
    scheduled_claude_tasks = relationship("ScheduledClaudeTask", back_populates="project")

    def __repr__(self):
        return f"<Project(id={self.id}, name={self.name}, path={self.path})>"
