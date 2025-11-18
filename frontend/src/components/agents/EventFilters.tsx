import React from 'react';

export interface EventFiltersState {
  eventTypes: Set<string>;
  agents: Set<string>;
  statuses: Set<string>;
  searchQuery: string;
  timeRange: 'hour' | 'day' | 'week' | 'all';
}

interface EventFiltersProps {
  filters: EventFiltersState;
  onChange: (filters: EventFiltersState) => void;
  availableAgents: string[];
}

const EVENT_TYPE_OPTIONS = [
  { value: 'agent_spawned', label: 'Agent Spawned', icon: '🟦' },
  { value: 'operation_allowed', label: 'Operation Allowed', icon: '✓' },
  { value: 'operation_denied', label: 'Operation Denied', icon: '✕' },
  { value: 'budget_updated', label: 'Budget Updated', icon: '💰' },
  { value: 'quality_gate_passed', label: 'Quality Gate Passed', icon: '✓' },
  { value: 'quality_gate_failed', label: 'Quality Gate Failed', icon: '⚠' },
  { value: 'task_completed', label: 'Task Completed', icon: '✓' },
  { value: 'task_failed', label: 'Task Failed', icon: '✕' },
];

const STATUS_OPTIONS = [
  { value: 'allowed', label: 'Allowed' },
  { value: 'denied', label: 'Denied' },
  { value: 'failed', label: 'Failed' },
];

const TIME_RANGE_OPTIONS = [
  { value: 'hour', label: 'Last Hour' },
  { value: 'day', label: 'Last Day' },
  { value: 'week', label: 'Last Week' },
  { value: 'all', label: 'All Time' },
];

export const EventFilters: React.FC<EventFiltersProps> = ({
  filters,
  onChange,
  availableAgents,
}) => {
  const toggleEventType = (type: string) => {
    const newTypes = new Set(filters.eventTypes);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    onChange({ ...filters, eventTypes: newTypes });
  };

  const toggleAgent = (agent: string) => {
    const newAgents = new Set(filters.agents);
    if (newAgents.has(agent)) {
      newAgents.delete(agent);
    } else {
      newAgents.add(agent);
    }
    onChange({ ...filters, agents: newAgents });
  };

  const toggleStatus = (status: string) => {
    const newStatuses = new Set(filters.statuses);
    if (newStatuses.has(status)) {
      newStatuses.delete(status);
    } else {
      newStatuses.add(status);
    }
    onChange({ ...filters, statuses: newStatuses });
  };

  const clearAllFilters = () => {
    onChange({
      eventTypes: new Set(),
      agents: new Set(),
      statuses: new Set(),
      searchQuery: '',
      timeRange: 'all',
    });
  };

  const hasActiveFilters =
    filters.eventTypes.size > 0 ||
    filters.agents.size > 0 ||
    filters.statuses.size > 0 ||
    filters.searchQuery.length > 0 ||
    filters.timeRange !== 'all';

  return (
    <div className="bg-white border-b border-gray-200 p-4 space-y-4">
      {/* Search */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={filters.searchQuery}
          onChange={(e) => onChange({ ...filters, searchQuery: e.target.value })}
          placeholder="Search events..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        {/* Time Range */}
        <select
          value={filters.timeRange}
          onChange={(e) => onChange({ ...filters, timeRange: e.target.value as any })}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {TIME_RANGE_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Event Types */}
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
          Event Types
        </div>
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPE_OPTIONS.map(option => (
            <button
              key={option.value}
              onClick={() => toggleEventType(option.value)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                filters.eventTypes.has(option.value)
                  ? 'bg-blue-100 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="mr-1">{option.icon}</span>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Agents */}
      {availableAgents.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
            Agents
          </div>
          <div className="flex flex-wrap gap-2">
            {availableAgents.map(agent => (
              <button
                key={agent}
                onClick={() => toggleAgent(agent)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  filters.agents.has(agent)
                    ? 'bg-green-100 border-green-300 text-green-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {agent}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Statuses */}
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
          Status
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map(option => (
            <button
              key={option.value}
              onClick={() => toggleStatus(option.value)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                filters.statuses.has(option.value)
                  ? 'bg-purple-100 border-purple-300 text-purple-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active Filters Count */}
      {hasActiveFilters && (
        <div className="text-xs text-gray-500">
          {filters.eventTypes.size + filters.agents.size + filters.statuses.size + (filters.searchQuery ? 1 : 0) + (filters.timeRange !== 'all' ? 1 : 0)} active filter(s)
        </div>
      )}
    </div>
  );
};
