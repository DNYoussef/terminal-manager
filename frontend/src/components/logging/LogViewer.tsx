/**
 * Log Viewer Component
 * Displays structured logs with filtering, search, and export capabilities
 * Integrates with backend log query API
 */

import React, { useState, useEffect } from 'react';

interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  message: string;
  agent?: {
    agent_id: string;
    name: string;
    role: string;
    category: string;
  };
  execution?: {
    correlation_id: string;
    session_id?: string;
    task_id?: string;
    operation?: string;
    target?: string;
  };
  metrics?: {
    execution_time_ms?: number;
    tokens_used?: number;
    cost_usd?: number;
    memory_mb?: number;
  };
  rbac?: {
    decision: string;
    permission_checked: string;
    reason?: string;
  };
  error?: {
    name: string;
    message: string;
    code?: string;
    stack?: string;
  };
}

interface LogViewerProps {
  apiBaseUrl?: string;
}

export const LogViewer: React.FC<LogViewerProps> = ({
  apiBaseUrl = 'http://localhost:8000/api/v1'
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [agentFilter, setAgentFilter] = useState<string>('');
  const [correlationFilter, setCorrelationFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination
  const [limit, setLimit] = useState(100);
  const [offset, setOffset] = useState(0);

  // Selected log for details
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  /**
   * Fetch logs from API
   */
  const fetchLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      });

      if (levelFilter) params.append('level', levelFilter);
      if (agentFilter) params.append('agent_name', agentFilter);
      if (correlationFilter) params.append('correlation_id', correlationFilter);

      const response = await fetch(`${apiBaseUrl}/logs/query?${params}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.statusText}`);
      }

      const data = await response.json();
      setLogs(data.logs || []);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
      console.error('Failed to fetch logs:', err);

    } finally {
      setLoading(false);
    }
  };

  /**
   * Export logs
   */
  const exportLogs = async (format: 'json' | 'csv') => {
    try {
      const params = new URLSearchParams({
        filename: 'hooks-' + new Date().toISOString().split('T')[0] + '.log',
        format: format
      });

      if (levelFilter) params.append('level', levelFilter);
      if (agentFilter) params.append('agent_name', agentFilter);

      const response = await fetch(`${apiBaseUrl}/logs/export?${params}`);

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs-export.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export logs');
    }
  };

  /**
   * Copy log entry to clipboard
   */
  const copyToClipboard = (log: LogEntry) => {
    const formatted = JSON.stringify(log, null, 2);
    navigator.clipboard.writeText(formatted)
      .then(() => alert('Log entry copied to clipboard'))
      .catch(err => console.error('Failed to copy:', err));
  };

  /**
   * Get level badge color
   */
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'DEBUG': return 'bg-gray-500';
      case 'INFO': return 'bg-blue-500';
      case 'WARN': return 'bg-yellow-500';
      case 'ERROR': return 'bg-red-500';
      case 'FATAL': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  /**
   * Filter logs by search query
   */
  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.message.toLowerCase().includes(query) ||
      log.agent?.name.toLowerCase().includes(query) ||
      log.execution?.operation?.toLowerCase().includes(query)
    );
  });

  // Fetch logs on mount and when filters change
  useEffect(() => {
    fetchLogs();
  }, [levelFilter, agentFilter, correlationFilter, limit, offset]);

  return (
    <div className="log-viewer p-4 bg-white rounded-lg shadow">
      <div className="header mb-4">
        <h2 className="text-2xl font-bold mb-2">System Logs</h2>

        {/* Filters */}
        <div className="filters grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Level</label>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="">All Levels</option>
              <option value="DEBUG">Debug</option>
              <option value="INFO">Info</option>
              <option value="WARN">Warning</option>
              <option value="ERROR">Error</option>
              <option value="FATAL">Fatal</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Agent</label>
            <input
              type="text"
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              placeholder="Filter by agent name"
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Correlation ID</label>
            <input
              type="text"
              value={correlationFilter}
              onChange={(e) => setCorrelationFilter(e.target.value)}
              placeholder="Filter by correlation ID"
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs..."
              className="w-full px-3 py-2 border rounded"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="actions flex gap-2 mb-4">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>

          <button
            onClick={() => exportLogs('json')}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Export JSON
          </button>

          <button
            onClick={() => exportLogs('csv')}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Export CSV
          </button>
        </div>

        {error && (
          <div className="error bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
      </div>

      {/* Log entries */}
      <div className="log-entries space-y-2 max-h-[600px] overflow-y-auto">
        {filteredLogs.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No logs found
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div
              key={index}
              onClick={() => setSelectedLog(log)}
              className={`log-entry p-3 border rounded cursor-pointer hover:bg-gray-50 ${
                log.level === 'ERROR' || log.level === 'FATAL' ? 'border-red-300 bg-red-50' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-1 text-xs font-bold text-white rounded ${getLevelColor(log.level)}`}>
                      {log.level}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                    {log.agent && (
                      <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                        {log.agent.name}
                      </span>
                    )}
                  </div>

                  <div className="font-medium">{log.message}</div>

                  {log.execution?.operation && (
                    <div className="text-sm text-gray-600 mt-1">
                      Operation: {log.execution.operation}
                      {log.execution.target && ` -> ${log.execution.target}`}
                    </div>
                  )}

                  {log.error && (
                    <div className="text-sm text-red-600 mt-1">
                      Error: {log.error.message}
                    </div>
                  )}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(log);
                  }}
                  className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded"
                >
                  Copy
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      <div className="pagination flex items-center justify-between mt-4 pt-4 border-t">
        <div className="text-sm text-gray-600">
          Showing {offset + 1} - {Math.min(offset + limit, offset + filteredLogs.length)} of {filteredLogs.length}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            Previous
          </button>

          <button
            onClick={() => setOffset(offset + limit)}
            disabled={filteredLogs.length < limit}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Log details modal */}
      {selectedLog && (
        <div
          className="modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="modal-content bg-white rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold">Log Entry Details</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                &times;
              </button>
            </div>

            <pre className="bg-gray-100 p-4 rounded overflow-x-auto text-sm">
              {JSON.stringify(selectedLog, null, 2)}
            </pre>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => copyToClipboard(selectedLog)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Copy to Clipboard
              </button>

              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
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

export default LogViewer;
