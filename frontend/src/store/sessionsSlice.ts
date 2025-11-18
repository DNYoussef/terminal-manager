/**
 * Zustand Store Slice for Claude Code Sessions
 * Manages discovered sessions, search/filter state
 */

export interface SessionInfo {
  session_path: string;
  project_path: string;
  project_name: string;
  last_activity: string | null;
  command_count: number;
  recent_commands: string[];
  recent_agents: string[];
}

export interface SessionsSlice {
  // State
  sessions: SessionInfo[];
  selectedSession: SessionInfo | null;
  loading: boolean;
  error: string | null;
  searchQuery: string;
  filterByRecent: boolean;

  // Actions
  setSessions: (sessions: SessionInfo[]) => void;
  selectSession: (session: SessionInfo | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSearchQuery: (query: string) => void;
  setFilterByRecent: (filter: boolean) => void;

  // Getters
  getFilteredSessions: () => SessionInfo[];
}

export const createSessionsSlice = (set: any, get: any, _api?: any): SessionsSlice => ({
  // Initial state
  sessions: [],
  selectedSession: null,
  loading: false,
  error: null,
  searchQuery: '',
  filterByRecent: false,

  // Actions
  setSessions: (sessions) => set({ sessions, error: null }),

  selectSession: (session) => set({ selectedSession: session }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error, loading: false }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setFilterByRecent: (filter) => set({ filterByRecent: filter }),

  // Getters
  getFilteredSessions: () => {
    const { sessions, searchQuery, filterByRecent } = get();

    let filtered = sessions;

    // Filter by recent activity
    if (filterByRecent) {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      filtered = filtered.filter((session: SessionInfo) => {
        if (!session.last_activity) return false;
        return new Date(session.last_activity) > oneDayAgo;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((session: SessionInfo) => {
        return (
          session.project_name.toLowerCase().includes(query) ||
          session.project_path.toLowerCase().includes(query) ||
          session.recent_commands.some(cmd => cmd.toLowerCase().includes(query)) ||
          session.recent_agents.some(agent => agent.toLowerCase().includes(query))
        );
      });
    }

    return filtered;
  },
});
