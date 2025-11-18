/**
 * React Hook for Claude Code Session Discovery
 * Fetches and manages discovered sessions from backend API
 */

import { useEffect, useCallback } from 'react';
import { useSessionsStore } from '../store/searchStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface DiscoverSessionsResponse {
  success: boolean;
  count: number;
  sessions: any[];
}

interface UseSessionsOptions {
  autoDiscover?: boolean;
  searchPaths?: string[];
}

export const useSessions = (options: UseSessionsOptions = {}) => {
  const {
    autoDiscover = true,
    searchPaths,
  } = options;

  const {
    sessions,
    setSessions,
    setLoading,
    setError,
    selectedSession,
    selectSession,
    searchQuery,
    setSearchQuery,
    filterByRecent,
    setFilterByRecent,
    getFilteredSessions,
  } = useSessionsStore();

  // Discover sessions from backend
  const discoverSessions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const url = new URL(`${API_BASE_URL}/api/v1/sessions/discover`);

      if (searchPaths && searchPaths.length > 0) {
        searchPaths.forEach(path => {
          url.searchParams.append('search_paths', path);
        });
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to discover sessions: ${response.statusText}`);
      }

      const data: DiscoverSessionsResponse = await response.json();

      if (data.success) {
        setSessions(data.sessions);
        console.log(`Discovered ${data.count} Claude Code sessions`);
      } else {
        throw new Error('Session discovery failed');
      }

    } catch (error) {
      console.error('Session discovery error:', error);
      setError(error instanceof Error ? error.message : 'Failed to discover sessions');
    } finally {
      setLoading(false);
    }
  }, [searchPaths, setSessions, setLoading, setError]);

  // Refresh sessions (manual trigger)
  const refreshSessions = useCallback(() => {
    return discoverSessions();
  }, [discoverSessions]);

  // Get session by project path
  const getSession = useCallback(async (projectPath: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/sessions/${encodeURIComponent(projectPath)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get session: ${response.statusText}`);
      }

      const data = await response.json();
      return data.session;

    } catch (error) {
      console.error('Get session error:', error);
      setError(error instanceof Error ? error.message : 'Failed to get session');
      return null;
    }
  }, [setError]);

  // Auto-discover on mount
  useEffect(() => {
    if (autoDiscover) {
      discoverSessions();
    }
  }, [autoDiscover, discoverSessions]);

  return {
    // State
    sessions,
    filteredSessions: getFilteredSessions(),
    selectedSession,
    loading: useSessionsStore.getState().loading,
    error: useSessionsStore.getState().error,
    searchQuery,
    filterByRecent,

    // Actions
    discoverSessions,
    refreshSessions,
    getSession,
    selectSession,
    setSearchQuery,
    setFilterByRecent,

    // Stats
    totalSessions: sessions.length,
    filteredCount: getFilteredSessions().length,
  };
};
