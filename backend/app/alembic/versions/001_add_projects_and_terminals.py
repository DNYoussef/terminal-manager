"""Add projects and terminals tables

Revision ID: 001_projects_terminals
Revises:
Create Date: 2025-11-15

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime

# revision identifiers, used by Alembic.
revision = '001_projects_terminals'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create projects table
    op.create_table(
        'projects',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('path', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, default=datetime.utcnow),
        sa.Column('last_opened_at', sa.DateTime(), nullable=True),
    )

    # Create unique index on path
    op.create_index('ix_projects_path', 'projects', ['path'], unique=True)

    # Create terminals table
    op.create_table(
        'terminals',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id'), nullable=True),
        sa.Column('pid', sa.Integer(), nullable=False),
        sa.Column('working_dir', sa.Text(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, default='active'),
        sa.Column('created_at', sa.DateTime(), nullable=False, default=datetime.utcnow),
        sa.Column('last_activity_at', sa.DateTime(), nullable=False, default=datetime.utcnow),
    )

    # Create index on project_id for faster lookups
    op.create_index('ix_terminals_project_id', 'terminals', ['project_id'])

    # Create index on status for filtering
    op.create_index('ix_terminals_status', 'terminals', ['status'])

    # Create terminal_output table
    op.create_table(
        'terminal_output',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('terminal_id', sa.String(36), sa.ForeignKey('terminals.id', ondelete='CASCADE'), nullable=False),
        sa.Column('line', sa.Text(), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=False, default=datetime.utcnow),
    )

    # Create index on terminal_id for faster lookups
    op.create_index('ix_terminal_output_terminal_id', 'terminal_output', ['terminal_id'])

    # Create index on timestamp for time-based queries
    op.create_index('ix_terminal_output_timestamp', 'terminal_output', ['timestamp'])


def downgrade() -> None:
    # Drop tables in reverse order (handle foreign keys)
    op.drop_table('terminal_output')
    op.drop_table('terminals')
    op.drop_table('projects')
