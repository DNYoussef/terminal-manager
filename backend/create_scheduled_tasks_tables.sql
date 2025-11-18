-- Database Migration: Scheduled Claude Tasks
-- Creates tables for calendar-triggered Claude Code instances

-- Table 1: Scheduled Claude Tasks
CREATE TABLE IF NOT EXISTS scheduled_claude_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Scheduling Information
    title VARCHAR(255) NOT NULL,
    description TEXT,
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    recurrence VARCHAR(50), -- 'once', 'daily', 'weekly', 'monthly'
    recurrence_config JSONB DEFAULT '{}'::jsonb,

    -- Claude Code Configuration
    prompt TEXT NOT NULL,
    yolo_mode_enabled BOOLEAN DEFAULT true,
    max_execution_time INTEGER DEFAULT 3600, -- seconds
    working_directory VARCHAR(500),

    -- Agent Configuration
    agent_type VARCHAR(100), -- 'coder', 'researcher', 'reviewer', etc.
    playbook VARCHAR(100), -- Optional playbook to use
    skills TEXT[], -- Array of skills to enable

    -- Context
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    terminal_id UUID REFERENCES terminals(id) ON DELETE SET NULL,

    -- Execution Control
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'active', 'completed', 'failed', 'cancelled'
    last_execution_time TIMESTAMP WITH TIME ZONE,
    next_execution_time TIMESTAMP WITH TIME ZONE,
    execution_count INTEGER DEFAULT 0,

    -- Audit
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Task Metadata
    task_metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for scheduled_claude_tasks
CREATE INDEX idx_scheduled_claude_next_execution ON scheduled_claude_tasks(next_execution_time) WHERE status = 'pending';
CREATE INDEX idx_scheduled_claude_project ON scheduled_claude_tasks(project_id);
CREATE INDEX idx_scheduled_claude_status ON scheduled_claude_tasks(status);
CREATE INDEX idx_scheduled_claude_recurrence ON scheduled_claude_tasks(recurrence);
CREATE INDEX idx_scheduled_claude_created_at ON scheduled_claude_tasks(created_at DESC);

-- Table 2: Task Execution Reports
CREATE TABLE IF NOT EXISTS task_execution_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Task Reference
    scheduled_task_id UUID REFERENCES scheduled_claude_tasks(id) ON DELETE CASCADE NOT NULL,

    -- Execution Details
    execution_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    execution_end_time TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,

    -- Results
    status VARCHAR(50) NOT NULL, -- 'success', 'failed', 'timeout', 'error'
    exit_code INTEGER,
    stdout_log TEXT, -- Claude's output
    stderr_log TEXT, -- Error messages

    -- Metrics
    files_created TEXT[], -- Files created during execution
    files_modified TEXT[], -- Files modified
    commands_executed INTEGER DEFAULT 0,
    api_calls_made INTEGER DEFAULT 0,

    -- Agent Activity
    agent_activities JSONB DEFAULT '[]'::jsonb, -- Array of agent activity objects from post-task hooks

    -- Report
    summary TEXT, -- AI-generated summary of what was accomplished
    success BOOLEAN,
    errors TEXT[], -- List of errors encountered

    -- Audit Trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Full Logs
    full_log_path VARCHAR(500) -- Path to complete log file
);

-- Indexes for task_execution_reports
CREATE INDEX idx_task_reports_scheduled_task ON task_execution_reports(scheduled_task_id);
CREATE INDEX idx_task_reports_status ON task_execution_reports(status);
CREATE INDEX idx_task_reports_execution_time ON task_execution_reports(execution_start_time DESC);
CREATE INDEX idx_task_reports_success ON task_execution_reports(success);

-- Comments for documentation
COMMENT ON TABLE scheduled_claude_tasks IS 'Stores calendar-scheduled Claude Code tasks for autonomous execution';
COMMENT ON TABLE task_execution_reports IS 'Execution reports and logs for scheduled Claude Code tasks';

COMMENT ON COLUMN scheduled_claude_tasks.yolo_mode_enabled IS 'When true, Claude executes autonomously without asking for permission';
COMMENT ON COLUMN scheduled_claude_tasks.max_execution_time IS 'Maximum execution time in seconds before timeout';
COMMENT ON COLUMN scheduled_claude_tasks.recurrence IS 'Recurrence pattern: once, daily, weekly, or monthly';
COMMENT ON COLUMN scheduled_claude_tasks.next_execution_time IS 'Next scheduled execution time (calculated based on recurrence)';

COMMENT ON COLUMN task_execution_reports.agent_activities IS 'JSON array of agent activities captured from post-task hooks';
COMMENT ON COLUMN task_execution_reports.full_log_path IS 'Absolute path to complete execution log file on filesystem';
