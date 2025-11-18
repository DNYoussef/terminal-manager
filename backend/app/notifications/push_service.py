"""
Browser Push Notification Service
Implements Web Push API for browser notifications
"""

import os
import json
from typing import Optional, Dict
from pywebpush import webpush, WebPushException
from datetime import datetime

from app.database import get_db


class PushNotificationService:
    """Browser push notifications using Web Push API"""

    def __init__(self):
        # VAPID keys for Web Push (generate with: webpush.vapid_gen())
        self.vapid_private_key = os.getenv('VAPID_PRIVATE_KEY')
        self.vapid_public_key = os.getenv('VAPID_PUBLIC_KEY')
        self.vapid_claims = {
            "sub": f"mailto:{os.getenv('ADMIN_EMAIL', 'admin@example.com')}"
        }

        if not self.vapid_private_key or not self.vapid_public_key:
            print("⚠️ WARNING: VAPID keys not configured. Browser push notifications disabled.")

    def get_public_key(self) -> Optional[str]:
        """Get VAPID public key for client subscription"""
        return self.vapid_public_key

    async def save_subscription(
        self,
        user_id: int,
        subscription: Dict
    ) -> bool:
        """Save push subscription to database"""
        db = next(get_db())

        try:
            # Store subscription as JSON
            query = """
                INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, subscription_data)
                VALUES (:user_id, :endpoint, :p256dh, :auth, :subscription_data)
                ON CONFLICT (user_id, endpoint)
                DO UPDATE SET
                    p256dh = :p256dh,
                    auth = :auth,
                    subscription_data = :subscription_data,
                    updated_at = CURRENT_TIMESTAMP
            """

            keys = subscription.get('keys', {})

            db.execute(query, {
                'user_id': user_id,
                'endpoint': subscription.get('endpoint'),
                'p256dh': keys.get('p256dh'),
                'auth': keys.get('auth'),
                'subscription_data': json.dumps(subscription)
            })
            db.commit()

            print(f"✅ Push subscription saved for user {user_id}")
            return True

        except Exception as e:
            print(f"❌ Failed to save push subscription: {str(e)}")
            db.rollback()
            return False

    async def remove_subscription(
        self,
        user_id: int,
        endpoint: str
    ) -> bool:
        """Remove push subscription from database"""
        db = next(get_db())

        try:
            query = "DELETE FROM push_subscriptions WHERE user_id = :user_id AND endpoint = :endpoint"
            db.execute(query, {'user_id': user_id, 'endpoint': endpoint})
            db.commit()

            print(f"✅ Push subscription removed for user {user_id}")
            return True

        except Exception as e:
            print(f"❌ Failed to remove push subscription: {str(e)}")
            db.rollback()
            return False

    async def send_notification(
        self,
        user_id: int,
        title: str,
        body: str,
        icon: Optional[str] = None,
        data: Optional[Dict] = None,
        actions: Optional[list] = None
    ) -> int:
        """Send push notification to all user's subscribed devices"""

        if not self.vapid_private_key or not self.vapid_public_key:
            print("⚠️ Push notifications not configured")
            return 0

        db = next(get_db())

        # Check if user has browser notifications enabled
        prefs = db.execute(
            "SELECT browser_notifications FROM user_preferences WHERE user_id = :user_id",
            {'user_id': user_id}
        ).fetchone()

        if prefs and not prefs.browser_notifications:
            print(f"ℹ️ Browser notifications disabled for user {user_id}")
            return 0

        # Get all subscriptions for this user
        subscriptions = db.execute(
            "SELECT subscription_data FROM push_subscriptions WHERE user_id = :user_id",
            {'user_id': user_id}
        ).fetchall()

        if not subscriptions:
            print(f"ℹ️ No push subscriptions found for user {user_id}")
            return 0

        # Prepare notification payload
        notification_data = {
            "title": title,
            "body": body,
            "icon": icon or "/icon-192x192.png",
            "badge": "/badge-72x72.png",
            "timestamp": datetime.now().isoformat(),
            "requireInteraction": data.get('requireInteraction', False) if data else False,
            "data": data or {},
            "actions": actions or []
        }

        # Send to all subscriptions
        sent_count = 0
        for sub in subscriptions:
            try:
                subscription_info = json.loads(sub.subscription_data)

                webpush(
                    subscription_info=subscription_info,
                    data=json.dumps(notification_data),
                    vapid_private_key=self.vapid_private_key,
                    vapid_claims=self.vapid_claims
                )

                sent_count += 1

            except WebPushException as e:
                # Handle expired/invalid subscriptions
                if e.response.status_code == 410:  # Gone
                    print(f"⚠️ Subscription expired, removing: {subscription_info.get('endpoint')}")
                    await self.remove_subscription(user_id, subscription_info.get('endpoint'))
                else:
                    print(f"❌ Push send failed: {str(e)}")
            except Exception as e:
                print(f"❌ Unexpected error sending push: {str(e)}")

        print(f"✅ Push notification sent to {sent_count} device(s) for user {user_id}")
        return sent_count

    async def notify_task_failure(
        self,
        user_id: int,
        task_name: str,
        task_id: int
    ):
        """Send critical push notification for task failure"""
        await self.send_notification(
            user_id=user_id,
            title="❌ Task Failed",
            body=f"Task '{task_name}' encountered an error",
            icon="/icons/error.png",
            data={
                "requireInteraction": True,
                "type": "task_failure",
                "task_id": task_id,
                "url": f"/tasks/{task_id}"
            },
            actions=[
                {"action": "view", "title": "View Details"},
                {"action": "dismiss", "title": "Dismiss"}
            ]
        )

    async def notify_agent_crash(
        self,
        user_id: int,
        agent_name: str,
        agent_id: int
    ):
        """Send critical push notification for agent crash"""
        await self.send_notification(
            user_id=user_id,
            title="🚨 Agent Crashed",
            body=f"Agent '{agent_name}' has stopped unexpectedly",
            icon="/icons/crash.png",
            data={
                "requireInteraction": True,
                "type": "agent_crash",
                "agent_id": agent_id,
                "url": f"/agents/{agent_id}"
            },
            actions=[
                {"action": "restart", "title": "Restart Agent"},
                {"action": "view", "title": "View Details"}
            ]
        )


# Database migration for push subscriptions table
"""
CREATE TABLE push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    subscription_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, endpoint)
);

CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
"""
