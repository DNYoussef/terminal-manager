/**
 * React Hook for MCP (Model Context Protocol) Integration
 * Manages MCP server connections, tools, and tool calls
 */

import { useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useMCPStore } from '../store/searchStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const useMCP = () => {
  const {
    servers,
    tools,
    toolCalls,
    selectedServer,
    selectedTool,
    loading,
    error,
    setServers,
    setTools,
    addToolCall,
    clearToolCalls,
    setLoading,
    setError,
    selectServer,
    selectTool,
    getServerTools,
    getToolByName,
  } = useMCPStore();

  // Fetch server status
  const fetchServers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/mcp/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch servers: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setServers(data.servers);
      } else {
        throw new Error('Failed to fetch server status');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch servers';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [setServers, setLoading, setError]);

  // Fetch available tools
  const fetchTools = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/mcp/tools`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tools: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setTools(data.tools);
      } else {
        throw new Error('Failed to fetch tools');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch tools';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [setTools, setLoading, setError]);

  // Start MCP server
  const startServer = useCallback(async (serverName: string) => {
    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/mcp/servers/${serverName}/start`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to start server: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        toast.success(`Started ${serverName}`);
        await fetchServers();
        await fetchTools();
      } else {
        throw new Error(data.message || 'Failed to start server');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start server';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [fetchServers, fetchTools, setLoading]);

  // Stop MCP server
  const stopServer = useCallback(async (serverName: string) => {
    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/mcp/servers/${serverName}/stop`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to stop server: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        toast.success(`Stopped ${serverName}`);
        await fetchServers();
      } else {
        throw new Error(data.message || 'Failed to stop server');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to stop server';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [fetchServers, setLoading]);

  // Call MCP tool
  const callTool = useCallback(
    async (toolName: string, args: Record<string, any>) => {
      setLoading(true);

      const callId = `${toolName}-${Date.now()}`;

      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/mcp/call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            tool_name: toolName,
            arguments: args,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to call tool: ${response.statusText}`);
        }

        const data = await response.json();

        const toolCall = {
          id: callId,
          tool_name: toolName,
          arguments: args,
          result: data.result || null,
          error: data.error || null,
          timestamp: new Date().toISOString(),
          success: data.success,
        };

        addToolCall(toolCall);

        if (data.success) {
          toast.success(`Tool ${toolName} executed successfully`);
        } else {
          toast.error(`Tool ${toolName} failed: ${data.error}`);
        }

        return toolCall;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to call tool';

        const toolCall = {
          id: callId,
          tool_name: toolName,
          arguments: args,
          result: null,
          error: errorMsg,
          timestamp: new Date().toISOString(),
          success: false,
        };

        addToolCall(toolCall);
        toast.error(errorMsg);
        return toolCall;
      } finally {
        setLoading(false);
      }
    },
    [addToolCall, setLoading]
  );

  // Auto-fetch on mount
  useEffect(() => {
    fetchServers();
    fetchTools();
  }, [fetchServers, fetchTools]);

  return {
    // State
    servers,
    tools,
    toolCalls,
    selectedServer,
    selectedTool,
    loading,
    error,

    // Actions
    fetchServers,
    fetchTools,
    startServer,
    stopServer,
    callTool,
    selectServer,
    selectTool,
    clearToolCalls,

    // Getters
    getServerTools,
    getToolByName,

    // Stats
    runningServers: Object.values(servers).filter((s) => s.running).length,
    totalTools: tools.length,
    totalCalls: toolCalls.length,
  };
};
