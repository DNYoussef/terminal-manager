import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Fuse from 'fuse.js';
import { TerminalsSlice, createTerminalsSlice } from './terminalsSlice';
import { SessionsSlice, createSessionsSlice } from './sessionsSlice';
import { MCPSlice, createMCPSlice } from './mcpSlice';

interface SearchResult {
  id: string;
  type: 'task' | 'project' | 'agent';
  title: string;
  description?: string;
  metadata?: {
    skill_name?: string;
    agent_type?: string;
    capabilities?: string[];
    status?: string;
  };
  score: number;
}

interface SearchState {
  // State
  query: string;
  searchResults: SearchResult[];
  searchHistory: string[];
  isLoading: boolean;
  error: string | null;

  // Actions
  performSearch: (query: string) => Promise<void>;
  clearResults: () => void;
  addToHistory: (query: string) => void;
  clearHistory: () => void;
  setQuery: (query: string) => void;
}

// Fuse.js configuration for fuzzy matching
const fuseOptions = {
  threshold: 0.4, // Fuzzy matching tolerance (0.0 = exact, 1.0 = match anything)
  keys: [
    { name: 'title', weight: 0.5 },
    { name: 'description', weight: 0.3 },
    { name: 'metadata.skill_name', weight: 0.2 },
    { name: 'metadata.agent_type', weight: 0.2 },
  ],
  includeScore: true,
  minMatchCharLength: 2,
};

export const useSearchStore = create<SearchState>()(
  persist(
    (set, get) => ({
      // Initial state
      query: '',
      searchResults: [],
      searchHistory: [],
      isLoading: false,
      error: null,

      // Perform search with backend API + Fuse.js fuzzy matching
      performSearch: async (query: string) => {
        if (!query || query.trim().length < 2) {
          set({ searchResults: [], query: '' });
          return;
        }

        set({ isLoading: true, error: null, query });

        try {
          // Call backend search API
          const response = await fetch(
            `/api/v1/search?q=${encodeURIComponent(query)}&limit=10`
          );

          if (!response.ok) {
            throw new Error('Search failed');
          }

          const data = await response.json();
          let results: SearchResult[] = data.results || [];

          // Apply client-side Fuse.js fuzzy matching for better results
          if (results.length > 0) {
            const fuse = new Fuse(results, fuseOptions);
            const fuseResults = fuse.search(query);

            // Combine backend scores with Fuse.js scores
            results = fuseResults.map((result) => ({
              ...result.item,
              score: result.item.score * 0.5 + (1 - (result.score || 0)) * 0.5,
            }));

            // Sort by combined score
            results.sort((a, b) => b.score - a.score);
          }

          set({ searchResults: results, isLoading: false });
        } catch (error) {
          console.error('Search error:', error);
          set({
            error: 'Failed to perform search',
            searchResults: [],
            isLoading: false,
          });
        }
      },

      // Clear search results
      clearResults: () => {
        set({ searchResults: [], query: '', error: null });
      },

      // Add query to search history (max 10 items)
      addToHistory: (query: string) => {
        if (!query || query.trim().length < 2) return;

        const { searchHistory } = get();
        const trimmedQuery = query.trim();

        // Remove duplicates and add to front
        const updatedHistory = [
          trimmedQuery,
          ...searchHistory.filter((q) => q !== trimmedQuery),
        ].slice(0, 10); // Keep only last 10

        set({ searchHistory: updatedHistory });
      },

      // Clear search history
      clearHistory: () => {
        set({ searchHistory: [] });
      },

      // Set current query
      setQuery: (query: string) => {
        set({ query });
      },
    }),
    {
      name: 'search-store', // localStorage key
      partialize: (state) => ({
        // Only persist search history, not results
        searchHistory: state.searchHistory,
      }),
    }
  )
);

// Terminals Store (separate, not persisted)
export const useTerminalsStore = create<TerminalsSlice>()((set, get, api) => createTerminalsSlice(set, get, api));

// Sessions Store (separate, not persisted)
export const useSessionsStore = create<SessionsSlice>()((set, get, api) => createSessionsSlice(set, get, api));

// MCP Store (separate, not persisted)
export const useMCPStore = create<MCPSlice>()((set, get, api) => createMCPSlice(set, get, api));

// Combined Store with all slices
type CombinedStore = SearchState & TerminalsSlice & SessionsSlice;

export const useCombinedStore = create<CombinedStore>()(
  persist(
    (set, get, api) => ({
      // Combine all slices
      ...createTerminalsSlice(set, get, api),
      ...createSessionsSlice(set, get, api),

      // SearchState implementation
      query: '',
      searchResults: [],
      searchHistory: [],
      isLoading: false,
      error: null,

      performSearch: async (query: string) => {
        if (!query || query.trim().length < 2) {
          set({ searchResults: [], query: '' });
          return;
        }

        set({ isLoading: true, error: null, query });

        try {
          const response = await fetch(
            `/api/v1/search?q=${encodeURIComponent(query)}&limit=10`
          );

          if (!response.ok) {
            throw new Error('Search failed');
          }

          const data = await response.json();
          let results: SearchResult[] = data.results || [];

          if (results.length > 0) {
            const fuse = new Fuse(results, fuseOptions);
            const fuseResults = fuse.search(query);

            results = fuseResults.map((result) => ({
              ...result.item,
              score: result.item.score * 0.5 + (1 - (result.score || 0)) * 0.5,
            }));

            results.sort((a, b) => b.score - a.score);
          }

          set({ searchResults: results, isLoading: false });
        } catch (error) {
          console.error('Search error:', error);
          set({
            error: 'Failed to perform search',
            searchResults: [],
            isLoading: false,
          });
        }
      },

      clearResults: () => {
        set({ searchResults: [], query: '', error: null });
      },

      addToHistory: (query: string) => {
        if (!query || query.trim().length < 2) return;

        const { searchHistory } = get();
        const trimmedQuery = query.trim();

        const updatedHistory = [
          trimmedQuery,
          ...searchHistory.filter((q) => q !== trimmedQuery),
        ].slice(0, 10);

        set({ searchHistory: updatedHistory });
      },

      clearHistory: () => {
        set({ searchHistory: [] });
      },

      setQuery: (query: string) => {
        set({ query });
      },
    }),
    {
      name: 'search-store',
      partialize: (state) => ({
        searchHistory: state.searchHistory,
      }),
    }
  )
);

// Export types
export type { SearchResult, SearchState };
