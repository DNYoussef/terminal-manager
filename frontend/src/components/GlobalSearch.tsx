import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchAutocomplete from './SearchAutocomplete';
import { useSearchStore } from '../store/searchStore';

interface GlobalSearchProps {
  className?: string;
}

const GlobalSearch: React.FC<GlobalSearchProps> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const {
    searchResults,
    searchHistory,
    isLoading,
    performSearch,
    addToHistory,
    clearResults
  } = useSearchStore();

  // Keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }

      // ESC to close
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
        clearResults();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [clearResults]);

  // Debounced search (300ms delay)
  const debouncedSearch = useCallback(
    debounce((searchQuery: string) => {
      if (searchQuery.trim().length >= 2) {
        performSearch(searchQuery);
      } else {
        clearResults();
      }
    }, 300),
    [performSearch, clearResults]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    debouncedSearch(value);
  };

  const handleResultSelect = (result: any) => {
    addToHistory(query);
    setIsOpen(false);
    setQuery('');
    clearResults();

    // Navigate based on result type
    switch (result.type) {
      case 'task':
        navigate(`/calendar?highlight=${result.id}`);
        break;
      case 'project':
        navigate(`/projects/${result.id}`);
        break;
      case 'agent':
        navigate(`/agents?highlight=${result.id}`);
        break;
      default:
        break;
    }
  };

  const handleHistorySelect = (historyQuery: string) => {
    setQuery(historyQuery);
    performSearch(historyQuery);
  };

  const handleFocus = () => {
    setIsOpen(true);
  };

  const handleBlur = () => {
    // Delay to allow clicking on results
    setTimeout(() => setIsOpen(false), 200);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Search tasks, projects, agents... (Ctrl+K)"
          className="w-full px-4 py-2 pl-10 pr-4 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label="Global search"
        />

        {/* Search Icon */}
        <svg
          className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          </div>
        )}

        {/* Keyboard Shortcut Hint */}
        {!isOpen && (
          <kbd className="hidden md:inline-block absolute right-3 top-1/2 transform -translate-y-1/2 px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 border border-gray-300 rounded">
            ⌘K
          </kbd>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <SearchAutocomplete
          query={query}
          results={searchResults}
          history={searchHistory}
          isLoading={isLoading}
          onResultSelect={handleResultSelect}
          onHistorySelect={handleHistorySelect}
        />
      )}
    </div>
  );
};

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

export default GlobalSearch;
