"""
Run database migration for scheduled Claude tasks
"""
import sys
import os
sys.path.insert(0, 'C:\\Users\\17175\\terminal-manager\\backend')

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

from app.db_setup import engine
from app.models.scheduled_claude_task import Base

try:
    # Create all tables defined in the Base metadata
    Base.metadata.create_all(engine)
    print("SUCCESS: Database migration completed successfully!")
    print("   - scheduled_claude_tasks table created")
    print("   - task_execution_reports table created")
    print("   - All indexes and constraints applied")
except Exception as e:
    print(f"ERROR: Migration failed: {e}")
    sys.exit(1)
