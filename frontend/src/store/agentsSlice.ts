/**
 * Zustand Store Slice for Agent Registry
 * Manages 207 agents with real-time updates, filtering, and sorting
 */

export type AgentRole = 'admin' | 'developer' | 'researcher' | 'tester' |
  'reviewer' | 'architect' | 'analyst' | 'coordinator' | 'specialist' | 'other';

export type AgentCategory = 'delivery' | 'foundry' | 'security' | 'quality' |
  'infrastructure' | 'research' | 'documentation' | 'platform' | 'other';

export type AgentStatus = 'active' | 'idle' | 'paused' | 'blocked' | 'offline';

export interface AgentIdentity {
  agent_id: string;
  name: string;
  role: AgentRole;
  capabilities: string[];
  rbac: {
    allowed_tools: string[];
    denied_tools: string[];
    path_scopes: string[];
    api_access: string[];
    requires_approval: boolean;
    approval_threshold: number;
  };
  budget: {
    max_tokens_per_session: number;
    max_cost_per_day: number;
    currency: string;
    tokens_used_today: number;
    cost_used_today: number;
    last_reset: string;
  };
  metadata: {
    category: AgentCategory;
    specialist: boolean;
    version: string;
    tags: string[];
  };
  performance: {
    success_rate: number;
    avg_execution_time_ms: number;
    quality_score: number;
    total_tasks_completed: number;
  };
  timestamps: {
    created_at: string;
    updated_at: string;
    last_active_at: string | null;
  };
  status?: AgentStatus; // Derived from real-time activity
}

export interface AgentFilters {
  role: AgentRole | 'all';
  category: AgentCategory | 'all';
  status: AgentStatus | 'all';
  specialistsOnly: boolean;
  searchQuery: string;
}

export type SortField = 'name' | 'role' | 'category' | 'status' |
  'budgetUsed' | 'qualityScore' | 'successRate' | 'tasksCompleted';

export type SortDirection = 'asc' | 'desc';

export interface AgentSlice {
  // State
  agents: Record<string, AgentIdentity>;
  filteredAgentIds: string[];
  selectedAgentId: string | null;
  filters: AgentFilters;
  sortField: SortField;
  sortDirection: SortDirection;
  currentPage: number;
  pageSize: number;
  loading: boolean;
  error: string | null;

  // Actions - Agents
  setAgents: (agents: AgentIdentity[]) => void;
  updateAgent: (agentId: string, updates: Partial<AgentIdentity>) => void;
  setAgentStatus: (agentId: string, status: AgentStatus) => void;
  selectAgent: (agentId: string | null) => void;

  // Actions - Filters
  setFilters: (filters: Partial<AgentFilters>) => void;
  resetFilters: () => void;

  // Actions - Sorting
  setSorting: (field: SortField, direction?: SortDirection) => void;

  // Actions - Pagination
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;

  // Actions - Loading/Error
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Internal
  applyFilters: () => void;

  // Getters
  getFilteredAgents: () => AgentIdentity[];
  getPaginatedAgents: () => AgentIdentity[];
  getTotalPages: () => number;
  getAgentById: (agentId: string) => AgentIdentity | undefined;
  getAgentsByRole: (role: AgentRole) => AgentIdentity[];
  getAgentsByCategory: (category: AgentCategory) => AgentIdentity[];
  getAgentStats: () => {
    total: number;
    active: number;
    idle: number;
    blocked: number;
    specialists: number;
    avgQualityScore: number;
  };
}

const defaultFilters: AgentFilters = {
  role: 'all',
  category: 'all',
  status: 'all',
  specialistsOnly: false,
  searchQuery: '',
};

export const createAgentSlice = (set: any, get: any): AgentSlice => ({
  // Initial state
  agents: {},
  filteredAgentIds: [],
  selectedAgentId: null,
  filters: defaultFilters,
  sortField: 'name',
  sortDirection: 'asc',
  currentPage: 1,
  pageSize: 25,
  loading: false,
  error: null,

  // Agent actions
  setAgents: (agentList) => {
    const agents: Record<string, AgentIdentity> = {};
    agentList.forEach(agent => {
      agents[agent.agent_id] = {
        ...agent,
        status: agent.status || 'idle', // Default status
      };
    });

    set({ agents, error: null });

    // Trigger filtering after setting agents
    const state = get();
    state.applyFilters();
  },

  updateAgent: (agentId, updates) => {
    set((state: AgentSlice) => {
      if (!state.agents[agentId]) return state;

      return {
        agents: {
          ...state.agents,
          [agentId]: {
            ...state.agents[agentId],
            ...updates,
            timestamps: {
              ...state.agents[agentId].timestamps,
              updated_at: new Date().toISOString(),
            },
          },
        },
      };
    });

    // Reapply filters after update
    get().applyFilters();
  },

  setAgentStatus: (agentId, status) => {
    get().updateAgent(agentId, {
      status,
      timestamps: {
        ...get().agents[agentId]?.timestamps,
        last_active_at: status === 'active' ? new Date().toISOString() :
          get().agents[agentId]?.timestamps.last_active_at,
      },
    });
  },

  selectAgent: (agentId) => set({ selectedAgentId: agentId }),

  // Filter actions
  setFilters: (newFilters) => {
    set((state: AgentSlice) => ({
      filters: { ...state.filters, ...newFilters },
      currentPage: 1, // Reset to first page on filter change
    }));
    get().applyFilters();
  },

  resetFilters: () => {
    set({ filters: defaultFilters, currentPage: 1 });
    get().applyFilters();
  },

  // Internal filter application (not exported)
  applyFilters: () => {
    const { agents, filters, sortField, sortDirection } = get();

    let filtered: AgentIdentity[] = (Object.values(agents) as AgentIdentity[]).filter((agent: AgentIdentity) => {
      // Role filter
      if (filters.role !== 'all' && agent.role !== filters.role) {
        return false;
      }

      // Category filter
      if (filters.category !== 'all' && agent.metadata.category !== filters.category) {
        return false;
      }

      // Status filter
      if (filters.status !== 'all' && agent.status !== filters.status) {
        return false;
      }

      // Specialists only filter
      if (filters.specialistsOnly && !agent.metadata.specialist) {
        return false;
      }

      // Search query (name, capabilities, tags)
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchesName = agent.name.toLowerCase().includes(query);
        const matchesCapabilities = agent.capabilities.some(cap =>
          cap.toLowerCase().includes(query)
        );
        const matchesTags = agent.metadata.tags.some(tag =>
          tag.toLowerCase().includes(query)
        );

        if (!matchesName && !matchesCapabilities && !matchesTags) {
          return false;
        }
      }

      return true;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortField) {
        case 'name':
          aVal = a.name;
          bVal = b.name;
          break;
        case 'role':
          aVal = a.role;
          bVal = b.role;
          break;
        case 'category':
          aVal = a.metadata.category;
          bVal = b.metadata.category;
          break;
        case 'status':
          aVal = a.status || 'idle';
          bVal = b.status || 'idle';
          break;
        case 'budgetUsed':
          aVal = a.budget.cost_used_today / a.budget.max_cost_per_day;
          bVal = b.budget.cost_used_today / b.budget.max_cost_per_day;
          break;
        case 'qualityScore':
          aVal = a.performance.quality_score;
          bVal = b.performance.quality_score;
          break;
        case 'successRate':
          aVal = a.performance.success_rate;
          bVal = b.performance.success_rate;
          break;
        case 'tasksCompleted':
          aVal = a.performance.total_tasks_completed;
          bVal = b.performance.total_tasks_completed;
          break;
        default:
          aVal = a.name;
          bVal = b.name;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ?
          aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    set({ filteredAgentIds: filtered.map((a: AgentIdentity) => a.agent_id) });
  },

  // Sorting actions
  setSorting: (field, direction) => {
    set((state: AgentSlice) => ({
      sortField: field,
      sortDirection: direction ||
        (state.sortField === field && state.sortDirection === 'asc' ? 'desc' : 'asc'),
    }));
    get().applyFilters();
  },

  // Pagination actions
  setPage: (page) => set({ currentPage: page }),
  setPageSize: (size) => set({ pageSize: size, currentPage: 1 }),

  // Loading/Error actions
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),

  // Getters
  getFilteredAgents: () => {
    const { agents, filteredAgentIds } = get();
    return filteredAgentIds.map(id => agents[id]);
  },

  getPaginatedAgents: () => {
    const { currentPage, pageSize } = get();
    const filtered = get().getFilteredAgents();
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  },

  getTotalPages: () => {
    const { pageSize } = get();
    const filtered = get().getFilteredAgents();
    return Math.ceil(filtered.length / pageSize);
  },

  getAgentById: (agentId) => get().agents[agentId],

  getAgentsByRole: (role) => {
    const { agents } = get();
    return (Object.values(agents) as AgentIdentity[]).filter((a: AgentIdentity) => a.role === role);
  },

  getAgentsByCategory: (category) => {
    const { agents } = get();
    return (Object.values(agents) as AgentIdentity[]).filter((a: AgentIdentity) =>
      a.metadata.category === category
    );
  },

  getAgentStats: () => {
    const { agents } = get();
    const agentList = Object.values(agents) as AgentIdentity[];

    const stats = {
      total: agentList.length,
      active: agentList.filter(a => a.status === 'active').length,
      idle: agentList.filter(a => a.status === 'idle').length,
      blocked: agentList.filter(a => a.status === 'blocked').length,
      specialists: agentList.filter(a => a.metadata.specialist).length,
      avgQualityScore: agentList.reduce((sum, a) => sum + a.performance.quality_score, 0) /
        (agentList.length || 1),
    };

    return stats;
  },
});
