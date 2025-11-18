import React, { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

/**
 * TaskReminders Component
 *
 * Handles task reminder notifications via:
 * 1. WebSocket real-time notifications (from P4_T3)
 * 2. Browser notifications (Notification API)
 *
 * Backend cron job checks tasks with next_run_at in next 15 min
 * and sends reminder via WebSocket or email (nodemailer)
 *
 * WCAG 2.1 AA Compliant:
 * - Screen reader announcements
 * - Keyboard dismissal
 * - Visual and audio notifications
 */

interface TaskReminder {
  id: string;
  taskId: string;
  taskName: string;
  taskDescription: string;
  scheduledTime: Date;
  projectName: string;
  skillName: string;
}

interface TaskRemindersProps {
  userId: string;
  wsUrl?: string;
  onReminderClick?: (taskId: string) => void;
}

const NOTIFICATION_ICON = '/notification-icon.png';
const NOTIFICATION_SOUND = '/notification-sound.mp3';

export const TaskReminders: React.FC<TaskRemindersProps> = ({
  userId,
  wsUrl = 'ws://localhost:8000',
  onReminderClick,
}) => {
  const [reminders, setReminders] = useState<TaskReminder[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  }, []);

  // Show browser notification
  const showBrowserNotification = useCallback((reminder: TaskReminder) => {
    if (notificationPermission !== 'granted') {
      return;
    }

    const notification = new Notification(`Reminder: ${reminder.taskName}`, {
      body: `${reminder.taskDescription}\n\nScheduled: ${new Date(reminder.scheduledTime).toLocaleString()}\nProject: ${reminder.projectName}`,
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_ICON,
      tag: reminder.id,
      requireInteraction: true,
    });

    notification.onclick = () => {
      window.focus();
      if (onReminderClick) {
        onReminderClick(reminder.taskId);
      }
      notification.close();
    };

    // Play notification sound
    if (audioRef.current) {
      audioRef.current.play().catch(console.error);
    }
  }, [notificationPermission, onReminderClick]);

  // Handle reminder received via WebSocket
  const handleReminderReceived = useCallback((reminder: TaskReminder) => {
    setReminders((prev) => [reminder, ...prev]);
    showBrowserNotification(reminder);

    // Announce to screen readers
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'alert');
    announcement.setAttribute('aria-live', 'assertive');
    announcement.className = 'sr-only';
    announcement.textContent = `Reminder: ${reminder.taskName} scheduled for ${new Date(reminder.scheduledTime).toLocaleString()}`;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  }, [showBrowserNotification]);

  // Initialize WebSocket connection
  useEffect(() => {
    const socket = io(wsUrl, {
      query: { userId },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('Connected to reminder service');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from reminder service');
      setIsConnected(false);
    });

    socket.on('task_reminder', (data: TaskReminder) => {
      handleReminderReceived(data);
    });

    socket.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [userId, wsUrl, handleReminderReceived]);

  // Request permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, [requestNotificationPermission]);

  // Dismiss reminder
  const dismissReminder = useCallback((reminderId: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== reminderId));
  }, []);

  // Dismiss all reminders
  const dismissAll = useCallback(() => {
    setReminders([]);
  }, []);

  return (
    <div className="task-reminders" role="region" aria-labelledby="reminders-heading">
      {/* Hidden audio element for notification sound */}
      <audio ref={audioRef} src={NOTIFICATION_SOUND} preload="auto" />

      {/* Connection Status */}
      <div className="flex items-center justify-between mb-4">
        <h3 id="reminders-heading" className="text-lg font-semibold">
          Task Reminders
        </h3>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
            aria-label={isConnected ? 'Connected' : 'Disconnected'}
          />
          <span className="text-sm text-gray-600">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Notification Permission Status */}
      {notificationPermission !== 'granted' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
          <p className="text-sm text-yellow-800 mb-2">
            Enable browser notifications to receive task reminders
          </p>
          <button
            onClick={requestNotificationPermission}
            className="text-sm bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 focus:ring-2 focus:ring-yellow-500"
          >
            Enable Notifications
          </button>
        </div>
      )}

      {/* Reminders List */}
      {reminders.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {reminders.length} {reminders.length === 1 ? 'reminder' : 'reminders'}
            </p>
            <button
              onClick={dismissAll}
              className="text-sm text-blue-600 hover:underline focus:ring-2 focus:ring-blue-500 rounded px-2"
            >
              Dismiss All
            </button>
          </div>

          <ul className="space-y-2" aria-label="Active task reminders">
            {reminders.map((reminder) => (
              <li
                key={reminder.id}
                className="bg-blue-50 border border-blue-200 rounded-md p-3 hover:bg-blue-100 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">
                      {reminder.taskName}
                    </h4>
                    {reminder.taskDescription && (
                      <p className="text-sm text-gray-600 mt-1">
                        {reminder.taskDescription}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                      <span>
                        📅 {new Date(reminder.scheduledTime).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                      <span>📁 {reminder.projectName}</span>
                      <span>🎯 {reminder.skillName}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {onReminderClick && (
                      <button
                        onClick={() => onReminderClick(reminder.taskId)}
                        className="text-sm text-blue-600 hover:underline focus:ring-2 focus:ring-blue-500 rounded px-2"
                        aria-label={`View ${reminder.taskName}`}
                      >
                        View
                      </button>
                    )}
                    <button
                      onClick={() => dismissReminder(reminder.id)}
                      className="text-sm text-gray-600 hover:text-gray-900 focus:ring-2 focus:ring-gray-500 rounded px-2"
                      aria-label={`Dismiss reminder for ${reminder.taskName}`}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {reminders.length === 0 && isConnected && (
        <p className="text-sm text-gray-500 text-center py-8">
          No active reminders
        </p>
      )}
    </div>
  );
};

export default TaskReminders;
