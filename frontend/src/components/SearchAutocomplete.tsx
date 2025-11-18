import React, { useState, useEffect, useRef } from 'react';

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

interface SearchAutocompleteProps {
  query: string;
  results: SearchResult[];
  history: string[];
  isLoading: boolean;
  onResultSelect: (result: SearchResult) => void;
  onHistorySelect: (query: string) => void;
}

const SearchAutocomplete: React.FC<SearchAutocompleteProps> = ({
  query,
  results,
  history,
  isLoading,
  onResultSelect,
  onHistorySelect,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Group results by type
  const groupedResults = React.useMemo(() => {
    const groups: Record<string, SearchResult[]> = {
      tasks: [],
      projects: [],
      agents: [],
    };

    results.slice(0, 10).forEach((result) => {
      const key = `${result.type}s`;
      if (groups[key]) {
        groups[key].push(result);
      }
    });

    return groups;
  }, [results]);

  const totalResults = results.length;
  const hasResults = totalResults > 0;
  const showHistory = !query && history.length > 0;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < totalResults - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        const allResults = [
          ...groupedResults.tasks,
          ...groupedResults.projects,
          ...groupedResults.agents,
        ];
        if (allResults[selectedIndex]) {
          onResultSelect(allResults[selectedIndex]);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, totalResults, groupedResults, onResultSelect]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [results]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && containerRef.current) {
      const selectedElement = containerRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (isLoading) {
    return (
      <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg">
        <div className="p-4 text-center text-gray-500">
          <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-2"></div>
          Searching...
        </div>
      </div>
    );
  }

  if (showHistory) {
    return (
      <div
        ref={containerRef}
        className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto"
      >
        <div className="p-2">
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Recent Searches
          </div>
          {history.map((historyQuery, index) => (
            <button
              key={index}
              onClick={() => onHistorySelect(historyQuery)}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-md flex items-center gap-2"
            >
              <svg
                className="w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-sm text-gray-700">{historyQuery}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!hasResults && query) {
    return (
      <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg">
        <div className="p-4 text-center text-gray-500">
          No results found for "{query}"
        </div>
      </div>
    );
  }

  if (!hasResults) {
    return null;
  }

  let currentIndex = 0;

  return (
    <div
      ref={containerRef}
      className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto"
    >
      <div className="p-2">
        {/* Tasks Section */}
        {groupedResults.tasks.length > 0 && (
          <div className="mb-2">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Tasks
            </div>
            {groupedResults.tasks.map((result) => {
              const index = currentIndex++;
              return (
                <SearchResultItem
                  key={result.id}
                  result={result}
                  index={index}
                  isSelected={index === selectedIndex}
                  onClick={() => onResultSelect(result)}
                />
              );
            })}
          </div>
        )}

        {/* Projects Section */}
        {groupedResults.projects.length > 0 && (
          <div className="mb-2">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Projects
            </div>
            {groupedResults.projects.map((result) => {
              const index = currentIndex++;
              return (
                <SearchResultItem
                  key={result.id}
                  result={result}
                  index={index}
                  isSelected={index === selectedIndex}
                  onClick={() => onResultSelect(result)}
                />
              );
            })}
          </div>
        )}

        {/* Agents Section */}
        {groupedResults.agents.length > 0 && (
          <div>
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Agents
            </div>
            {groupedResults.agents.map((result) => {
              const index = currentIndex++;
              return (
                <SearchResultItem
                  key={result.id}
                  result={result}
                  index={index}
                  isSelected={index === selectedIndex}
                  onClick={() => onResultSelect(result)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Results count footer */}
      <div className="px-4 py-2 border-t border-gray-200 text-xs text-gray-500 bg-gray-50">
        Showing {Math.min(10, totalResults)} of {totalResults} results
      </div>
    </div>
  );
};

// Search Result Item Component
interface SearchResultItemProps {
  result: SearchResult;
  index: number;
  isSelected: boolean;
  onClick: () => void;
}

const SearchResultItem: React.FC<SearchResultItemProps> = ({
  result,
  index,
  isSelected,
  onClick,
}) => {
  return (
    <button
      data-index={index}
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
        isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-gray-100'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900">{result.title}</div>
          {result.description && (
            <div className="text-xs text-gray-500 mt-1 line-clamp-1">
              {result.description}
            </div>
          )}
          {result.metadata && (
            <div className="flex gap-2 mt-1">
              {result.metadata.skill_name && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                  {result.metadata.skill_name}
                </span>
              )}
              {result.metadata.agent_type && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                  {result.metadata.agent_type}
                </span>
              )}
              {result.metadata.status && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  {result.metadata.status}
                </span>
              )}
            </div>
          )}
        </div>
        {isSelected && (
          <kbd className="ml-2 px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 border border-gray-300 rounded">
            ↵
          </kbd>
        )}
      </div>
    </button>
  );
};

export default SearchAutocomplete;
