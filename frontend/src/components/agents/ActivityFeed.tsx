import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAgentStream, AgentEvent } from '../../hooks/useAgentStream';
import { EventCard } from './EventCard';
import { EventFilters, EventFiltersState } from './EventFilters';

interface ActivityFeedProps {
  className?: string;
}

const VIRTUAL_SCROLL_LIMIT = 50;

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ className = '' }) => {
  const { events, isConnected, isReconnecting, error, clearEvents, reconnect } = useAgentStream({
    autoReconnect: true,
    reconnectDelay: 2000,
    maxReconnectAttempts: 5,
    bufferSize: 1000,
    batchInterval: 100,
  });

  const [filters, setFilters] = useState<EventFiltersState>({
    eventTypes: new Set(),
    agents: new Set(),
    statuses: new Set(),
    searchQuery: '',
    timeRange: 'all',
  });

  const [showFilters, setShowFilters] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AgentEvent | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Extract unique agents from events
  const availableAgents = useMemo(() => {
    const agentSet = new Set(events.map(e => e.agentName));
    return Array.from(agentSet).sort();
  }, [events]);

  // Filter events based on current filters
  const filteredEvents = useMemo(() => {
    let filtered = events;

    // Event type filter
    if (filters.eventTypes.size > 0) {
      filtered = filtered.filter(e => filters.eventTypes.has(e.type));
    }

    // Agent filter
    if (filters.agents.size > 0) {
      filtered = filtered.filter(e => filters.agents.has(e.agentName));
    }

    // Status filter
    if (filters.statuses.size > 0) {
      filtered = filtered.filter(e => {
        if (filters.statuses.has('allowed') && e.type === 'operation_allowed') return true;
        if (filters.statuses.has('denied') && e.type === 'operation_denied') return true;
        if (filters.statuses.has('failed') && e.type === 'task_failed') return true;
        return false;
      });
    }

    // Search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.message.toLowerCase().includes(query) ||
        e.agentName.toLowerCase().includes(query) ||
        e.agentRole.toLowerCase().includes(query)
      );
    }

    // Time range filter
    if (filters.timeRange !== 'all') {
      const now = new Date();
      const cutoff = new Date();

      switch (filters.timeRange) {
        case 'hour':
          cutoff.setHours(now.getHours() - 1);
          break;
        case 'day':
          cutoff.setDate(now.getDate() - 1);
          break;
        case 'week':
          cutoff.setDate(now.getDate() - 7);
          break;
      }

      filtered = filtered.filter(e => new Date(e.timestamp) >= cutoff);
    }

    return filtered;
  }, [events, filters]);

  // Virtual scrolling - only show last N events
  const visibleEvents = useMemo(() => {
    return filteredEvents.slice(-VIRTUAL_SCROLL_LIMIT);
  }, [filteredEvents]);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [visibleEvents, autoScroll]);

  // Pause auto-scroll on hover
  const handleMouseEnter = () => {
    setAutoScroll(false);
  };

  const handleMouseLeave = () => {
    setAutoScroll(true);
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Timestamp', 'Agent Name', 'Agent Role', 'Event Type', 'Message', 'Metadata'];
    const rows = filteredEvents.map(e => [
      e.timestamp,
      e.agentName,
      e.agentRole,
      e.type,
      e.message,
      JSON.stringify(e.metadata || {}),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-activity-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export to JSON
  const exportToJSON = () => {
    const jsonContent = JSON.stringify(filteredEvents, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-activity-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy event details
  const copyEventDetails = (event: AgentEvent) => {
    const details = JSON.stringify(event, null, 2);
    navigator.clipboard.writeText(details);
  };

  return (
    <div className={`flex flex-col h-full bg-gray-50 ${className}`}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Activity Feed</h2>

            {/* Connection Status */}
            <div className="flex items-center gap-2">
              {isConnected ? (
                <span className="flex items-center text-xs text-green-600">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                  Connected
                </span>
              ) : isReconnecting ? (
                <span className="flex items-center text-xs text-yellow-600">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full mr-1 animate-pulse"></span>
                  Reconnecting...
                </span>
              ) : (
                <span className="flex items-center text-xs text-red-600">
                  <span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>
                  Disconnected
                </span>
              )}
            </div>

            {/* Event Count */}
            <span className="text-xs text-gray-500">
              {filteredEvents.length} / {events.length} events
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                showFilters
                  ? 'bg-blue-100 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Filters
            </button>

            <button
              onClick={exportToCSV}
              className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title="Export to CSV"
            >
              CSV
            </button>

            <button
              onClick={exportToJSON}
              className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title="Export to JSON"
            >
              JSON
            </button>

            <button
              onClick={clearEvents}
              className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title="Clear all events"
            >
              Clear
            </button>

            {!isConnected && (
              <button
                onClick={reconnect}
                className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Reconnect
              </button>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            {error.message}
          </div>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <EventFilters
          filters={filters}
          onChange={setFilters}
          availableAgents={availableAgents}
        />
      )}

      {/* Event List */}
      <div
        ref={scrollContainerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-2"
      >
        {visibleEvents.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-lg font-medium">No events yet</p>
              <p className="text-sm mt-1">
                {filters.eventTypes.size > 0 || filters.agents.size > 0 || filters.statuses.size > 0 || filters.searchQuery
                  ? 'Try adjusting your filters'
                  : 'Waiting for agent activity...'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {filteredEvents.length > VIRTUAL_SCROLL_LIMIT && (
              <div className="text-xs text-gray-500 text-center py-2">
                Showing last {VIRTUAL_SCROLL_LIMIT} of {filteredEvents.length} events
              </div>
            )}

            {visibleEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onClick={setSelectedEvent}
              />
            ))}
          </>
        )}

        {/* Auto-scroll indicator */}
        {!autoScroll && visibleEvents.length > 0 && (
          <div className="sticky bottom-0 text-center">
            <button
              onClick={() => {
                setAutoScroll(true);
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
                }
              }}
              className="px-3 py-1.5 text-xs text-white bg-blue-600 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
            >
              Resume auto-scroll
            </button>
          </div>
        )}
      </div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-96 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Event Details</h3>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="px-6 py-4">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                {JSON.stringify(selectedEvent, null, 2)}
              </pre>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => copyEventDetails(selectedEvent)}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Copy to Clipboard
              </button>
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
