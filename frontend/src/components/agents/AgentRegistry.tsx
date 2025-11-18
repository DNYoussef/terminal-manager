/**
 * AgentRegistry Component
 * Main component orchestrating agent management UI with real-time updates
 */

import React, { useEffect, useState } from 'react';
import { useAgentStream, AgentEvent } from '../../hooks/useAgentStream';
import { AgentFilters } from './AgentFilters';
import { AgentTable } from './AgentTable';
import { AgentDetailsModal } from './AgentDetailsModal';
import {
  AgentIdentity,
  AgentFilters as Filters,
  SortField,
} from '../../store/agentsSlice';

interface AgentRegistryProps {
  // Optional: For Zustand integration
  agents?: Record<string, AgentIdentity>;
  filteredAgentIds?: string[];
  selectedAgentId?: string | null;
  filters?: Filters;
  sortField?: SortField;
  sortDirection?: 'asc' | 'desc';
  currentPage?: number;
  pageSize?: number;
  loading?: boolean;
  error?: string | null;
  // Actions
  setAgents?: (agents: AgentIdentity[]) => void;
  setFilters?: (filters: Partial<Filters>) => void;
  resetFilters?: () => void;
  setSorting?: (field: SortField) => void;
  setPage?: (page: number) => void;
  selectAgent?: (agentId: string | null) => void;
  updateAgent?: (agentId: string, updates: Partial<AgentIdentity>) => void;
  setAgentStatus?: (agentId: string, status: string) => void;
  getFilteredAgents?: () => AgentIdentity[];
  getPaginatedAgents?: () => AgentIdentity[];
  getTotalPages?: () => number;
  getAgentById?: (agentId: string) => AgentIdentity | undefined;
  getAgentStats?: () => {
    total: number;
    active: number;
    idle: number;
    blocked: number;
    specialists: number;
    avgQualityScore: number;
  };
}

const defaultFilters: Filters = {
  role: 'all',
  category: 'all',
  status: 'all',
  specialistsOnly: false,
  searchQuery: '',
};

export const AgentRegistry: React.FC<AgentRegistryProps> = (props) => {
  // Local state (fallback if no store provided)
  const [localAgents, setLocalAgents] = useState<AgentIdentity[]>([]);
  const [localFilters, setLocalFilters] = useState<Filters>(defaultFilters);
  const [localSortField, setLocalSortField] = useState<SortField>('name');
  const [localSortDirection, setLocalSortDirection] = useState<'asc' | 'desc'>('asc');
  const [localPage, setLocalPage] = useState(1);
  const [localSelectedAgentId, setLocalSelectedAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // WebSocket stream for real-time updates
  const {
    events,
    isConnected,
    isReconnecting,
    error: wsError,
  } = useAgentStream();

  // Determine if using Zustand store or local state
  const usingStore = !!props.agents;

  const agents = usingStore ? Object.values(props.agents!) : localAgents;
  const filters = props.filters || localFilters;
  const sortField = props.sortField || localSortField;
  const sortDirection = props.sortDirection || localSortDirection;
  const currentPage = props.currentPage || localPage;
  const pageSize = props.pageSize || 25;
  const selectedAgentId = props.selectedAgentId || localSelectedAgentId;

  // Fetch agents on mount
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/v1/agents/');
        if (!response.ok) {
          throw new Error(`Failed to fetch agents: ${response.statusText}`);
        }
        const data = await response.json();

        if (usingStore && props.setAgents) {
          props.setAgents(data);
        } else {
          setLocalAgents(data);
        }

        setError(null);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load agents';
        setError(errorMsg);
        console.error('[AgentRegistry] Error fetching agents:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, []);

  // Process real-time events
  useEffect(() => {
    if (events.length === 0) return;

    const latestEvent = events[events.length - 1];
    processAgentEvent(latestEvent);
  }, [events]);

  const processAgentEvent = (event: AgentEvent) => {
    // Extract agent ID from event metadata or agentName
    const agentId = event.metadata?.agent_id || event.agentName;

    if (!agentId) return;

    // Update agent based on event type
    switch (event.type) {
      case 'agent_spawned':
        // Agent became active
        if (usingStore && props.setAgentStatus) {
          props.setAgentStatus(agentId, 'active');
        } else {
          updateLocalAgentStatus(agentId, 'active');
        }
        break;

      case 'operation_allowed':
      case 'task_completed':
        // Agent is active and performing work
        if (usingStore && props.setAgentStatus) {
          props.setAgentStatus(agentId, 'active');
        } else {
          updateLocalAgentStatus(agentId, 'active');
        }
        break;

      case 'operation_denied':
        // Agent blocked
        if (usingStore && props.setAgentStatus) {
          props.setAgentStatus(agentId, 'blocked');
        } else {
          updateLocalAgentStatus(agentId, 'blocked');
        }
        break;

      case 'budget_updated':
        // Update budget information
        if (event.metadata?.tokens && event.metadata?.cost) {
          if (usingStore && props.updateAgent) {
            props.updateAgent(agentId, {
              budget: {
                ...getAgentBudget(agentId),
                tokens_used_today: event.metadata.tokens,
                cost_used_today: event.metadata.cost,
              },
            });
          } else {
            updateLocalAgentBudget(agentId, event.metadata.tokens, event.metadata.cost);
          }
        }
        break;

      case 'quality_gate_passed':
      case 'quality_gate_failed':
        // Update quality score
        if (event.metadata?.score !== undefined) {
          if (usingStore && props.updateAgent) {
            props.updateAgent(agentId, {
              performance: {
                ...getAgentPerformance(agentId),
                quality_score: event.metadata.score,
              },
            });
          } else {
            updateLocalAgentQuality(agentId, event.metadata.score);
          }
        }
        break;

      case 'task_failed':
        // Agent may need attention
        if (usingStore && props.setAgentStatus) {
          props.setAgentStatus(agentId, 'paused');
        } else {
          updateLocalAgentStatus(agentId, 'paused');
        }
        break;
    }
  };

  // Helper functions for local state updates
  const updateLocalAgentStatus = (agentId: string, status: string) => {
    setLocalAgents(prev =>
      prev.map(agent =>
        agent.agent_id === agentId
          ? { ...agent, status: status as any }
          : agent
      )
    );
  };

  const updateLocalAgentBudget = (agentId: string, tokens: number, cost: number) => {
    setLocalAgents(prev =>
      prev.map(agent =>
        agent.agent_id === agentId
          ? {
              ...agent,
              budget: {
                ...agent.budget,
                tokens_used_today: tokens,
                cost_used_today: cost,
              },
            }
          : agent
      )
    );
  };

  const updateLocalAgentQuality = (agentId: string, score: number) => {
    setLocalAgents(prev =>
      prev.map(agent =>
        agent.agent_id === agentId
          ? {
              ...agent,
              performance: {
                ...agent.performance,
                quality_score: score,
              },
            }
          : agent
      )
    );
  };

  const getAgentBudget = (agentId: string) => {
    const agent = usingStore
      ? props.getAgentById?.(agentId)
      : localAgents.find(a => a.agent_id === agentId);
    return agent?.budget || {
      max_tokens_per_session: 0,
      max_cost_per_day: 0,
      currency: 'USD',
      tokens_used_today: 0,
      cost_used_today: 0,
      last_reset: new Date().toISOString(),
    };
  };

  const getAgentPerformance = (agentId: string) => {
    const agent = usingStore
      ? props.getAgentById?.(agentId)
      : localAgents.find(a => a.agent_id === agentId);
    return agent?.performance || {
      success_rate: 0,
      avg_execution_time_ms: 0,
      quality_score: 0,
      total_tasks_completed: 0,
    };
  };

  // Filter and sort agents (local implementation)
  const getFilteredAndSortedAgents = (): AgentIdentity[] => {
    if (usingStore && props.getFilteredAgents) {
      return props.getFilteredAgents();
    }

    // Local filtering
    let filtered = agents.filter(agent => {
      if (filters.role !== 'all' && agent.role !== filters.role) return false;
      if (filters.category !== 'all' && agent.metadata.category !== filters.category) return false;
      if (filters.status !== 'all' && agent.status !== filters.status) return false;
      if (filters.specialistsOnly && !agent.metadata.specialist) return false;

      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchesName = agent.name.toLowerCase().includes(query);
        const matchesCaps = agent.capabilities.some(c => c.toLowerCase().includes(query));
        const matchesTags = agent.metadata.tags.some(t => t.toLowerCase().includes(query));
        if (!matchesName && !matchesCaps && !matchesTags) return false;
      }

      return true;
    });

    // Local sorting
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortField) {
        case 'name': aVal = a.name; bVal = b.name; break;
        case 'role': aVal = a.role; bVal = b.role; break;
        case 'category': aVal = a.metadata.category; bVal = b.metadata.category; break;
        case 'status': aVal = a.status; bVal = b.status; break;
        case 'budgetUsed':
          aVal = a.budget.cost_used_today / a.budget.max_cost_per_day;
          bVal = b.budget.cost_used_today / b.budget.max_cost_per_day;
          break;
        case 'qualityScore': aVal = a.performance.quality_score; bVal = b.performance.quality_score; break;
        case 'successRate': aVal = a.performance.success_rate; bVal = b.performance.success_rate; break;
        case 'tasksCompleted': aVal = a.performance.total_tasks_completed; bVal = b.performance.total_tasks_completed; break;
        default: aVal = a.name; bVal = b.name;
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return filtered;
  };

  const getPaginatedAgents = (): AgentIdentity[] => {
    if (usingStore && props.getPaginatedAgents) {
      return props.getPaginatedAgents();
    }

    const filtered = getFilteredAndSortedAgents();
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  };

  const getTotalPages = (): number => {
    if (usingStore && props.getTotalPages) {
      return props.getTotalPages();
    }

    const filtered = getFilteredAndSortedAgents();
    return Math.ceil(filtered.length / pageSize);
  };

  const getStats = () => {
    if (usingStore && props.getAgentStats) {
      return props.getAgentStats();
    }

    return {
      total: agents.length,
      active: agents.filter(a => a.status === 'active').length,
      idle: agents.filter(a => a.status === 'idle').length,
      blocked: agents.filter(a => a.status === 'blocked').length,
      specialists: agents.filter(a => a.metadata.specialist).length,
      avgQualityScore: agents.reduce((sum, a) => sum + a.performance.quality_score, 0) / (agents.length || 1),
    };
  };

  // Event handlers
  const handleFiltersChange = (newFilters: Partial<Filters>) => {
    if (usingStore && props.setFilters) {
      props.setFilters(newFilters);
    } else {
      setLocalFilters(prev => ({ ...prev, ...newFilters }));
      setLocalPage(1);
    }
  };

  const handleResetFilters = () => {
    if (usingStore && props.resetFilters) {
      props.resetFilters();
    } else {
      setLocalFilters(defaultFilters);
      setLocalPage(1);
    }
  };

  const handleSort = (field: SortField) => {
    if (usingStore && props.setSorting) {
      props.setSorting(field);
    } else {
      const newDirection = localSortField === field && localSortDirection === 'asc' ? 'desc' : 'asc';
      setLocalSortField(field);
      setLocalSortDirection(newDirection);
    }
  };

  const handlePageChange = (page: number) => {
    if (usingStore && props.setPage) {
      props.setPage(page);
    } else {
      setLocalPage(page);
    }
  };

  const handleAgentClick = (agentId: string) => {
    if (usingStore && props.selectAgent) {
      props.selectAgent(agentId);
    } else {
      setLocalSelectedAgentId(agentId);
    }
  };

  const handleCloseModal = () => {
    if (usingStore && props.selectAgent) {
      props.selectAgent(null);
    } else {
      setLocalSelectedAgentId(null);
    }
  };

  const getSelectedAgent = (): AgentIdentity | null => {
    if (!selectedAgentId) return null;

    if (usingStore && props.getAgentById) {
      return props.getAgentById(selectedAgentId) || null;
    }

    return localAgents.find(a => a.agent_id === selectedAgentId) || null;
  };

  const stats = getStats();
  const filteredAgents = getFilteredAndSortedAgents();
  const paginatedAgents = getPaginatedAgents();
  const totalPages = getTotalPages();
  const selectedAgent = getSelectedAgent();

  if (loading) {
    return (
      <div className="agent-registry loading">
        <div className="loading-spinner">Loading agents...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="agent-registry error">
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  return (
    <div className="agent-registry">
      {/* Header with Stats */}
      <div className="registry-header">
        <div className="header-title">
          <h1>Agent Registry</h1>
          <div className="connection-status">
            {isConnected ? (
              <span className="status-connected">Connected</span>
            ) : isReconnecting ? (
              <span className="status-reconnecting">Reconnecting...</span>
            ) : (
              <span className="status-disconnected">Disconnected</span>
            )}
          </div>
        </div>

        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-label">Total</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Active</span>
            <span className="stat-value active">{stats.active}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Idle</span>
            <span className="stat-value idle">{stats.idle}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Blocked</span>
            <span className="stat-value blocked">{stats.blocked}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Specialists</span>
            <span className="stat-value">{stats.specialists}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Avg Quality</span>
            <span className="stat-value">{stats.avgQualityScore.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <AgentFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onReset={handleResetFilters}
        totalAgents={agents.length}
        filteredCount={filteredAgents.length}
      />

      {/* Table */}
      <AgentTable
        agents={paginatedAgents}
        onAgentClick={handleAgentClick}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />

      {/* Details Modal */}
      <AgentDetailsModal
        agent={selectedAgent}
        isOpen={!!selectedAgentId}
        onClose={handleCloseModal}
      />

      <style>{`
        .agent-registry {
          padding: 2rem;
          max-width: 1400px;
          margin: 0 auto;
        }

        .agent-registry.loading,
        .agent-registry.error {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 400px;
        }

        .loading-spinner {
          font-size: 1.125rem;
          color: var(--text-secondary, #6c757d);
        }

        .error-message {
          padding: 1.5rem;
          background: #f8d7da;
          color: #721c24;
          border-radius: 8px;
          border: 1px solid #f5c6cb;
        }

        .registry-header {
          margin-bottom: 2rem;
        }

        .header-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .header-title h1 {
          margin: 0;
          font-size: 2rem;
          color: var(--text-primary, #212529);
        }

        .connection-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .connection-status span {
          padding: 0.375rem 0.75rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .status-connected {
          background: #d4edda;
          color: #155724;
        }

        .status-reconnecting {
          background: #fff3cd;
          color: #856404;
        }

        .status-disconnected {
          background: #f8d7da;
          color: #721c24;
        }

        .stats-bar {
          display: flex;
          gap: 1.5rem;
          padding: 1.5rem;
          background: var(--surface-secondary, #f8f9fa);
          border-radius: 8px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .stat-label {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--text-secondary, #6c757d);
          text-transform: uppercase;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary, #212529);
        }

        .stat-value.active { color: #28a745; }
        .stat-value.idle { color: #ffc107; }
        .stat-value.blocked { color: #dc3545; }

        /* Responsive */
        @media (max-width: 1024px) {
          .stats-bar {
            flex-wrap: wrap;
          }
        }

        @media (max-width: 768px) {
          .agent-registry {
            padding: 1rem;
          }

          .header-title {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }

          .header-title h1 {
            font-size: 1.5rem;
          }

          .stats-bar {
            grid-template-columns: repeat(3, 1fr);
            gap: 1rem;
            padding: 1rem;
          }

          .stat-value {
            font-size: 1.25rem;
          }
        }
      `}</style>
    </div>
  );
};
