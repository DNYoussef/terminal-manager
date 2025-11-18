/**
 * Degraded Mode UI Banner Component
 * Displays warning banner when Memory MCP is unavailable
 *
 * Author: backend-dev agent
 * Created: 2025-11-08
 * Project: ruv-sparc-ui-dashboard
 * Task: P1_T5 - CF003 Mitigation
 */

import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTime: string | null;
  lastSuccessTime: string | null;
  fallbackRequests: number;
}

interface DegradedModeBannerProps {
  /** API endpoint to check circuit breaker state */
  apiEndpoint?: string;
  /** Polling interval in milliseconds (default: 10000 = 10s) */
  pollingInterval?: number;
  /** Allow user to dismiss the banner */
  dismissible?: boolean;
  /** Callback when banner is dismissed */
  onDismiss?: () => void;
}

const DegradedModeBanner: React.FC<DegradedModeBannerProps> = ({
  apiEndpoint = '/api/memory-mcp/circuit-state',
  pollingInterval = 10000,
  dismissible = true,
  onDismiss
}) => {
  const [circuitState, setCircuitState] = useState<CircuitBreakerState | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Poll circuit breaker state
  useEffect(() => {
    const fetchCircuitState = async () => {
      try {
        const response = await fetch(apiEndpoint);
        if (response.ok) {
          const data = await response.json();
          setCircuitState(data);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Failed to fetch circuit state:', error);
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchCircuitState();

    // Poll every interval
    const intervalId = setInterval(fetchCircuitState, pollingInterval);

    return () => clearInterval(intervalId);
  }, [apiEndpoint, pollingInterval]);

  const handleDismiss = () => {
    setIsDismissed(true);
    if (onDismiss) {
      onDismiss();
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  // Don't show banner if dismissed or circuit is closed
  if (isDismissed || !circuitState || circuitState.state === 'CLOSED') {
    return null;
  }

  // Don't show while loading
  if (isLoading) {
    return null;
  }

  // Determine banner style based on circuit state
  const getBannerStyle = () => {
    switch (circuitState.state) {
      case 'OPEN':
        return {
          bg: 'bg-red-50 dark:bg-red-900/20',
          border: 'border-red-200 dark:border-red-800',
          text: 'text-red-800 dark:text-red-200',
          icon: 'text-red-600 dark:text-red-400'
        };
      case 'HALF_OPEN':
        return {
          bg: 'bg-yellow-50 dark:bg-yellow-900/20',
          border: 'border-yellow-200 dark:border-yellow-800',
          text: 'text-yellow-800 dark:text-yellow-200',
          icon: 'text-yellow-600 dark:text-yellow-400'
        };
      default:
        return {
          bg: 'bg-gray-50 dark:bg-gray-900/20',
          border: 'border-gray-200 dark:border-gray-800',
          text: 'text-gray-800 dark:text-gray-200',
          icon: 'text-gray-600 dark:text-gray-400'
        };
    }
  };

  const style = getBannerStyle();

  const getMessage = () => {
    switch (circuitState.state) {
      case 'OPEN':
        return {
          title: 'Limited Functionality - Memory Search Unavailable',
          description: 'The semantic search service is currently unavailable. You can still create and view tasks, but search results may be limited. We\'re working to restore full functionality.',
          status: 'Degraded Mode Active'
        };
      case 'HALF_OPEN':
        return {
          title: 'Service Recovery in Progress',
          description: 'We\'re testing the connection to the search service. Full functionality will be restored shortly.',
          status: 'Testing Recovery'
        };
      default:
        return {
          title: 'Service Status Unknown',
          description: 'Unable to determine service status.',
          status: 'Unknown'
        };
    }
  };

  const message = getMessage();

  return (
    <div
      className={`
        ${style.bg} ${style.border} ${style.text}
        border-b-2 px-4 py-3 shadow-sm
        animate-in slide-in-from-top duration-300
      `}
      role="alert"
      aria-live="polite"
    >
      <div className="container mx-auto flex items-start gap-3">
        {/* Icon */}
        <AlertTriangle className={`${style.icon} w-5 h-5 mt-0.5 flex-shrink-0`} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="font-semibold text-sm mb-1">
                {message.title}
              </h3>
              <p className="text-xs opacity-90 mb-2">
                {message.description}
              </p>

              {/* Status badges */}
              <div className="flex items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1">
                  <span className="font-medium">Status:</span>
                  <span className="font-mono">{message.status}</span>
                </span>

                {circuitState.fallbackRequests > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <span className="font-medium">Fallback Requests:</span>
                    <span className="font-mono">{circuitState.fallbackRequests}</span>
                  </span>
                )}

                {circuitState.state === 'HALF_OPEN' && circuitState.consecutiveSuccesses > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <span className="font-medium">Recovery Progress:</span>
                    <span className="font-mono">
                      {circuitState.consecutiveSuccesses}/3 checks passed
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {circuitState.state === 'HALF_OPEN' && (
                <button
                  onClick={handleRefresh}
                  className={`
                    ${style.text}
                    hover:opacity-75 transition-opacity
                    p-1 rounded
                  `}
                  title="Refresh page"
                  aria-label="Refresh page to check recovery"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}

              {dismissible && (
                <button
                  onClick={handleDismiss}
                  className={`
                    ${style.text}
                    hover:opacity-75 transition-opacity
                    p-1 rounded
                  `}
                  title="Dismiss banner"
                  aria-label="Dismiss banner"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DegradedModeBanner;

/**
 * Usage Example:
 *
 * ```tsx
 * import DegradedModeBanner from './components/degraded-mode-ui-banner';
 *
 * function App() {
 *   return (
 *     <div>
 *       <DegradedModeBanner
 *         apiEndpoint="/api/memory-mcp/circuit-state"
 *         pollingInterval={10000}
 *         dismissible={true}
 *         onDismiss={() => console.log('Banner dismissed')}
 *       />
 *
 *       {/* Rest of your app * /}
 *     </div>
 *   );
 * }
 * ```
 *
 * Backend API should return JSON like:
 *
 * ```json
 * {
 *   "state": "OPEN",
 *   "consecutiveFailures": 5,
 *   "consecutiveSuccesses": 0,
 *   "lastFailureTime": "2025-11-08T16:30:00Z",
 *   "lastSuccessTime": "2025-11-08T16:25:00Z",
 *   "fallbackRequests": 42
 * }
 * ```
 */
