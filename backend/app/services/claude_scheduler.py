"""
Claude Code Scheduler Service - FULL IMPLEMENTATION
APScheduler-based service for triggering Claude Code instances at scheduled times

This service:
- Monitors scheduled_claude_tasks table
- Triggers Claude Code execution at scheduled times
- Captures execution logs and metrics
- Generates TaskExecutionReports
- Handles recurrence (daily, weekly, monthly)
"""

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, timezone, timedelta
import subprocess
import json
import os
import logging
import re
from typing import Dict, List, Optional

# Import database session and models
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db_setup import SessionLocal
from app.models.scheduled_claude_task import ScheduledClaudeTask, TaskExecutionReport

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = BackgroundScheduler()


def init_scheduler():
    """Initialize APScheduler on application startup"""
    try:
        scheduler.start()
        logger.info("Claude Code Scheduler initialized successfully")

        # Load existing pending tasks from database
        load_pending_tasks()

        logger.info("Scheduler is running and monitoring for scheduled tasks")
    except Exception as e:
        logger.error(f"Failed to initialize scheduler: {str(e)}")
        raise


def shutdown_scheduler():
    """Shutdown scheduler gracefully"""
    try:
        scheduler.shutdown(wait=True)
        logger.info("Claude Code Scheduler shutdown successfully")
    except Exception as e:
        logger.error(f"Error shutting down scheduler: {str(e)}")


def load_pending_tasks():
    """Load all pending tasks from database and schedule them"""
    db = SessionLocal()
    try:
        pending_tasks = db.query(ScheduledClaudeTask).filter(
            ScheduledClaudeTask.status == 'pending',
            ScheduledClaudeTask.next_execution_time.isnot(None)
        ).all()

        loaded_count = 0
        for task in pending_tasks:
            try:
                schedule_task(str(task.id), task.next_execution_time, task.recurrence)
                loaded_count += 1
            except Exception as e:
                logger.error(f"Failed to load task {task.id}: {str(e)}")

        logger.info(f"Loaded {loaded_count} pending tasks into scheduler")

    except Exception as e:
        logger.error(f"Error loading pending tasks: {str(e)}")
    finally:
        db.close()


def schedule_task(task_id: str, scheduled_time: datetime, recurrence: str = 'once'):
    """
    Add task to APScheduler

    Args:
        task_id: UUID of scheduled task
        scheduled_time: datetime when task should run
        recurrence: 'once', 'daily', 'weekly', 'monthly'
    """
    job_id = f"claude_task_{task_id}"

    try:
        # Remove existing job if present
        if scheduler.get_job(job_id):
            scheduler.remove_job(job_id)

        # Create appropriate trigger based on recurrence
        if recurrence == 'once':
            trigger = DateTrigger(run_date=scheduled_time)

        elif recurrence == 'daily':
            trigger = CronTrigger(
                hour=scheduled_time.hour,
                minute=scheduled_time.minute,
                second=0
            )

        elif recurrence == 'weekly':
            trigger = CronTrigger(
                day_of_week=scheduled_time.weekday(),
                hour=scheduled_time.hour,
                minute=scheduled_time.minute,
                second=0
            )

        elif recurrence == 'monthly':
            trigger = CronTrigger(
                day=scheduled_time.day,
                hour=scheduled_time.hour,
                minute=scheduled_time.minute,
                second=0
            )

        else:
            # Default to one-time execution
            trigger = DateTrigger(run_date=scheduled_time)

        # Add job to scheduler
        scheduler.add_job(
            execute_claude_task,
            trigger=trigger,
            id=job_id,
            args=[task_id],
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300  # Allow 5 minutes grace if task missed
        )

        logger.info(f"Scheduled task {task_id} at {scheduled_time} (recurrence: {recurrence})")

    except Exception as e:
        logger.error(f"Failed to schedule task {task_id}: {str(e)}")
        raise


def cancel_scheduled_task(task_id: str):
    """Remove task from APScheduler"""
    job_id = f"claude_task_{task_id}"

    try:
        if scheduler.get_job(job_id):
            scheduler.remove_job(job_id)
            logger.info(f"Cancelled scheduled task: {task_id}")
        else:
            logger.warning(f"Task {task_id} not found in scheduler")

    except Exception as e:
        logger.error(f"Error cancelling task {task_id}: {str(e)}")


def trigger_task_now(task_id: str):
    """Execute task immediately (manual trigger)"""
    logger.info(f"Manually triggering task: {task_id}")
    execute_claude_task(task_id)


def execute_claude_task(task_id: str):
    """
    Execute Claude Code instance with YOLO mode
    This is called by APScheduler at scheduled time or manually
    """
    db = SessionLocal()

    try:
        # Get task from database
        task = db.query(ScheduledClaudeTask).filter(ScheduledClaudeTask.id == task_id).first()

        if not task:
            logger.error(f"Task not found: {task_id}")
            return

        logger.info(f"Executing Claude Code task: {task.title} (ID: {task_id})")

        # Update task status
        task.status = 'active'
        task.last_execution_time = datetime.now(timezone.utc)
        task.execution_count += 1
        db.commit()

        # Create execution report
        report = TaskExecutionReport(
            scheduled_task_id=task.id,
            execution_start_time=datetime.now(timezone.utc),
            status='running',
            success=False
        )
        db.add(report)
        db.commit()
        db.refresh(report)

        # Execute Claude Code
        result = run_claude_code_instance(task, report)

        # Update report with results
        report.execution_end_time = datetime.now(timezone.utc)
        report.duration_seconds = int((report.execution_end_time - report.execution_start_time).total_seconds())
        report.status = 'success' if result['success'] else 'failed'
        report.success = result['success']
        report.exit_code = result.get('exit_code', 0)
        report.stdout_log = result.get('stdout', '')
        report.stderr_log = result.get('stderr', '')
        report.summary = result.get('summary', '')
        report.files_created = result.get('files_created', [])
        report.files_modified = result.get('files_modified', [])
        report.commands_executed = result.get('commands_executed', 0)
        report.full_log_path = result.get('log_path', '')
        report.errors = result.get('errors', [])

        db.commit()

        # Update task status and next execution time
        task.status = 'pending' if task.recurrence != 'once' else 'completed'

        if task.recurrence != 'once':
            # Calculate next execution time
            task.next_execution_time = calculate_next_execution_time(task)
        else:
            task.next_execution_time = None

        db.commit()

        logger.info(f"Task execution completed: {task.title} (success: {result['success']}, duration: {report.duration_seconds}s)")

    except Exception as e:
        logger.error(f"Error executing task {task_id}: {str(e)}")

        # Update task status to failed
        if task:
            task.status = 'failed'
            db.commit()

        # Update report if exists
        try:
            if report:
                report.status = 'error'
                report.success = False
                report.execution_end_time = datetime.now(timezone.utc)
                report.stderr_log = str(e)
                report.errors = [str(e)]
                db.commit()
        except:
            pass

    finally:
        db.close()


def run_claude_code_instance(task: ScheduledClaudeTask, report: TaskExecutionReport) -> Dict:
    """
    Launch Claude Code CLI with YOLO mode and capture results

    Args:
        task: ScheduledClaudeTask instance
        report: TaskExecutionReport instance for logging

    Returns:
        Dict with execution results
    """
    # Create log directory
    log_dir = os.path.join(os.getcwd(), 'logs', 'scheduled-claude-tasks')
    os.makedirs(log_dir, exist_ok=True)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    log_file_path = os.path.join(log_dir, f"{task.id}_{timestamp}.log")

    # Determine working directory
    working_dir = task.working_directory or os.getcwd()

    # Validate working directory exists
    if not os.path.exists(working_dir):
        logger.error(f"Working directory does not exist: {working_dir}")
        return {
            'success': False,
            'exit_code': -1,
            'stdout': '',
            'stderr': f'Working directory does not exist: {working_dir}',
            'log_path': log_file_path,
            'summary': 'Failed: Invalid working directory',
            'files_created': [],
            'files_modified': [],
            'commands_executed': 0,
            'errors': ['Invalid working directory']
        }

    # Build Claude Code command with YOLO mode
    # YOLO mode means Claude executes autonomously without asking for permission
    cmd = [
        'claude',
        '--yolo',  # YOLO mode (autonomous execution)
        '--cwd', working_dir,
    ]

    # Add agent type if specified
    if task.agent_type and task.agent_type != 'general-purpose':
        cmd.extend(['--agent', task.agent_type])

    # Add playbook if specified
    if task.playbook:
        cmd.extend(['--playbook', task.playbook])

    # Add skills if specified
    if task.skills and len(task.skills) > 0:
        cmd.extend(['--skills', ','.join(task.skills)])

    # Add prompt (the instruction to Claude)
    cmd.extend(['--prompt', task.prompt])

    logger.info(f"Executing Claude Code: {' '.join(cmd)}")

    try:
        # Execute Claude Code with timeout
        result = subprocess.run(
            cmd,
            cwd=working_dir,
            capture_output=True,
            text=True,
            timeout=task.max_execution_time,
            env=os.environ.copy()
        )

        # Write full output to log file
        with open(log_file_path, 'w', encoding='utf-8') as f:
            f.write(f"=== Claude Code Execution Log ===\n")
            f.write(f"Task ID: {task.id}\n")
            f.write(f"Task Title: {task.title}\n")
            f.write(f"Start Time: {report.execution_start_time}\n")
            f.write(f"Prompt: {task.prompt}\n")
            f.write(f"Working Directory: {working_dir}\n")
            f.write(f"YOLO Mode: {task.yolo_mode_enabled}\n")
            f.write(f"Agent Type: {task.agent_type}\n")
            f.write(f"\n=== STDOUT ===\n")
            f.write(result.stdout)
            f.write(f"\n=== STDERR ===\n")
            f.write(result.stderr)
            f.write(f"\n=== Exit Code: {result.returncode} ===\n")

        # Parse results from stdout
        execution_summary = parse_claude_output(result.stdout, result.stderr)

        return {
            'success': result.returncode == 0,
            'exit_code': result.returncode,
            'stdout': result.stdout,
            'stderr': result.stderr,
            'log_path': log_file_path,
            'summary': execution_summary.get('summary', ''),
            'files_created': execution_summary.get('files_created', []),
            'files_modified': execution_summary.get('files_modified', []),
            'commands_executed': execution_summary.get('commands_executed', 0),
            'errors': execution_summary.get('errors', [])
        }

    except subprocess.TimeoutExpired:
        logger.error(f"Claude Code execution timeout for task {task.id} (max: {task.max_execution_time}s)")

        with open(log_file_path, 'w', encoding='utf-8') as f:
            f.write(f"=== Claude Code Execution Log ===\n")
            f.write(f"Task ID: {task.id}\n")
            f.write(f"ERROR: Execution timeout after {task.max_execution_time} seconds\n")

        return {
            'success': False,
            'exit_code': -1,
            'stdout': '',
            'stderr': f'Execution timeout after {task.max_execution_time} seconds',
            'log_path': log_file_path,
            'summary': f'Task execution timed out ({task.max_execution_time}s)',
            'files_created': [],
            'files_modified': [],
            'commands_executed': 0,
            'errors': ['Execution timeout']
        }

    except FileNotFoundError:
        logger.error("Claude CLI not found. Is Claude Code installed?")

        return {
            'success': False,
            'exit_code': -1,
            'stdout': '',
            'stderr': 'Claude CLI not found. Install Claude Code first.',
            'log_path': log_file_path,
            'summary': 'Failed: Claude Code not installed',
            'files_created': [],
            'files_modified': [],
            'commands_executed': 0,
            'errors': ['Claude Code not installed']
        }

    except Exception as e:
        logger.error(f"Error running Claude Code: {str(e)}")

        with open(log_file_path, 'w', encoding='utf-8') as f:
            f.write(f"=== Claude Code Execution Log ===\n")
            f.write(f"Task ID: {task.id}\n")
            f.write(f"ERROR: {str(e)}\n")

        return {
            'success': False,
            'exit_code': -1,
            'stdout': '',
            'stderr': str(e),
            'log_path': log_file_path,
            'summary': f'Execution error: {str(e)}',
            'files_created': [],
            'files_modified': [],
            'commands_executed': 0,
            'errors': [str(e)]
        }


def parse_claude_output(stdout: str, stderr: str) -> Dict:
    """
    Parse Claude Code execution output to extract metrics and summary

    Args:
        stdout: Standard output from Claude
        stderr: Standard error from Claude

    Returns:
        Dict with parsed metrics
    """
    summary = {
        'summary': '',
        'files_created': [],
        'files_modified': [],
        'commands_executed': 0,
        'errors': []
    }

    try:
        lines = stdout.split('\n')

        # Track tool usage patterns
        write_count = 0
        edit_count = 0
        bash_count = 0
        task_count = 0

        for line in lines:
            line_lower = line.lower()

            # Detect file operations
            if 'write' in line_lower or 'created file' in line_lower:
                write_count += 1
                # Try to extract file path
                match = re.search(r'(?:write|created)\s+(?:file\s+)?[:\s]*([\w/\\.-]+)', line, re.IGNORECASE)
                if match:
                    file_path = match.group(1)
                    if file_path not in summary['files_created']:
                        summary['files_created'].append(file_path)

            if 'edit' in line_lower or 'modified file' in line_lower:
                edit_count += 1
                match = re.search(r'(?:edit|modified)\s+(?:file\s+)?[:\s]*([\w/\\.-]+)', line, re.IGNORECASE)
                if match:
                    file_path = match.group(1)
                    if file_path not in summary['files_modified']:
                        summary['files_modified'].append(file_path)

            # Detect command executions
            if 'bash' in line_lower or 'command:' in line_lower or 'executing:' in line_lower:
                bash_count += 1

            # Detect task spawning
            if 'task' in line_lower and ('spawn' in line_lower or 'agent' in line_lower):
                task_count += 1

        # Count commands
        summary['commands_executed'] = bash_count + task_count

        # Extract errors from stderr
        if stderr:
            error_lines = [line for line in stderr.split('\n') if line.strip() and 'error' in line.lower()]
            summary['errors'] = error_lines[:10]  # Limit to 10 errors

        # Generate summary text
        parts = []
        if write_count > 0:
            parts.append(f"created {write_count} files")
        if edit_count > 0:
            parts.append(f"modified {edit_count} files")
        if bash_count > 0:
            parts.append(f"executed {bash_count} commands")
        if task_count > 0:
            parts.append(f"spawned {task_count} agents")

        if parts:
            summary['summary'] = "Claude " + ", ".join(parts)
        elif summary['errors']:
            summary['summary'] = f"Failed with {len(summary['errors'])} errors"
        else:
            summary['summary'] = "Execution completed (no file changes detected)"

    except Exception as e:
        logger.error(f"Error parsing Claude output: {str(e)}")
        summary['summary'] = 'Execution completed (parsing failed)'
        summary['errors'].append(f'Parser error: {str(e)}')

    return summary


def calculate_next_execution_time(task: ScheduledClaudeTask) -> Optional[datetime]:
    """
    Calculate next execution time based on recurrence pattern

    Args:
        task: ScheduledClaudeTask instance

    Returns:
        Next execution datetime or None if task is one-time
    """
    now = datetime.now(timezone.utc)

    if task.recurrence == 'daily':
        # Next day at same time
        next_time = now + timedelta(days=1)
        return next_time.replace(
            hour=task.scheduled_time.hour,
            minute=task.scheduled_time.minute,
            second=0,
            microsecond=0
        )

    elif task.recurrence == 'weekly':
        # Next week at same day and time
        next_time = now + timedelta(weeks=1)
        return next_time.replace(
            hour=task.scheduled_time.hour,
            minute=task.scheduled_time.minute,
            second=0,
            microsecond=0
        )

    elif task.recurrence == 'monthly':
        # Next month at same day (handle month-end edge cases)
        if now.month == 12:
            next_month = 1
            next_year = now.year + 1
        else:
            next_month = now.month + 1
            next_year = now.year

        # Handle days that don't exist in some months (e.g., Feb 30)
        target_day = min(task.scheduled_time.day, 28)

        next_time = now.replace(
            year=next_year,
            month=next_month,
            day=target_day,
            hour=task.scheduled_time.hour,
            minute=task.scheduled_time.minute,
            second=0,
            microsecond=0
        )

        return next_time

    else:
        # One-time task or unknown recurrence
        return None


# Export functions for external use
__all__ = [
    'init_scheduler',
    'shutdown_scheduler',
    'schedule_task',
    'cancel_scheduled_task',
    'trigger_task_now',
    'execute_claude_task'
]
