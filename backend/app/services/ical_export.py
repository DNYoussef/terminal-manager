"""
iCal Export Service

Exports tasks to iCalendar (.ics) format for import into Google Calendar, Outlook, etc.

Features:
- RFC 5545 compliant iCal format
- Support for recurring tasks
- Reminders/alarms
- Color coding via categories
- Project and skill metadata
"""

from datetime import datetime, timedelta
from typing import List, Optional
from icalendar import Calendar, Event, Alarm
import pytz
from uuid import uuid4


class Task:
    """Task model for iCal export"""

    def __init__(
        self,
        id: str,
        name: str,
        description: str,
        start_time: datetime,
        end_time: datetime,
        project_name: str,
        skill_name: str,
        status: str,
        location: Optional[str] = None,
        is_recurring: bool = False,
        recurrence_rule: Optional[str] = None,
        reminder_minutes: int = 15,
    ):
        self.id = id
        self.name = name
        self.description = description
        self.start_time = start_time
        self.end_time = end_time
        self.project_name = project_name
        self.skill_name = skill_name
        self.status = status
        self.location = location
        self.is_recurring = is_recurring
        self.recurrence_rule = recurrence_rule
        self.reminder_minutes = reminder_minutes


class ICalExportService:
    """Service for exporting tasks to iCal format"""

    def __init__(self, timezone: str = "UTC"):
        """
        Initialize iCal export service

        Args:
            timezone: Timezone for events (e.g., "America/New_York")
        """
        self.timezone = pytz.timezone(timezone)

    def export_tasks(
        self,
        tasks: List[Task],
        calendar_name: str = "My Tasks",
        description: str = "Tasks exported from task management system",
    ) -> str:
        """
        Export tasks to iCal format

        Args:
            tasks: List of tasks to export
            calendar_name: Name of the calendar
            description: Calendar description

        Returns:
            iCal format string (.ics content)
        """
        # Create calendar
        cal = Calendar()
        cal.add('prodid', '-//Task Management System//EN')
        cal.add('version', '2.0')
        cal.add('calscale', 'GREGORIAN')
        cal.add('method', 'PUBLISH')
        cal.add('x-wr-calname', calendar_name)
        cal.add('x-wr-caldesc', description)
        cal.add('x-wr-timezone', str(self.timezone))

        # Add each task as an event
        for task in tasks:
            event = self._create_event(task)
            cal.add_component(event)

        # Return iCal string
        return cal.to_ical().decode('utf-8')

    def _create_event(self, task: Task) -> Event:
        """
        Create iCal event from task

        Args:
            task: Task to convert

        Returns:
            iCal Event object
        """
        event = Event()

        # Basic event properties
        event.add('uid', f'task-{task.id}@taskmanagement.local')
        event.add('summary', self._format_summary(task))
        event.add('description', self._format_description(task))

        # Time properties
        start_time = self._ensure_timezone(task.start_time)
        end_time = self._ensure_timezone(task.end_time)
        event.add('dtstart', start_time)
        event.add('dtend', end_time)
        event.add('dtstamp', datetime.now(self.timezone))

        # Location
        if task.location:
            event.add('location', task.location)

        # Categories for color coding and organization
        categories = [task.project_name, task.skill_name, task.status]
        if task.is_recurring:
            categories.append('Recurring')
        event.add('categories', categories)

        # Status mapping
        status_map = {
            'completed': 'CONFIRMED',
            'in_progress': 'CONFIRMED',
            'pending': 'TENTATIVE',
            'cancelled': 'CANCELLED',
        }
        event.add('status', status_map.get(task.status.lower(), 'CONFIRMED'))

        # Recurrence rule for recurring tasks
        if task.is_recurring and task.recurrence_rule:
            event.add('rrule', self._parse_recurrence_rule(task.recurrence_rule))

        # Add reminder/alarm
        if task.reminder_minutes > 0:
            alarm = self._create_alarm(task.reminder_minutes)
            event.add_component(alarm)

        # Custom properties for metadata
        event.add('x-project', task.project_name)
        event.add('x-skill', task.skill_name)
        event.add('x-task-id', task.id)

        return event

    def _format_summary(self, task: Task) -> str:
        """
        Format event summary with recurring indicator

        Args:
            task: Task object

        Returns:
            Formatted summary string
        """
        prefix = '🔁 ' if task.is_recurring else ''
        return f'{prefix}{task.name}'

    def _format_description(self, task: Task) -> str:
        """
        Format detailed event description

        Args:
            task: Task object

        Returns:
            Formatted description string
        """
        lines = [
            task.description,
            '',
            f'Project: {task.project_name}',
            f'Skill: {task.skill_name}',
            f'Status: {task.status}',
        ]

        if task.is_recurring:
            lines.append('Recurring: Yes')
            if task.recurrence_rule:
                lines.append(f'Schedule: {task.recurrence_rule}')

        return '\n'.join(lines)

    def _ensure_timezone(self, dt: datetime) -> datetime:
        """
        Ensure datetime has timezone info

        Args:
            dt: Datetime object

        Returns:
            Timezone-aware datetime
        """
        if dt.tzinfo is None:
            return self.timezone.localize(dt)
        return dt.astimezone(self.timezone)

    def _parse_recurrence_rule(self, cron_expression: str) -> dict:
        """
        Convert cron expression to iCal RRULE

        Args:
            cron_expression: Cron schedule (e.g., "0 9 * * 1")

        Returns:
            RRULE dictionary
        """
        # Parse cron expression
        # Format: minute hour day month weekday
        parts = cron_expression.split()

        if len(parts) != 5:
            return {'freq': 'DAILY', 'interval': 1}

        minute, hour, day, month, weekday = parts

        # Determine frequency
        if weekday != '*':
            # Weekly recurrence
            weekday_map = {
                '0': 'SU', '1': 'MO', '2': 'TU', '3': 'WE',
                '4': 'TH', '5': 'FR', '6': 'SA'
            }
            byday = weekday_map.get(weekday.split('/')[0], 'MO')

            rule = {'freq': 'WEEKLY', 'byday': byday}

            # Handle bi-weekly (e.g., "1/2" = every 2 weeks)
            if '/' in weekday:
                interval = int(weekday.split('/')[1])
                rule['interval'] = interval

            return rule

        elif day != '*':
            # Monthly recurrence
            return {'freq': 'MONTHLY', 'bymonthday': int(day)}

        else:
            # Daily recurrence
            return {'freq': 'DAILY', 'interval': 1}

    def _create_alarm(self, minutes_before: int) -> Alarm:
        """
        Create reminder alarm

        Args:
            minutes_before: Minutes before event to trigger reminder

        Returns:
            iCal Alarm object
        """
        alarm = Alarm()
        alarm.add('action', 'DISPLAY')
        alarm.add('description', 'Task Reminder')
        alarm.add('trigger', timedelta(minutes=-minutes_before))
        return alarm


# FastAPI endpoint example
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import List

router = APIRouter()


class TaskExportRequest(BaseModel):
    task_ids: List[str]
    timezone: str = "UTC"
    calendar_name: str = "My Tasks"


@router.post("/api/tasks/export/ical")
async def export_tasks_to_ical(request: TaskExportRequest):
    '''
    Export tasks to iCal format

    Returns .ics file for download
    '''
    try:
        # Fetch tasks from database
        tasks = await get_tasks_by_ids(request.task_ids)

        # Convert to Task objects
        task_objects = [
            Task(
                id=task.id,
                name=task.name,
                description=task.description or '',
                start_time=task.start_time,
                end_time=task.end_time,
                project_name=task.project.name,
                skill_name=task.skill.name,
                status=task.status,
                is_recurring=task.is_recurring,
                recurrence_rule=task.recurrence_rule,
                reminder_minutes=15,
            )
            for task in tasks
        ]

        # Export to iCal
        service = ICalExportService(timezone=request.timezone)
        ical_content = service.export_tasks(
            task_objects,
            calendar_name=request.calendar_name,
        )

        # Return as downloadable file
        return Response(
            content=ical_content,
            media_type='text/calendar',
            headers={
                'Content-Disposition': f'attachment; filename="{request.calendar_name}.ics"'
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
"""
