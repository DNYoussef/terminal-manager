/**
 * useTerminalStream - WebSocket hook for terminal output streaming
 *
 * Manages WebSocket connection lifecycle and message handling for terminal output
 */
import { useEffect, useRef, useCallback } from 'react';
import { useTerminalsStore } from '../store/searchStore';
import { TerminalMessage } from '../store/terminalsSlice';

const WS_BASE_URL = 'ws://localhost:8000/api/v1';
const RECONNECT_DELAY = 3000; // 3 seconds
const MAX_RECONNECT_ATTEMPTS = 5;

interface UseTerminalStreamOptions {
  terminalId: string;
  autoConnect?: boolean;
  onMessage?: (message: TerminalMessage) => void;
  onError?: (error: Event) => void;
  onClose?: (event: CloseEvent) => void;
}

export const useTerminalStream = ({
  terminalId,
  autoConnect = true,
  onMessage,
  onError,
  onClose,
}: UseTerminalStreamOptions) => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldConnectRef = useRef(autoConnect);

  const {
    addMessage,
    updateTerminal,
    setConnectionStatus,
  } = useTerminalsStore();

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    cleanup();

    const wsUrl = `${WS_BASE_URL}/terminals/${terminalId}/stream`;

    console.log(`[WebSocket] Connecting to terminal ${terminalId}...`);
    setConnectionStatus(terminalId, 'connecting');

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`[WebSocket] Connected to terminal ${terminalId}`);
      setConnectionStatus(terminalId, 'connected');
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const message: TerminalMessage = JSON.parse(event.data);

        // Store message in state
        addMessage(terminalId, message);

        // Handle different message types
        switch (message.type) {
          case 'stdout':
          case 'stderr':
            // Normal output - already stored
            break;

          case 'status':
            // Update terminal status
            if (message.status === 'stopped') {
              console.log(`[WebSocket] Terminal ${terminalId} stopped`);
              updateTerminal(terminalId, { status: 'stopped' });
              setConnectionStatus(terminalId, 'disconnected');
            }
            break;

          case 'connected':
            console.log(`[WebSocket] Terminal ${terminalId} stream connected`);
            break;

          case 'error':
            console.error(`[WebSocket] Terminal ${terminalId} error:`, message.message);
            setConnectionStatus(terminalId, 'error');
            break;

          case 'ping':
            // Keepalive ping - ignore
            break;

          default:
            console.warn(`[WebSocket] Unknown message type:`, message.type);
        }

        // Call user callback
        if (onMessage) {
          onMessage(message);
        }
      } catch (err) {
        console.error('[WebSocket] Error parsing message:', err);
      }
    };

    ws.onerror = (error) => {
      console.error(`[WebSocket] Error for terminal ${terminalId}:`, error);
      setConnectionStatus(terminalId, 'error');

      if (onError) {
        onError(error);
      }
    };

    ws.onclose = (event) => {
      console.log(`[WebSocket] Closed for terminal ${terminalId}, code: ${event.code}`);
      setConnectionStatus(terminalId, 'disconnected');

      if (onClose) {
        onClose(event);
      }

      // Auto-reconnect if connection was intentional and not cleanly closed
      if (
        shouldConnectRef.current &&
        event.code !== 1000 && // Normal closure
        event.code !== 1008 && // Policy violation (terminal not found)
        reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS
      ) {
        reconnectAttemptsRef.current++;
        console.log(
          `[WebSocket] Reconnecting to terminal ${terminalId} ` +
          `(attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`
        );

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, RECONNECT_DELAY);
      }
    };
  }, [terminalId, addMessage, updateTerminal, setConnectionStatus, onMessage, onError, onClose, cleanup]);

  const disconnect = useCallback(() => {
    shouldConnectRef.current = false;
    cleanup();
  }, [cleanup]);

  const reconnect = useCallback(() => {
    shouldConnectRef.current = true;
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (shouldConnectRef.current) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      shouldConnectRef.current = false;
      cleanup();
    };
  }, [terminalId, connect, cleanup]);

  return {
    connect,
    disconnect,
    reconnect,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  };
};
