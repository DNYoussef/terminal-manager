import { useEffect, useRef, useState, useCallback } from 'react';

export interface AgentEvent {
  id: string;
  type: 'agent_spawned' | 'operation_allowed' | 'operation_denied' | 'budget_updated' |
        'quality_gate_passed' | 'quality_gate_failed' | 'task_completed' | 'task_failed';
  timestamp: string;
  agentName: string;
  agentRole: string;
  message: string;
  metadata?: {
    operation?: string;
    file?: string;
    reason?: string;
    tokens?: number;
    cost?: number;
    budgetRemaining?: number;
    score?: number;
    duration?: number;
    error?: string;
    [key: string]: any;
  };
}

export interface AgentStreamOptions {
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  bufferSize?: number;
  batchInterval?: number;
}

interface UseAgentStreamReturn {
  events: AgentEvent[];
  isConnected: boolean;
  isReconnecting: boolean;
  error: Error | null;
  addEvent: (event: AgentEvent) => void;
  clearEvents: () => void;
  reconnect: () => void;
}

const DEFAULT_OPTIONS: Required<AgentStreamOptions> = {
  autoReconnect: true,
  reconnectDelay: 2000,
  maxReconnectAttempts: 5,
  bufferSize: 1000,
  batchInterval: 100,
};

export const useAgentStream = (
  options: AgentStreamOptions = {}
): UseAgentStreamReturn => {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const eventBufferRef = useRef<AgentEvent[]>([]);
  const batchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Batch processing to avoid excessive re-renders
  const flushEventBuffer = useCallback(() => {
    if (eventBufferRef.current.length > 0) {
      setEvents(prev => {
        const newEvents = [...prev, ...eventBufferRef.current];
        // Maintain buffer size limit
        if (newEvents.length > opts.bufferSize) {
          return newEvents.slice(-opts.bufferSize);
        }
        return newEvents;
      });
      eventBufferRef.current = [];
    }
  }, [opts.bufferSize]);

  const addEvent = useCallback((event: AgentEvent) => {
    eventBufferRef.current.push(event);

    // Clear existing timer
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
    }

    // Schedule batch flush
    batchTimerRef.current = setTimeout(flushEventBuffer, opts.batchInterval);
  }, [flushEventBuffer, opts.batchInterval]);

  const clearEvents = useCallback(() => {
    setEvents([]);
    eventBufferRef.current = [];
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/v1/agents/activity/stream`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[AgentStream] Connected to WebSocket');
        setIsConnected(true);
        setIsReconnecting(false);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle different message types
          if (data.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
            return;
          }

          if (data.type === 'batch' && Array.isArray(data.events)) {
            // Handle batch of events
            data.events.forEach((evt: AgentEvent) => addEvent(evt));
          } else if (data.id && data.type && data.timestamp) {
            // Handle single event
            addEvent(data as AgentEvent);
          }
        } catch (err) {
          console.error('[AgentStream] Failed to parse message:', err);
        }
      };

      ws.onerror = (evt) => {
        console.error('[AgentStream] WebSocket error:', evt);
        setError(new Error('WebSocket connection error'));
      };

      ws.onclose = () => {
        console.log('[AgentStream] WebSocket closed');
        setIsConnected(false);
        wsRef.current = null;

        // Auto-reconnect if enabled
        if (opts.autoReconnect && reconnectAttemptsRef.current < opts.maxReconnectAttempts) {
          setIsReconnecting(true);
          reconnectAttemptsRef.current += 1;

          const delay = opts.reconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1);
          console.log(`[AgentStream] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${opts.maxReconnectAttempts})`);

          setTimeout(() => {
            connect();
          }, delay);
        } else {
          setIsReconnecting(false);
        }
      };
    } catch (err) {
      console.error('[AgentStream] Failed to create WebSocket:', err);
      setError(err instanceof Error ? err : new Error('Failed to connect'));
    }
  }, [opts.autoReconnect, opts.reconnectDelay, opts.maxReconnectAttempts, addEvent]);

  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
    };
  }, [connect]);

  return {
    events,
    isConnected,
    isReconnecting,
    error,
    addEvent,
    clearEvents,
    reconnect,
  };
};
