/**
 * NotificationSettings Component
 * User interface for managing notification preferences
 */

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

interface NotificationPreferences {
  email_notifications: boolean;
  browser_notifications: boolean;
  websocket_notifications: boolean;
  reminder_notifications: boolean;
  failure_notifications: boolean;
  weekly_summary: boolean;
}

interface PushSubscription {
  endpoint: string;
  enabled: boolean;
}

const NotificationSettings: React.FC = () => {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email_notifications: true,
    browser_notifications: true,
    websocket_notifications: true,
    reminder_notifications: true,
    failure_notifications: true,
    weekly_summary: true,
  });

  const [pushSubscription, setPushSubscription] = useState<PushSubscription | null>(null);
  const [pushSupported, setPushSupported] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Check if Push API is supported
    setPushSupported('Notification' in window && 'serviceWorker' in navigator);

    // Load current preferences
    loadPreferences();

    // Check current push subscription
    checkPushSubscription();
  }, []);

  const loadPreferences = async () => {
    try {
      const response = await fetch('/api/user/preferences', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences);
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
      toast.error('Failed to load notification settings');
    }
  };

  const checkPushSubscription = async () => {
    if (!pushSupported) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        setPushSubscription({
          endpoint: subscription.endpoint,
          enabled: true,
        });
      }
    } catch (error) {
      console.error('Failed to check push subscription:', error);
    }
  };

  const requestNotificationPermission = async () => {
    if (!pushSupported) {
      toast.error('Browser push notifications are not supported');
      return false;
    }

    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      toast.success('Notification permission granted');
      return true;
    } else if (permission === 'denied') {
      toast.error('Notification permission denied. Please enable in browser settings.');
      return false;
    } else {
      toast('Notification permission dismissed');
      return false;
    }
  };

  const subscribeToPush = async () => {
    setLoading(true);

    try {
      // Request permission first
      const hasPermission = await requestNotificationPermission();
      if (!hasPermission) {
        setLoading(false);
        return;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Get VAPID public key from server
      const keyResponse = await fetch('/api/notifications/vapid-public-key');
      const { publicKey } = await keyResponse.json();

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Send subscription to server
      const response = await fetch('/api/notifications/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(subscription.toJSON()),
      });

      if (response.ok) {
        setPushSubscription({
          endpoint: subscription.endpoint,
          enabled: true,
        });

        // Update preferences
        setPreferences(prev => ({ ...prev, browser_notifications: true }));

        toast.success('Browser notifications enabled!');

        // Send test notification
        setTimeout(() => {
          sendTestNotification();
        }, 1000);
      } else {
        throw new Error('Failed to save subscription');
      }
    } catch (error) {
      console.error('Failed to subscribe to push:', error);
      toast.error('Failed to enable browser notifications');
    } finally {
      setLoading(false);
    }
  };

  const unsubscribeFromPush = async () => {
    setLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Remove from server
        await fetch('/api/notifications/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        setPushSubscription(null);
        setPreferences(prev => ({ ...prev, browser_notifications: false }));

        toast.success('Browser notifications disabled');
      }
    } catch (error) {
      console.error('Failed to unsubscribe from push:', error);
      toast.error('Failed to disable browser notifications');
    } finally {
      setLoading(false);
    }
  };

  const sendTestNotification = async () => {
    try {
      await fetch('/api/notifications/test', {
        method: 'POST',
        credentials: 'include',
      });

      toast.success('Test notification sent!');
    } catch (error) {
      console.error('Failed to send test notification:', error);
    }
  };

  const savePreferences = async () => {
    setSaving(true);

    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ preferences }),
      });

      if (response.ok) {
        toast.success('Notification preferences saved!');
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const togglePreference = (key: keyof NotificationPreferences) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Helper function to convert VAPID key
  const urlBase64ToUint8Array = (base64String: string): BufferSource => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray as BufferSource;
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Notification Settings</h2>

      {/* Email Notifications */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center">
              📧 Email Notifications
            </h3>
            <p className="text-sm text-gray-600">
              Receive notifications via email
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={preferences.email_notifications}
              onChange={() => togglePreference('email_notifications')}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {preferences.email_notifications && (
          <div className="space-y-3 ml-4 border-l-2 border-gray-200 pl-4">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={preferences.reminder_notifications}
                onChange={() => togglePreference('reminder_notifications')}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm">Task reminders (15 min before)</span>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={preferences.failure_notifications}
                onChange={() => togglePreference('failure_notifications')}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm">Task failure alerts</span>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={preferences.weekly_summary}
                onChange={() => togglePreference('weekly_summary')}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm">Weekly summary (every Monday)</span>
            </label>
          </div>
        )}
      </div>

      {/* Browser Push Notifications */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center">
              🔔 Browser Push Notifications
            </h3>
            <p className="text-sm text-gray-600">
              Get instant notifications in your browser
            </p>
          </div>

          {pushSupported ? (
            <button
              onClick={pushSubscription ? unsubscribeFromPush : subscribeToPush}
              disabled={loading}
              className={`px-4 py-2 rounded-md font-medium ${
                pushSubscription
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              } disabled:opacity-50`}
            >
              {loading ? 'Loading...' : pushSubscription ? 'Disable' : 'Enable'}
            </button>
          ) : (
            <span className="text-sm text-red-600">Not supported</span>
          )}
        </div>

        {pushSubscription && (
          <div className="text-sm text-green-600 flex items-center">
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Active on this device
          </div>
        )}
      </div>

      {/* WebSocket In-App Notifications */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center">
              💬 In-App Toast Notifications
            </h3>
            <p className="text-sm text-gray-600">
              Show real-time notifications while using the app
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={preferences.websocket_notifications}
              onChange={() => togglePreference('websocket_notifications')}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end space-x-3">
        <button
          onClick={loadPreferences}
          className="px-6 py-2 border border-gray-300 rounded-md font-medium text-gray-700 hover:bg-gray-50"
        >
          Reset
        </button>

        <button
          onClick={savePreferences}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">💡 How it works</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Email</strong>: Sent for important events (reminders, failures, summaries)</li>
          <li>• <strong>Browser Push</strong>: Critical alerts even when tab is closed</li>
          <li>• <strong>In-App Toasts</strong>: Real-time updates while using the dashboard</li>
        </ul>
      </div>
    </div>
  );
};

export default NotificationSettings;
