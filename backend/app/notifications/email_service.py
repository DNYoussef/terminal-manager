"""
Email Notification Service
Handles task reminders, failure notifications, and weekly summaries using SMTP
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from jinja2 import Template
import asyncio
from concurrent.futures import ThreadPoolExecutor

from app.database import get_db


class EmailService:
    """Email notification service using nodemailer-style SMTP configuration"""

    def __init__(self):
        self.smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', '587'))
        self.smtp_user = os.getenv('SMTP_USER')
        self.smtp_password = os.getenv('SMTP_PASSWORD')
        self.from_email = os.getenv('FROM_EMAIL', self.smtp_user)
        self.from_name = os.getenv('FROM_NAME', 'AI Agent Scheduler')
        self.executor = ThreadPoolExecutor(max_workers=3)

    async def send_email_async(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """Send email asynchronously using thread pool"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self.executor,
            self._send_email_sync,
            to_email,
            subject,
            html_content,
            text_content
        )

    def _send_email_sync(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """Synchronous email sending (runs in thread pool)"""
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email

            # Add text part (fallback)
            if text_content:
                text_part = MIMEText(text_content, 'plain')
                msg.attach(text_part)

            # Add HTML part
            html_part = MIMEText(html_content, 'html')
            msg.attach(html_part)

            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                if self.smtp_user and self.smtp_password:
                    server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)

            print(f"✅ Email sent successfully to {to_email}: {subject}")
            return True

        except Exception as e:
            print(f"❌ Email send failed to {to_email}: {str(e)}")
            return False

    async def send_task_reminder(
        self,
        task_id: int,
        task_name: str,
        next_run_at: datetime,
        user_email: str
    ) -> bool:
        """Send task reminder 15 minutes before execution"""

        time_until = next_run_at - datetime.now()
        minutes = int(time_until.total_seconds() / 60)

        html_template = """
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #4CAF50; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
                .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
                .task-info { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4CAF50; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 0.9em; }
                .cta-button {
                    display: inline-block;
                    padding: 12px 24px;
                    background: #4CAF50;
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 15px 0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>⏰ Task Reminder</h2>
                </div>
                <div class="content">
                    <p>Your scheduled task is about to run in <strong>{{ minutes }} minutes</strong>.</p>

                    <div class="task-info">
                        <p><strong>Task:</strong> {{ task_name }}</p>
                        <p><strong>Scheduled for:</strong> {{ next_run_at }}</p>
                        <p><strong>Task ID:</strong> #{{ task_id }}</p>
                    </div>

                    <p>Make sure your system is ready for task execution.</p>

                    <a href="{{ dashboard_url }}" class="cta-button">View Task Dashboard</a>
                </div>
                <div class="footer">
                    <p>AI Agent Scheduler - Automated Task Management</p>
                    <p>To change notification preferences, visit your <a href="{{ settings_url }}">settings</a>.</p>
                </div>
            </div>
        </body>
        </html>
        """

        template = Template(html_template)
        html_content = template.render(
            task_id=task_id,
            task_name=task_name,
            next_run_at=next_run_at.strftime("%Y-%m-%d %H:%M:%S"),
            minutes=minutes,
            dashboard_url=os.getenv('FRONTEND_URL', 'http://localhost:3000') + '/tasks',
            settings_url=os.getenv('FRONTEND_URL', 'http://localhost:3000') + '/settings'
        )

        subject = f"⏰ Task Reminder: {task_name} (in {minutes} min)"

        return await self.send_email_async(user_email, subject, html_content)

    async def send_task_failure(
        self,
        task_id: int,
        task_name: str,
        error_message: str,
        user_email: str,
        execution_time: Optional[datetime] = None
    ) -> bool:
        """Send notification when task fails"""

        html_template = """
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #f44336; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
                .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
                .task-info { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #f44336; }
                .error-box {
                    background: #fff3cd;
                    border: 1px solid #ffc107;
                    padding: 15px;
                    margin: 15px 0;
                    border-radius: 5px;
                    font-family: monospace;
                    font-size: 0.9em;
                }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 0.9em; }
                .cta-button {
                    display: inline-block;
                    padding: 12px 24px;
                    background: #f44336;
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 15px 0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>❌ Task Execution Failed</h2>
                </div>
                <div class="content">
                    <p>Your scheduled task encountered an error and failed to complete.</p>

                    <div class="task-info">
                        <p><strong>Task:</strong> {{ task_name }}</p>
                        <p><strong>Task ID:</strong> #{{ task_id }}</p>
                        {% if execution_time %}
                        <p><strong>Failed at:</strong> {{ execution_time }}</p>
                        {% endif %}
                    </div>

                    <p><strong>Error Details:</strong></p>
                    <div class="error-box">{{ error_message }}</div>

                    <p>Please review the task configuration and try again.</p>

                    <a href="{{ dashboard_url }}" class="cta-button">View Task Details</a>
                </div>
                <div class="footer">
                    <p>AI Agent Scheduler - Automated Task Management</p>
                </div>
            </div>
        </body>
        </html>
        """

        template = Template(html_template)
        html_content = template.render(
            task_id=task_id,
            task_name=task_name,
            error_message=error_message,
            execution_time=execution_time.strftime("%Y-%m-%d %H:%M:%S") if execution_time else None,
            dashboard_url=os.getenv('FRONTEND_URL', 'http://localhost:3000') + f'/tasks/{task_id}'
        )

        subject = f"❌ Task Failed: {task_name}"

        return await self.send_email_async(user_email, subject, html_content)

    async def send_weekly_summary(
        self,
        user_email: str,
        completed_tasks: List[Dict],
        upcoming_tasks: List[Dict],
        week_start: datetime,
        week_end: datetime
    ) -> bool:
        """Send weekly summary of completed and upcoming tasks"""

        html_template = """
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 700px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 5px 5px 0 0; }
                .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
                .stats { display: flex; justify-content: space-around; margin: 20px 0; }
                .stat-box {
                    background: white;
                    padding: 20px;
                    text-align: center;
                    border-radius: 5px;
                    flex: 1;
                    margin: 0 10px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                }
                .stat-number { font-size: 2em; font-weight: bold; color: #667eea; }
                .section { margin: 25px 0; }
                .section-title {
                    background: #667eea;
                    color: white;
                    padding: 10px 15px;
                    border-radius: 5px;
                    margin-bottom: 15px;
                }
                .task-list { background: white; padding: 15px; border-radius: 5px; }
                .task-item {
                    padding: 12px;
                    margin: 8px 0;
                    border-left: 4px solid #667eea;
                    background: #f5f7fa;
                }
                .task-item.upcoming { border-left-color: #4CAF50; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 0.9em; }
                .cta-button {
                    display: inline-block;
                    padding: 12px 24px;
                    background: #667eea;
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 15px 0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>📊 Weekly Task Summary</h2>
                    <p>{{ week_start }} - {{ week_end }}</p>
                </div>
                <div class="content">
                    <div class="stats">
                        <div class="stat-box">
                            <div class="stat-number">{{ completed_count }}</div>
                            <div>Tasks Completed</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-number">{{ upcoming_count }}</div>
                            <div>Upcoming Tasks</div>
                        </div>
                    </div>

                    {% if completed_tasks %}
                    <div class="section">
                        <div class="section-title">✅ Completed This Week</div>
                        <div class="task-list">
                            {% for task in completed_tasks %}
                            <div class="task-item">
                                <strong>{{ task.name }}</strong><br>
                                <small>Completed: {{ task.completed_at }}</small>
                            </div>
                            {% endfor %}
                        </div>
                    </div>
                    {% endif %}

                    {% if upcoming_tasks %}
                    <div class="section">
                        <div class="section-title">📅 Coming Up</div>
                        <div class="task-list">
                            {% for task in upcoming_tasks %}
                            <div class="task-item upcoming">
                                <strong>{{ task.name }}</strong><br>
                                <small>Scheduled: {{ task.next_run_at }}</small>
                            </div>
                            {% endfor %}
                        </div>
                    </div>
                    {% endif %}

                    <div style="text-align: center;">
                        <a href="{{ dashboard_url }}" class="cta-button">View Full Dashboard</a>
                    </div>
                </div>
                <div class="footer">
                    <p>AI Agent Scheduler - Automated Task Management</p>
                    <p>Keep up the great work! 🚀</p>
                </div>
            </div>
        </body>
        </html>
        """

        template = Template(html_template)
        html_content = template.render(
            week_start=week_start.strftime("%B %d, %Y"),
            week_end=week_end.strftime("%B %d, %Y"),
            completed_count=len(completed_tasks),
            upcoming_count=len(upcoming_tasks),
            completed_tasks=completed_tasks,
            upcoming_tasks=upcoming_tasks,
            dashboard_url=os.getenv('FRONTEND_URL', 'http://localhost:3000') + '/tasks'
        )

        subject = f"📊 Weekly Summary: {len(completed_tasks)} tasks completed"

        return await self.send_email_async(user_email, subject, html_content)


# Scheduled task reminder checker
async def check_and_send_reminders():
    """Check for tasks that need reminders (15 min before execution)"""
    db = next(get_db())
    email_service = EmailService()

    # Find tasks scheduled to run in 13-17 minutes (buffer for timing)
    reminder_window_start = datetime.now() + timedelta(minutes=13)
    reminder_window_end = datetime.now() + timedelta(minutes=17)

    query = """
        SELECT t.id, t.name, t.next_run_at, u.email, up.email_notifications
        FROM tasks t
        JOIN users u ON t.user_id = u.id
        LEFT JOIN user_preferences up ON u.id = up.user_id
        WHERE t.status = 'active'
        AND t.next_run_at BETWEEN :start AND :end
        AND t.reminder_sent = false
        AND (up.email_notifications IS NULL OR up.email_notifications = true)
    """

    tasks = db.execute(query, {
        'start': reminder_window_start,
        'end': reminder_window_end
    }).fetchall()

    for task in tasks:
        success = await email_service.send_task_reminder(
            task.id,
            task.name,
            task.next_run_at,
            task.email
        )

        if success:
            db.execute(
                "UPDATE tasks SET reminder_sent = true WHERE id = :id",
                {'id': task.id}
            )
            db.commit()


# Task failure notification
async def notify_task_failure(task_id: int, error_message: str):
    """Send email notification when task fails"""
    db = next(get_db())
    email_service = EmailService()

    query = """
        SELECT t.id, t.name, u.email, up.email_notifications
        FROM tasks t
        JOIN users u ON t.user_id = u.id
        LEFT JOIN user_preferences up ON u.id = up.user_id
        WHERE t.id = :task_id
        AND (up.email_notifications IS NULL OR up.email_notifications = true)
    """

    task = db.execute(query, {'task_id': task_id}).fetchone()

    if task:
        await email_service.send_task_failure(
            task.id,
            task.name,
            error_message,
            task.email,
            datetime.now()
        )
