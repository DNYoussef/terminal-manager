/**
 * React Hook for Managing Notifications
 * Handles WebSocket connection, push subscriptions, and preferences
 */

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';

interface NotificationData {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  duration: number;
  timestamp: string;
  action?: {
    label: string;
    url: string;
  };
  data?: Record<string, any>;
}

interface NotificationMessage {
  type: 'notification';
  notification: NotificationData;
}

interface UseNotificationsOptions {
  autoConnect?: boolean;
  enableToasts?: boolean;
  websocketUrl?: string;
}

export const useNotifications = (options: UseNotificationsOptions = {}) => {
  const {
    autoConnect = false, // Disabled by default - enable when notifications backend is ready
    enableToasts = true,
    websocketUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws'
  } = options;

  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    const websocket = new WebSocket(websocketUrl);

    websocket.onopen = () => {
      console.log('[OK] WebSocket connected');
      setConnected(true);
    };

    websocket.onclose = () => {
      console.log('[ERROR] WebSocket disconnected');
      setConnected(false);

      // Reconnect after 3 seconds
      setTimeout(() => {
        if (autoConnect) {
          connect();
        }
      }, 3000);
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    websocket.onmessage = (event) => {
      try {
        const message: NotificationMessage = JSON.parse(event.data);

        if (message.type === 'notification') {
          handleNotification(message.notification);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, [websocketUrl, autoConnect]);

  // Handle incoming notification
  const handleNotification = useCallback((notification: NotificationData) => {
    // Add to notifications list
    setNotifications(prev => [notification, ...prev].slice(0, 50)); // Keep last 50

    // Show toast if enabled
    if (enableToasts) {
      const toastOptions = {
        duration: notification.duration,
        id: notification.id,
      };

      const message = (
        <div>
          <div className="font-semibold">{notification.title}</div>
          <div className="text-sm">{notification.message}</div>
          {notification.action && (
            <button
              onClick={() => {
                window.location.href = notification.action!.url;
                toast.dismiss(notification.id);
              }}
              className="mt-2 text-sm underline"
            >
              {notification.action.label}
            </button>
          )}
        </div>
      );

      switch (notification.type) {
        case 'success':
          toast.success(message, toastOptions);
          break;
        case 'error':
          toast.error(message, toastOptions);
          break;
        case 'warning':
          toast(message, { ...toastOptions, icon: '!' });
          break;
        case 'info':
        default:
          toast(message, { ...toastOptions, icon: 'i' });
          break;
      }
    }
  }, [enableToasts]);

  // Subscribe to push notifications
  const subscribeToPush = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast.error('Push notifications not supported');
      return false;
    }

    try {
      // Request permission
      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        toast.error('Notification permission denied');
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Get VAPID public key
      const response = await fetch('/api/notifications/vapid-public-key');
      const { publicKey } = await response.json();

      // Subscribe
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Send to server
      await fetch('/api/notifications/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(subscription.toJSON()),
      });

      setPushEnabled(true);
      toast.success('Push notifications enabled!');
      return true;

    } catch (error) {
      console.error('Push subscription failed:', error);
      toast.error('Failed to enable push notifications');
      return false;
    }
  }, []);

  // Unsubscribe from push notifications
  const unsubscribeFromPush = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        await fetch('/api/notifications/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        setPushEnabled(false);
        toast.success('Push notifications disabled');
      }
    } catch (error) {
      console.error('Unsubscribe failed:', error);
      toast.error('Failed to disable push notifications');
    }
  }, []);

  // Check push subscription status
  const checkPushStatus = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setPushEnabled(!!subscription);
    } catch (error) {
      console.error('Failed to check push status:', error);
    }
  }, []);

  // Send test notification
  const sendTestNotification = useCallback(async (channel: string = 'all') => {
    try {
      await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ channel }),
      });

      toast.success('Test notification sent!');
    } catch (error) {
      console.error('Test notification failed:', error);
      toast.error('Failed to send test notification');
    }
  }, []);

  // Clear notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Initialize
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    checkPushStatus();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  return {
    // State
    connected,
    pushEnabled,
    notifications,

    // WebSocket methods
    connect,
    disconnect: () => ws?.close(),

    // Push notification methods
    subscribeToPush,
    unsubscribeFromPush,
    checkPushStatus,

    // Utility methods
    sendTestNotification,
    clearNotifications,
  };
};

// Helper function
function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray as BufferSource;
}
