"""
Notification Scheduler
Background tasks for sending scheduled notifications
"""

import asyncio
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.database import get_db
from app.notifications.email_service import EmailService, check_and_send_reminders


# Initialize scheduler
scheduler = AsyncIOScheduler()
email_service = EmailService()


async def send_weekly_summaries():
    """
    Send weekly summary emails to all users (runs every Monday at 9 AM)
    """
    print("📊 Sending weekly summaries...")

    db = next(get_db())

    # Get all users with weekly summary enabled
    users = db.execute("""
        SELECT u.id, u.email, u.username, up.weekly_summary
        FROM users u
        LEFT JOIN user_preferences up ON u.id = up.user_id
        WHERE up.weekly_summary IS NULL OR up.weekly_summary = TRUE
    """).fetchall()

    # Calculate week boundaries (Monday to Sunday)
    today = datetime.now()
    week_start = today - timedelta(days=today.weekday())  # Last Monday
    week_end = week_start + timedelta(days=6)  # Sunday

    for user in users:
        # Get completed tasks for this week
        completed_tasks_raw = db.execute("""
            SELECT name, updated_at as completed_at
            FROM tasks
            WHERE user_id = :user_id
            AND status = 'completed'
            AND updated_at >= :week_start
            AND updated_at <= :week_end
            ORDER BY updated_at DESC
        """, {
            'user_id': user.id,
            'week_start': week_start,
            'week_end': week_end
        }).fetchall()

        completed_tasks = [
            {
                'name': task.name,
                'completed_at': task.completed_at.strftime("%Y-%m-%d %H:%M")
            }
            for task in completed_tasks_raw
        ]

        # Get upcoming tasks for next week
        next_week_start = week_end + timedelta(days=1)
        next_week_end = next_week_start + timedelta(days=7)

        upcoming_tasks_raw = db.execute("""
            SELECT name, next_run_at
            FROM tasks
            WHERE user_id = :user_id
            AND status = 'active'
            AND next_run_at >= :next_week_start
            AND next_run_at <= :next_week_end
            ORDER BY next_run_at ASC
        """, {
            'user_id': user.id,
            'next_week_start': next_week_start,
            'next_week_end': next_week_end
        }).fetchall()

        upcoming_tasks = [
            {
                'name': task.name,
                'next_run_at': task.next_run_at.strftime("%Y-%m-%d %H:%M")
            }
            for task in upcoming_tasks_raw
        ]

        # Send summary email
        if completed_tasks or upcoming_tasks:
            await email_service.send_weekly_summary(
                user_email=user.email,
                completed_tasks=completed_tasks,
                upcoming_tasks=upcoming_tasks,
                week_start=week_start,
                week_end=week_end
            )

    print(f"✅ Weekly summaries sent to {len(users)} users")


async def check_task_reminders():
    """
    Check for tasks that need reminders (runs every minute)
    Sends email 15 minutes before task execution
    """
    await check_and_send_reminders()


async def cleanup_old_notifications():
    """
    Clean up old notification data (runs daily at 3 AM)
    """
    print("🧹 Cleaning up old notification data...")

    db = next(get_db())

    # Reset reminder_sent flag for tasks scheduled in the future
    db.execute("""
        UPDATE tasks
        SET reminder_sent = FALSE
        WHERE next_run_at > CURRENT_TIMESTAMP + INTERVAL '1 hour'
    """)

    db.commit()

    print("✅ Cleanup complete")


def start_notification_scheduler():
    """
    Start the notification background scheduler
    """
    print("🚀 Starting notification scheduler...")

    # Task reminders - every minute
    scheduler.add_job(
        check_task_reminders,
        trigger=IntervalTrigger(minutes=1),
        id='task_reminders',
        name='Check and send task reminders',
        replace_existing=True
    )

    # Weekly summaries - every Monday at 9 AM
    scheduler.add_job(
        send_weekly_summaries,
        trigger=CronTrigger(day_of_week='mon', hour=9, minute=0),
        id='weekly_summaries',
        name='Send weekly summaries',
        replace_existing=True
    )

    # Cleanup - daily at 3 AM
    scheduler.add_job(
        cleanup_old_notifications,
        trigger=CronTrigger(hour=3, minute=0),
        id='cleanup_notifications',
        name='Cleanup old notifications',
        replace_existing=True
    )

    scheduler.start()

    print("✅ Notification scheduler started")
    print("  - Task reminders: every minute")
    print("  - Weekly summaries: Mondays at 9 AM")
    print("  - Cleanup: daily at 3 AM")


def stop_notification_scheduler():
    """Stop the notification scheduler"""
    scheduler.shutdown()
    print("⏹️ Notification scheduler stopped")


# For manual testing
if __name__ == "__main__":
    async def test_notifications():
        # Test reminder check
        print("Testing task reminders...")
        await check_task_reminders()

        # Test weekly summary
        print("Testing weekly summaries...")
        await send_weekly_summaries()

    asyncio.run(test_notifications())
