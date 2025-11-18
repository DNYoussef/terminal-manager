"""
Notification API Endpoints
Handles notification preferences, subscriptions, and test notifications
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, Dict
import os

from app.database import get_db
from app.auth import get_current_user
from app.notifications.email_service import EmailService
from app.notifications.push_service import PushNotificationService
from app.websocket.notification_broadcaster import notification_broadcaster, NotificationType


router = APIRouter(prefix="/api/notifications", tags=["notifications"])


# Pydantic models
class PushSubscriptionData(BaseModel):
    endpoint: str
    keys: Dict[str, str]
    expirationTime: Optional[int] = None


class NotificationPreferences(BaseModel):
    email_notifications: bool = True
    browser_notifications: bool = True
    websocket_notifications: bool = True
    reminder_notifications: bool = True
    failure_notifications: bool = True
    weekly_summary: bool = True


class TestNotificationRequest(BaseModel):
    channel: str = "all"  # all, email, push, websocket


# Initialize services
email_service = EmailService()
push_service = PushNotificationService()


@router.get("/vapid-public-key")
async def get_vapid_public_key():
    """Get VAPID public key for push notification subscription"""
    public_key = push_service.get_public_key()

    if not public_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Push notifications not configured"
        )

    return {"publicKey": public_key}


@router.post("/push/subscribe")
async def subscribe_to_push(
    subscription: PushSubscriptionData,
    current_user = Depends(get_current_user)
):
    """Subscribe to browser push notifications"""

    success = await push_service.save_subscription(
        current_user.id,
        subscription.dict()
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save push subscription"
        )

    return {
        "success": True,
        "message": "Successfully subscribed to push notifications"
    }


@router.post("/push/unsubscribe")
async def unsubscribe_from_push(
    data: dict,
    current_user = Depends(get_current_user)
):
    """Unsubscribe from browser push notifications"""

    endpoint = data.get('endpoint')

    if not endpoint:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Endpoint required"
        )

    success = await push_service.remove_subscription(
        current_user.id,
        endpoint
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove push subscription"
        )

    return {
        "success": True,
        "message": "Successfully unsubscribed from push notifications"
    }


@router.post("/push/refresh")
async def refresh_push_subscription(
    data: dict,
    current_user = Depends(get_current_user)
):
    """Refresh push subscription when it changes"""

    old_endpoint = data.get('old_endpoint')
    new_subscription = data.get('new_subscription')

    if old_endpoint:
        await push_service.remove_subscription(current_user.id, old_endpoint)

    if new_subscription:
        await push_service.save_subscription(current_user.id, new_subscription)

    return {"success": True}


@router.get("/preferences")
async def get_notification_preferences(
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get user's notification preferences"""

    prefs = db.execute(
        "SELECT * FROM user_preferences WHERE user_id = :user_id",
        {'user_id': current_user.id}
    ).fetchone()

    if not prefs:
        # Return defaults
        return {
            "preferences": NotificationPreferences().dict()
        }

    return {
        "preferences": {
            "email_notifications": prefs.email_notifications,
            "browser_notifications": prefs.browser_notifications,
            "websocket_notifications": prefs.websocket_notifications,
            "reminder_notifications": prefs.reminder_notifications,
            "failure_notifications": prefs.failure_notifications,
            "weekly_summary": prefs.weekly_summary,
        }
    }


@router.put("/preferences")
async def update_notification_preferences(
    preferences: NotificationPreferences,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Update user's notification preferences"""

    query = """
        INSERT INTO user_preferences (
            user_id, email_notifications, browser_notifications,
            websocket_notifications, reminder_notifications,
            failure_notifications, weekly_summary
        )
        VALUES (
            :user_id, :email_notifications, :browser_notifications,
            :websocket_notifications, :reminder_notifications,
            :failure_notifications, :weekly_summary
        )
        ON CONFLICT (user_id)
        DO UPDATE SET
            email_notifications = :email_notifications,
            browser_notifications = :browser_notifications,
            websocket_notifications = :websocket_notifications,
            reminder_notifications = :reminder_notifications,
            failure_notifications = :failure_notifications,
            weekly_summary = :weekly_summary,
            updated_at = CURRENT_TIMESTAMP
    """

    try:
        db.execute(query, {
            'user_id': current_user.id,
            **preferences.dict()
        })
        db.commit()

        return {
            "success": True,
            "message": "Preferences updated successfully"
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update preferences: {str(e)}"
        )


@router.post("/test")
async def send_test_notification(
    request: TestNotificationRequest,
    current_user = Depends(get_current_user)
):
    """Send test notification to verify setup"""

    results = {}

    # WebSocket test
    if request.channel in ["all", "websocket"]:
        await notification_broadcaster.success(
            current_user.id,
            "Test Notification",
            "This is a test of the in-app notification system",
            duration=5000
        )
        results["websocket"] = "sent"

    # Push notification test
    if request.channel in ["all", "push"]:
        count = await push_service.send_notification(
            current_user.id,
            "Test Notification",
            "This is a test of browser push notifications",
            icon="/icon-192x192.png",
            data={"test": True}
        )
        results["push"] = f"sent to {count} device(s)"

    # Email test
    if request.channel in ["all", "email"]:
        from datetime import datetime, timedelta

        success = await email_service.send_task_reminder(
            task_id=999,
            task_name="Test Task",
            next_run_at=datetime.now() + timedelta(minutes=15),
            user_email=current_user.email
        )
        results["email"] = "sent" if success else "failed"

    return {
        "success": True,
        "message": "Test notifications sent",
        "results": results
    }
