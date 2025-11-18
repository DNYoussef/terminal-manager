/**
 * MCP Status Indicator Component
 * Displays connection status for all MCP servers with real-time updates
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api/v1';

interface MCPHealth {
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  last_check: string;
  last_success?: string;
  error_count: number;
  last_error?: string;
  response_time_ms?: number;
  running: boolean;
  pid?: number;
  tools_count: number;
}

interface MCPHealthResponse {
  success: boolean;
  all_connected: boolean;
  mcps: Record<string, MCPHealth>;
  total: number;
  connected: number;
  disconnected: number;
  error: number;
  timestamp: string;
}

const MCPStatusIndicator: React.FC = () => {
  const [healthData, setHealthData] = useState<MCPHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch MCP health data
  const fetchHealth = useCallback(async () => {
    try {
      const response = await axios.get<MCPHealthResponse>(`${API_BASE_URL}/health/mcps`);
      setHealthData(response.data);
      setError(null);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching MCP health:', err);
      setError('Failed to fetch MCP health status');
      setLoading(false);
    }
  }, []);

  // Reconnect to specific MCP
  const reconnectMCP = async (mcpName: string) => {
    setReconnecting(mcpName);
    try {
      await axios.post(`${API_BASE_URL}/health/mcps/${mcpName}/reconnect`, {
        force: true
      });
      // Refresh health data
      await fetchHealth();
    } catch (err) {
      console.error(`Error reconnecting to ${mcpName}:`, err);
      setError(`Failed to reconnect to ${mcpName}`);
    } finally {
      setReconnecting(null);
    }
  };

  // Reconnect all MCPs
  const reconnectAll = async () => {
    setReconnecting('all');
    try {
      await axios.post(`${API_BASE_URL}/health/mcps/reconnect-all`);
      await fetchHealth();
    } catch (err) {
      console.error('Error reconnecting all MCPs:', err);
      setError('Failed to reconnect all MCPs');
    } finally {
      setReconnecting(null);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    fetchHealth();

    if (autoRefresh) {
      const interval = setInterval(fetchHealth, 30000); // 30 seconds
      return () => clearInterval(interval);
    }
  }, [fetchHealth, autoRefresh]);

  // Status color helper
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'connected':
        return 'text-green-500';
      case 'disconnected':
        return 'text-yellow-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  // Status icon helper
  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'connected':
        return '●';
      case 'disconnected':
        return '○';
      case 'error':
        return '✕';
      default:
        return '?';
    }
  };

  if (loading && !healthData) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-sm text-gray-600">Loading MCP status...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">MCP Status</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1 text-sm rounded ${
              autoRefresh
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            {autoRefresh ? 'Auto-Refresh: On' : 'Auto-Refresh: Off'}
          </button>
          <button
            onClick={fetchHealth}
            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            disabled={loading}
          >
            Refresh
          </button>
          <button
            onClick={reconnectAll}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            disabled={reconnecting === 'all'}
          >
            {reconnecting === 'all' ? 'Reconnecting...' : 'Reconnect All'}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
          <button
            onClick={() => setError(null)}
            className="float-right text-red-700 hover:text-red-900"
          >
            ×
          </button>
        </div>
      )}

      {/* Overall Status */}
      {healthData && (
        <div className="mb-4 p-3 bg-gray-50 rounded">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium">Overall: </span>
              <span className={healthData.all_connected ? 'text-green-600' : 'text-yellow-600'}>
                {healthData.all_connected ? 'All Connected' : 'Degraded'}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              {healthData.connected}/{healthData.total} Connected
              {healthData.error > 0 && `, ${healthData.error} Errors`}
            </div>
          </div>
        </div>
      )}

      {/* MCP List */}
      {healthData && (
        <div className="space-y-2">
          {Object.entries(healthData.mcps).map(([name, mcp]) => (
            <div
              key={name}
              className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xl ${getStatusColor(mcp.status)}`}>
                    {getStatusIcon(mcp.status)}
                  </span>
                  <span className="font-medium">{mcp.name}</span>
                  {mcp.running && mcp.pid && (
                    <span className="text-xs text-gray-500">(PID: {mcp.pid})</span>
                  )}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {mcp.tools_count > 0 && <span>{mcp.tools_count} tools available</span>}
                  {mcp.response_time_ms !== undefined && (
                    <span className="ml-2">
                      Response: {mcp.response_time_ms.toFixed(0)}ms
                    </span>
                  )}
                  {mcp.error_count > 0 && (
                    <span className="ml-2 text-red-600">
                      {mcp.error_count} errors
                    </span>
                  )}
                </div>
                {mcp.last_error && (
                  <div className="text-xs text-red-600 mt-1">
                    Error: {mcp.last_error}
                  </div>
                )}
              </div>

              {/* Reconnect Button */}
              {mcp.status !== 'connected' && (
                <button
                  onClick={() => reconnectMCP(name)}
                  disabled={reconnecting === name}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                >
                  {reconnecting === name ? 'Reconnecting...' : 'Reconnect'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      {healthData && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            Last updated: {new Date(healthData.timestamp).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
};

export default MCPStatusIndicator;
