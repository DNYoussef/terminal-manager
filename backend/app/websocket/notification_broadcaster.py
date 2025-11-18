"""
WebSocket Notification Broadcaster
Sends real-time in-app toast notifications via WebSocket
"""

import json
from typing import Dict, Optional, List
from datetime import datetime
from enum import Enum

from app.websocket.connection_manager import connection_manager


class NotificationType(str, Enum):
    """Notification types for toast styling"""
    SUCCESS = "success"
    ERROR = "error"
    INFO = "info"
    WARNING = "warning"


class NotificationBroadcaster:
    """Broadcasts notifications to connected WebSocket clients"""

    def __init__(self):
        self.manager = connection_manager

    async def send_notification(
        self,
        user_id: int,
        notification_type: NotificationType,
        title: str,
        message: str,
        duration: int = 5000,
        action: Optional[Dict] = None,
        data: Optional[Dict] = None
    ):
        """
        Send toast notification to user via WebSocket

        Args:
            user_id: Target user ID
            notification_type: success, error, info, warning
            title: Notification title
            message: Notification message
            duration: Auto-dismiss duration in ms (default 5000ms = 5s)
            action: Optional action button {"label": "View", "url": "/tasks/123"}
            data: Optional additional data
        """

        notification_data = {
            "type": "notification",
            "notification": {
                "id": f"notif-{datetime.now().timestamp()}",
                "type": notification_type.value,
                "title": title,
                "message": message,
                "duration": duration,
                "timestamp": datetime.now().isoformat(),
                "action": action,
                "data": data or {}
            }
        }

        # Send to all connections for this user
        await self.manager.send_to_user(user_id, notification_data)

        print(f"📢 Notification sent to user {user_id}: [{notification_type.value}] {title}")

    async def send_to_multiple_users(
        self,
        user_ids: List[int],
        notification_type: NotificationType,
        title: str,
        message: str,
        **kwargs
    ):
        """Send same notification to multiple users"""
        for user_id in user_ids:
            await self.send_notification(
                user_id,
                notification_type,
                title,
                message,
                **kwargs
            )

    async def broadcast_to_all(
        self,
        notification_type: NotificationType,
        title: str,
        message: str,
        **kwargs
    ):
        """Broadcast notification to all connected users"""
        await self.manager.broadcast({
            "type": "notification",
            "notification": {
                "id": f"notif-{datetime.now().timestamp()}",
                "type": notification_type.value,
                "title": title,
                "message": message,
                "duration": kwargs.get('duration', 5000),
                "timestamp": datetime.now().isoformat(),
                "action": kwargs.get('action'),
                "data": kwargs.get('data', {})
            }
        })

        print(f"📢 Broadcast notification: [{notification_type.value}] {title}")

    # Convenience methods for common notification types

    async def success(
        self,
        user_id: int,
        title: str,
        message: str,
        **kwargs
    ):
        """Send success notification (green toast)"""
        await self.send_notification(
            user_id,
            NotificationType.SUCCESS,
            title,
            message,
            **kwargs
        )

    async def error(
        self,
        user_id: int,
        title: str,
        message: str,
        **kwargs
    ):
        """Send error notification (red toast)"""
        await self.send_notification(
            user_id,
            NotificationType.ERROR,
            title,
            message,
            duration=kwargs.get('duration', 8000),  # Errors stay longer
            **kwargs
        )

    async def info(
        self,
        user_id: int,
        title: str,
        message: str,
        **kwargs
    ):
        """Send info notification (blue toast)"""
        await self.send_notification(
            user_id,
            NotificationType.INFO,
            title,
            message,
            **kwargs
        )

    async def warning(
        self,
        user_id: int,
        title: str,
        message: str,
        **kwargs
    ):
        """Send warning notification (yellow toast)"""
        await self.send_notification(
            user_id,
            NotificationType.WARNING,
            title,
            message,
            duration=kwargs.get('duration', 7000),  # Warnings stay longer
            **kwargs
        )

    # Event-specific notification methods

    async def notify_task_started(
        self,
        user_id: int,
        task_name: str,
        task_id: int
    ):
        """Notify when task starts execution"""
        await self.info(
            user_id,
            "Task Started",
            f"'{task_name}' is now running",
            action={"label": "View", "url": f"/tasks/{task_id}"},
            data={"task_id": task_id, "event": "task_started"}
        )

    async def notify_task_completed(
        self,
        user_id: int,
        task_name: str,
        task_id: int,
        duration: Optional[float] = None
    ):
        """Notify when task completes successfully"""
        message = f"'{task_name}' completed successfully"
        if duration:
            message += f" in {duration:.1f}s"

        await self.success(
            user_id,
            "Task Completed",
            message,
            action={"label": "View Results", "url": f"/tasks/{task_id}"},
            data={"task_id": task_id, "event": "task_completed", "duration": duration}
        )

    async def notify_task_failed(
        self,
        user_id: int,
        task_name: str,
        task_id: int,
        error: str
    ):
        """Notify when task fails"""
        await self.error(
            user_id,
            "Task Failed",
            f"'{task_name}' encountered an error: {error[:100]}",
            action={"label": "View Error", "url": f"/tasks/{task_id}"},
            data={"task_id": task_id, "event": "task_failed", "error": error}
        )

    async def notify_agent_status_change(
        self,
        user_id: int,
        agent_name: str,
        agent_id: int,
        status: str
    ):
        """Notify when agent status changes"""

        notification_map = {
            "running": (NotificationType.SUCCESS, "Agent Started"),
            "stopped": (NotificationType.WARNING, "Agent Stopped"),
            "crashed": (NotificationType.ERROR, "Agent Crashed"),
            "paused": (NotificationType.INFO, "Agent Paused")
        }

        notif_type, title = notification_map.get(
            status,
            (NotificationType.INFO, "Agent Status Changed")
        )

        await self.send_notification(
            user_id,
            notif_type,
            title,
            f"Agent '{agent_name}' is now {status}",
            action={"label": "View Agent", "url": f"/agents/{agent_id}"},
            data={"agent_id": agent_id, "event": "agent_status_change", "status": status}
        )

    async def notify_system_alert(
        self,
        user_id: int,
        alert_level: str,
        message: str,
        details: Optional[Dict] = None
    ):
        """System-level alerts (low disk, high CPU, etc.)"""

        level_map = {
            "critical": NotificationType.ERROR,
            "warning": NotificationType.WARNING,
            "info": NotificationType.INFO
        }

        await self.send_notification(
            user_id,
            level_map.get(alert_level, NotificationType.INFO),
            f"System Alert: {alert_level.upper()}",
            message,
            duration=10000,  # System alerts stay 10s
            data={"event": "system_alert", "level": alert_level, "details": details}
        )


# Global broadcaster instance
notification_broadcaster = NotificationBroadcaster()


# Example usage in task execution:
"""
from app.websocket.notification_broadcaster import notification_broadcaster

# When task starts
await notification_broadcaster.notify_task_started(user_id, "Daily Report", 123)

# When task completes
await notification_broadcaster.notify_task_completed(user_id, "Daily Report", 123, duration=45.3)

# When task fails
await notification_broadcaster.notify_task_failed(user_id, "Daily Report", 123, "Connection timeout")

# Custom notification
await notification_broadcaster.success(
    user_id=current_user.id,
    title="Settings Saved",
    message="Your preferences have been updated",
    duration=3000
)
"""
