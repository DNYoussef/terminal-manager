import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  X,
  Bell,
  BellOff
} from 'lucide-react';

interface BudgetAlert {
  id: string;
  severity: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: string;
  agent_id?: string;
  agent_name?: string;
  dismissible: boolean;
}

interface AlertConfig {
  icon: React.ReactNode;
  bgColor: string;
  borderColor: string;
  textColor: string;
  iconColor: string;
}

const alertConfigs: Record<string, AlertConfig> = {
  error: {
    icon: <AlertCircle className="w-5 h-5" />,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-800',
    iconColor: 'text-red-600'
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5" />,
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-800',
    iconColor: 'text-yellow-600'
  },
  info: {
    icon: <Info className="w-5 h-5" />,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-800',
    iconColor: 'text-blue-600'
  },
  success: {
    icon: <CheckCircle className="w-5 h-5" />,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-800',
    iconColor: 'text-green-600'
  }
};

interface AlertItemProps {
  alert: BudgetAlert;
  onDismiss: (id: string) => void;
}

const AlertItem: React.FC<AlertItemProps> = ({ alert, onDismiss }) => {
  const config = alertConfigs[alert.severity];
  const timeAgo = getTimeAgo(alert.timestamp);

  return (
    <div
      className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4 mb-3 animate-slideIn`}
    >
      <div className="flex items-start gap-3">
        <div className={`${config.iconColor} flex-shrink-0`}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className={`font-semibold ${config.textColor}`}>
              {alert.title}
            </h4>
            {alert.dismissible && (
              <button
                onClick={() => onDismiss(alert.id)}
                className={`${config.textColor} hover:opacity-70 transition-opacity`}
                aria-label="Dismiss alert"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className={`text-sm ${config.textColor} mb-2`}>
            {alert.message}
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <span>{timeAgo}</span>
            {alert.agent_name && (
              <span className="flex items-center gap-1">
                Agent: <span className="font-semibold">{alert.agent_name}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function getTimeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

interface BudgetAlertsProps {
  className?: string;
}

export const BudgetAlerts: React.FC<BudgetAlertsProps> = ({ className = '' }) => {
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000); // Refresh every 30s

    // WebSocket for real-time alerts
    const ws = new WebSocket('ws://localhost:8000/api/v1/agents/activity/stream');

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'budget_alert') {
          handleNewAlert(data.alert);
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, []);

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/v1/agents/alerts');
      if (!response.ok) {
        throw new Error('Failed to fetch alerts');
      }
      const data = await response.json();
      setAlerts(data.alerts || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleNewAlert = (alert: BudgetAlert) => {
    setAlerts(prev => [alert, ...prev]);

    if (notificationsEnabled && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(alert.title, {
          body: alert.message,
          icon: '/favicon.ico',
          tag: alert.id
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification(alert.title, {
              body: alert.message,
              icon: '/favicon.ico',
              tag: alert.id
            });
          }
        });
      }
    }
  };

  const dismissAlert = (id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  };

  const dismissAll = () => {
    setAlerts(prev => prev.filter(alert => !alert.dismissible));
  };

  const toggleNotifications = () => {
    setNotificationsEnabled(prev => !prev);
  };

  const filteredAlerts = filterSeverity === 'all'
    ? alerts
    : alerts.filter(alert => alert.severity === filterSeverity);

  const alertCounts = {
    error: alerts.filter(a => a.severity === 'error').length,
    warning: alerts.filter(a => a.severity === 'warning').length,
    info: alerts.filter(a => a.severity === 'info').length,
    success: alerts.filter(a => a.severity === 'success').length
  };

  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center p-12`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className} bg-red-50 border border-red-200 rounded-lg p-6`}>
        <div className="flex items-center text-red-800">
          <AlertCircle className="w-5 h-5 mr-2" />
          <p>Error loading alerts: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Budget Alerts</h2>
            <p className="text-gray-600">Real-time notifications and warnings</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleNotifications}
              className={`p-2 rounded-lg transition-colors ${
                notificationsEnabled
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              title={notificationsEnabled ? 'Disable notifications' : 'Enable notifications'}
            >
              {notificationsEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
            </button>
            {alerts.some(a => a.dismissible) && (
              <button
                onClick={dismissAll}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                Dismiss All
              </button>
            )}
          </div>
        </div>

        {/* Alert counts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              filterSeverity === 'error' ? 'bg-red-100 border-red-300' : 'bg-white border-gray-200'
            }`}
            onClick={() => setFilterSeverity(filterSeverity === 'error' ? 'all' : 'error')}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Errors</span>
              <span className="text-lg font-bold text-red-700">{alertCounts.error}</span>
            </div>
          </div>

          <div
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              filterSeverity === 'warning' ? 'bg-yellow-100 border-yellow-300' : 'bg-white border-gray-200'
            }`}
            onClick={() => setFilterSeverity(filterSeverity === 'warning' ? 'all' : 'warning')}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Warnings</span>
              <span className="text-lg font-bold text-yellow-700">{alertCounts.warning}</span>
            </div>
          </div>

          <div
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              filterSeverity === 'info' ? 'bg-blue-100 border-blue-300' : 'bg-white border-gray-200'
            }`}
            onClick={() => setFilterSeverity(filterSeverity === 'info' ? 'all' : 'info')}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Info</span>
              <span className="text-lg font-bold text-blue-700">{alertCounts.info}</span>
            </div>
          </div>

          <div
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              filterSeverity === 'success' ? 'bg-green-100 border-green-300' : 'bg-white border-gray-200'
            }`}
            onClick={() => setFilterSeverity(filterSeverity === 'success' ? 'all' : 'success')}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Success</span>
              <span className="text-lg font-bold text-green-700">{alertCounts.success}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="max-h-96 overflow-y-auto">
          {filteredAlerts.length > 0 ? (
            filteredAlerts.map(alert => (
              <AlertItem key={alert.id} alert={alert} onDismiss={dismissAlert} />
            ))
          ) : (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-600">
                {filterSeverity === 'all'
                  ? 'No alerts - all systems running smoothly'
                  : `No ${filterSeverity} alerts`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BudgetAlerts;
