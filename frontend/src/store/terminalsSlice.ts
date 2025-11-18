/**
 * Terminals Slice - Zustand store for terminal state management
 *
 * Manages:
 * - Active terminals list
 * - Selected terminal
 * - Terminal output streams
 * - WebSocket connection states
 */
import { StateCreator } from 'zustand';

export interface TerminalInfo {
  id: string;
  project_id: string;
  working_dir: string;
  status: 'active' | 'idle' | 'stopped' | 'error';
  created_at: string;
  last_activity_at: string;
  pid?: number;
  is_running?: boolean;
  cpu_percent?: number;
  memory_mb?: number;
}

export interface TerminalMessage {
  terminal_id: string;
  type: 'stdout' | 'stderr' | 'status' | 'connected' | 'error' | 'ping';
  line?: string;
  status?: string;
  exit_code?: number;
  message?: string;
  timestamp?: string;
}

export interface TerminalsSlice {
  // State
  terminals: TerminalInfo[];
  selectedTerminalId: string | null;
  terminalMessages: Record<string, TerminalMessage[]>; // terminal_id -> messages
  connectionStatus: Record<string, 'connected' | 'connecting' | 'disconnected' | 'error'>; // terminal_id -> status

  // Actions
  setTerminals: (terminals: TerminalInfo[]) => void;
  addTerminal: (terminal: TerminalInfo) => void;
  updateTerminal: (id: string, updates: Partial<TerminalInfo>) => void;
  removeTerminal: (id: string) => void;

  selectTerminal: (id: string | null) => void;

  addMessage: (terminalId: string, message: TerminalMessage) => void;
  clearMessages: (terminalId: string) => void;

  setConnectionStatus: (terminalId: string, status: 'connected' | 'connecting' | 'disconnected' | 'error') => void;

  // Computed
  getTerminal: (id: string) => TerminalInfo | undefined;
  getMessages: (terminalId: string) => TerminalMessage[];
  getConnectionStatus: (terminalId: string) => 'connected' | 'connecting' | 'disconnected' | 'error';
}

export const createTerminalsSlice: StateCreator<TerminalsSlice> = (set, get, _api) => ({
  // Initial state
  terminals: [],
  selectedTerminalId: null,
  terminalMessages: {},
  connectionStatus: {},

  // Actions
  setTerminals: (terminals) => {
    set({ terminals });
  },

  addTerminal: (terminal) => {
    set((state) => ({
      terminals: [...state.terminals, terminal],
    }));
  },

  updateTerminal: (id, updates) => {
    set((state) => ({
      terminals: state.terminals.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    }));
  },

  removeTerminal: (id) => {
    set((state) => ({
      terminals: state.terminals.filter((t) => t.id !== id),
      selectedTerminalId: state.selectedTerminalId === id ? null : state.selectedTerminalId,
      terminalMessages: {
        ...state.terminalMessages,
        [id]: undefined,
      },
      connectionStatus: {
        ...state.connectionStatus,
        [id]: undefined,
      },
    }));
  },

  selectTerminal: (id) => {
    set({ selectedTerminalId: id });
  },

  addMessage: (terminalId, message) => {
    set((state) => ({
      terminalMessages: {
        ...state.terminalMessages,
        [terminalId]: [...(state.terminalMessages[terminalId] || []), message],
      },
    }));
  },

  clearMessages: (terminalId) => {
    set((state) => ({
      terminalMessages: {
        ...state.terminalMessages,
        [terminalId]: [],
      },
    }));
  },

  setConnectionStatus: (terminalId, status) => {
    set((state) => ({
      connectionStatus: {
        ...state.connectionStatus,
        [terminalId]: status,
      },
    }));
  },

  // Computed
  getTerminal: (id) => {
    return get().terminals.find((t) => t.id === id);
  },

  getMessages: (terminalId) => {
    return get().terminalMessages[terminalId] || [];
  },

  getConnectionStatus: (terminalId) => {
    return get().connectionStatus[terminalId] || 'disconnected';
  },
});
