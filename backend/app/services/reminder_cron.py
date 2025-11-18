"""
Task Reminder Cron Service

Background cron job that checks for tasks with next_run_at in the next 15 minutes
and sends reminder notifications via WebSocket or email.

Features:
- Runs every minute to check for upcoming tasks
- Sends WebSocket notifications for real-time updates
- Sends email reminders via nodemailer/SMTP
- Prevents duplicate reminders
- Configurable reminder window (default 15 minutes)
"""

import asyncio
from datetime import datetime, timedelta
from typing import List, Optional
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
import logging

# Assuming WebSocket manager from P4_T3
from app.core.websocket import WebSocketManager
from app.models.task import Task
from app.models.user import User
from app.core.config import settings


logger = logging.getLogger(__name__)


class ReminderService:
    """Service for sending task reminders"""

    def __init__(
        self,
        ws_manager: WebSocketManager,
        reminder_window_minutes: int = 15,
    ):
        """
        Initialize reminder service

        Args:
            ws_manager: WebSocket connection manager
            reminder_window_minutes: How many minutes before task to send reminder
        """
        self.ws_manager = ws_manager
        self.reminder_window_minutes = reminder_window_minutes
        self.sent_reminders = set()  # Track sent reminders to prevent duplicates

    async def check_and_send_reminders(self, db: AsyncSession) -> int:
        """
        Check for upcoming tasks and send reminders

        Args:
            db: Database session

        Returns:
            Number of reminders sent
        """
        try:
            # Calculate time window
            now = datetime.utcnow()
            window_end = now + timedelta(minutes=self.reminder_window_minutes)

            # Query tasks with next_run_at in the window
            query = select(Task).where(
                and_(
                    Task.next_run_at.isnot(None),
                    Task.next_run_at >= now,
                    Task.next_run_at <= window_end,
                    Task.status.in_(['pending', 'in_progress']),
                )
            )

            result = await db.execute(query)
            tasks = result.scalars().all()

            reminders_sent = 0

            for task in tasks:
                # Skip if reminder already sent
                reminder_key = f"{task.id}_{task.next_run_at.isoformat()}"
                if reminder_key in self.sent_reminders:
                    continue

                # Send reminder
                success = await self._send_reminder(task, db)

                if success:
                    self.sent_reminders.add(reminder_key)
                    reminders_sent += 1

                    # Clean up old entries (keep last 1000)
                    if len(self.sent_reminders) > 1000:
                        oldest = list(self.sent_reminders)[:100]
                        self.sent_reminders -= set(oldest)

            logger.info(f"Sent {reminders_sent} task reminders")
            return reminders_sent

        except Exception as e:
            logger.error(f"Error checking reminders: {str(e)}", exc_info=True)
            return 0

    async def _send_reminder(self, task: Task, db: AsyncSession) -> bool:
        """
        Send reminder for a specific task

        Args:
            task: Task to send reminder for
            db: Database session

        Returns:
            True if reminder sent successfully
        """
        try:
            # Get task owner
            user_query = select(User).where(User.id == task.user_id)
            user_result = await db.execute(user_query)
            user = user_result.scalar_one_or_none()

            if not user:
                logger.warning(f"User not found for task {task.id}")
                return False

            # Prepare reminder data
            reminder_data = {
                'id': f"reminder_{task.id}_{int(datetime.utcnow().timestamp())}",
                'taskId': str(task.id),
                'taskName': task.name,
                'taskDescription': task.description or '',
                'scheduledTime': task.next_run_at.isoformat(),
                'projectName': task.project.name if task.project else 'No Project',
                'skillName': task.skill.name if task.skill else 'No Skill',
            }

            # Send WebSocket notification
            await self._send_websocket_notification(str(user.id), reminder_data)

            # Send email notification if user has email and preferences enabled
            if user.email and user.email_notifications_enabled:
                await self._send_email_notification(user, task, reminder_data)

            return True

        except Exception as e:
            logger.error(f"Error sending reminder for task {task.id}: {str(e)}", exc_info=True)
            return False

    async def _send_websocket_notification(self, user_id: str, reminder_data: dict):
        """
        Send reminder via WebSocket

        Args:
            user_id: User ID to send notification to
            reminder_data: Reminder payload
        """
        try:
            await self.ws_manager.send_to_user(
                user_id=user_id,
                event='task_reminder',
                data=reminder_data,
            )
            logger.info(f"Sent WebSocket reminder for task {reminder_data['taskId']} to user {user_id}")
        except Exception as e:
            logger.error(f"Error sending WebSocket notification: {str(e)}", exc_info=True)

    async def _send_email_notification(self, user: User, task: Task, reminder_data: dict):
        """
        Send reminder via email (nodemailer equivalent in Python)

        Args:
            user: User to send email to
            task: Task object
            reminder_data: Reminder payload
        """
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = f"Reminder: {task.name}"
            msg['From'] = settings.SMTP_FROM_EMAIL
            msg['To'] = user.email

            # Plain text version
            text_content = f"""
Task Reminder

Task: {task.name}
Description: {task.description or 'No description'}

Scheduled Time: {task.next_run_at.strftime('%B %d, %Y at %I:%M %p')}
Project: {reminder_data['projectName']}
Skill: {reminder_data['skillName']}

View your tasks: {settings.APP_URL}/calendar
"""

            # HTML version
            html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #3b82f6; color: white; padding: 20px; border-radius: 5px 5px 0 0; }}
        .content {{ background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }}
        .task-info {{ background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }}
        .button {{ background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }}
        .footer {{ text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔔 Task Reminder</h1>
        </div>
        <div class="content">
            <h2>{task.name}</h2>
            <div class="task-info">
                <p><strong>Description:</strong><br>{task.description or 'No description'}</p>
                <p><strong>📅 Scheduled:</strong> {task.next_run_at.strftime('%B %d, %Y at %I:%M %p')}</p>
                <p><strong>📁 Project:</strong> {reminder_data['projectName']}</p>
                <p><strong>🎯 Skill:</strong> {reminder_data['skillName']}</p>
            </div>
            <p style="text-align: center; margin: 30px 0;">
                <a href="{settings.APP_URL}/calendar" class="button">View in Calendar</a>
            </p>
        </div>
        <div class="footer">
            <p>You're receiving this because you enabled email notifications for task reminders.</p>
            <p>To manage your notification preferences, visit your <a href="{settings.APP_URL}/settings">settings</a>.</p>
        </div>
    </div>
</body>
</html>
"""

            # Attach parts
            part1 = MIMEText(text_content, 'plain')
            part2 = MIMEText(html_content, 'html')
            msg.attach(part1)
            msg.attach(part2)

            # Send email via SMTP
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                if settings.SMTP_USE_TLS:
                    server.starttls()
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)

            logger.info(f"Sent email reminder for task {task.id} to {user.email}")

        except Exception as e:
            logger.error(f"Error sending email notification: {str(e)}", exc_info=True)


class ReminderCronJob:
    """Cron job for running reminder checks"""

    def __init__(self, reminder_service: ReminderService, db_session_factory):
        """
        Initialize cron job

        Args:
            reminder_service: Reminder service instance
            db_session_factory: Database session factory
        """
        self.reminder_service = reminder_service
        self.db_session_factory = db_session_factory
        self.is_running = False

    async def start(self):
        """Start the cron job (runs every minute)"""
        self.is_running = True
        logger.info("Starting reminder cron job (checking every 60 seconds)")

        while self.is_running:
            try:
                async with self.db_session_factory() as db:
                    await self.reminder_service.check_and_send_reminders(db)

            except Exception as e:
                logger.error(f"Error in reminder cron job: {str(e)}", exc_info=True)

            # Wait 60 seconds before next check
            await asyncio.sleep(60)

    def stop(self):
        """Stop the cron job"""
        self.is_running = False
        logger.info("Stopping reminder cron job")


# FastAPI startup integration
"""
from fastapi import FastAPI
from app.core.websocket import get_websocket_manager
from app.db.session import async_session

app = FastAPI()

# Initialize services
ws_manager = get_websocket_manager()
reminder_service = ReminderService(ws_manager)
reminder_cron = ReminderCronJob(reminder_service, async_session)


@app.on_event("startup")
async def startup_event():
    '''Start background tasks on application startup'''
    # Start reminder cron job
    asyncio.create_task(reminder_cron.start())
    logger.info("Application started, reminder cron job running")


@app.on_event("shutdown")
async def shutdown_event():
    '''Stop background tasks on application shutdown'''
    reminder_cron.stop()
    logger.info("Application shutting down, reminder cron job stopped")
"""
