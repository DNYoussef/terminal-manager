import React, { useState, useEffect, useCallback } from 'react';

/**
 * CalendarFilters Component
 *
 * Filter bar for calendar with project, skill, and status filters.
 * Updates calendar to show only filtered tasks.
 * Saves filter preferences to localStorage for persistence.
 *
 * WCAG 2.1 AA Compliant:
 * - Keyboard navigation
 * - ARIA labels and live regions
 * - Clear filter indicators
 * - Focus management
 */

interface CalendarFiltersProps {
  projects: Array<{ id: string; name: string; color: string }>;
  skills: Array<{ id: string; name: string }>;
  statuses: Array<{ value: string; label: string }>;
  onFilterChange: (filters: FilterState) => void;
  storageKey?: string;
}

export interface FilterState {
  projectIds: string[];
  skillIds: string[];
  statuses: string[];
  searchQuery: string;
}

const DEFAULT_FILTERS: FilterState = {
  projectIds: [],
  skillIds: [],
  statuses: [],
  searchQuery: '',
};

export const CalendarFilters: React.FC<CalendarFiltersProps> = ({
  projects,
  skills,
  statuses,
  onFilterChange,
  storageKey = 'calendar-filters',
}) => {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasActiveFilters, setHasActiveFilters] = useState(false);

  // Load filters from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as FilterState;
        setFilters(parsed);
        onFilterChange(parsed);
        updateActiveFiltersState(parsed);
      }
    } catch (error) {
      console.error('Failed to load filter preferences:', error);
    }
  }, [storageKey, onFilterChange]);

  // Save filters to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(filters));
      updateActiveFiltersState(filters);
    } catch (error) {
      console.error('Failed to save filter preferences:', error);
    }
  }, [filters, storageKey]);

  // Update active filters state
  const updateActiveFiltersState = useCallback((filterState: FilterState) => {
    const hasFilters =
      filterState.projectIds.length > 0 ||
      filterState.skillIds.length > 0 ||
      filterState.statuses.length > 0 ||
      filterState.searchQuery.length > 0;
    setHasActiveFilters(hasFilters);
  }, []);

  // Handle project filter toggle
  const toggleProject = useCallback((projectId: string) => {
    setFilters((prev) => {
      const newProjectIds = prev.projectIds.includes(projectId)
        ? prev.projectIds.filter((id) => id !== projectId)
        : [...prev.projectIds, projectId];

      const newFilters = { ...prev, projectIds: newProjectIds };
      onFilterChange(newFilters);
      return newFilters;
    });
  }, [onFilterChange]);

  // Handle skill filter toggle
  const toggleSkill = useCallback((skillId: string) => {
    setFilters((prev) => {
      const newSkillIds = prev.skillIds.includes(skillId)
        ? prev.skillIds.filter((id) => id !== skillId)
        : [...prev.skillIds, skillId];

      const newFilters = { ...prev, skillIds: newSkillIds };
      onFilterChange(newFilters);
      return newFilters;
    });
  }, [onFilterChange]);

  // Handle status filter toggle
  const toggleStatus = useCallback((status: string) => {
    setFilters((prev) => {
      const newStatuses = prev.statuses.includes(status)
        ? prev.statuses.filter((s) => s !== status)
        : [...prev.statuses, status];

      const newFilters = { ...prev, statuses: newStatuses };
      onFilterChange(newFilters);
      return newFilters;
    });
  }, [onFilterChange]);

  // Handle search query change
  const handleSearchChange = useCallback((query: string) => {
    setFilters((prev) => {
      const newFilters = { ...prev, searchQuery: query };
      onFilterChange(newFilters);
      return newFilters;
    });
  }, [onFilterChange]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    onFilterChange(DEFAULT_FILTERS);
  }, [onFilterChange]);

  // Get active filter count
  const activeFilterCount =
    filters.projectIds.length +
    filters.skillIds.length +
    filters.statuses.length +
    (filters.searchQuery ? 1 : 0);

  return (
    <div className="calendar-filters bg-white border-b border-gray-200" role="region" aria-labelledby="filters-heading">
      {/* Filter Bar Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <h2 id="filters-heading" className="text-lg font-semibold">
            Filters
          </h2>
          {hasActiveFilters && (
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {activeFilterCount} active
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-sm text-blue-600 hover:underline focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
            >
              Clear All
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded focus:ring-2 focus:ring-blue-500"
            aria-expanded={isExpanded}
            aria-controls="filter-content"
          >
            {isExpanded ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>
      </div>

      {/* Search Bar (Always Visible) */}
      <div className="px-4 pb-4">
        <label htmlFor="calendar-search" className="sr-only">
          Search tasks
        </label>
        <input
          id="calendar-search"
          type="search"
          value={filters.searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search tasks..."
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label="Search tasks by name or description"
        />
      </div>

      {/* Filter Content (Expandable) */}
      {isExpanded && (
        <div id="filter-content" className="px-4 pb-4 space-y-6">
          {/* Project Filters */}
          <fieldset>
            <legend className="text-sm font-medium mb-3">Projects</legend>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by project">
              {projects.map((project) => {
                const isSelected = filters.projectIds.includes(project.id);
                return (
                  <button
                    key={project.id}
                    onClick={() => toggleProject(project.id)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                    aria-pressed={isSelected}
                  >
                    <span
                      className="inline-block w-3 h-3 rounded-full"
                      style={{ backgroundColor: project.color }}
                      aria-hidden="true"
                    />
                    {project.name}
                    {isSelected && <span aria-hidden="true">✓</span>}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Skill Filters */}
          <fieldset>
            <legend className="text-sm font-medium mb-3">Skills</legend>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by skill">
              {skills.map((skill) => {
                const isSelected = filters.skillIds.includes(skill.id);
                return (
                  <button
                    key={skill.id}
                    onClick={() => toggleSkill(skill.id)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors ${
                      isSelected
                        ? 'border-purple-600 bg-purple-50 text-purple-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                    aria-pressed={isSelected}
                  >
                    🎯 {skill.name}
                    {isSelected && <span aria-hidden="true">✓</span>}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Status Filters */}
          <fieldset>
            <legend className="text-sm font-medium mb-3">Status</legend>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
              {statuses.map((status) => {
                const isSelected = filters.statuses.includes(status.value);
                return (
                  <button
                    key={status.value}
                    onClick={() => toggleStatus(status.value)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors ${
                      isSelected
                        ? 'border-green-600 bg-green-50 text-green-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                    aria-pressed={isSelected}
                  >
                    {status.label}
                    {isSelected && <span aria-hidden="true">✓</span>}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
      )}

      {/* Active Filters Summary */}
      {hasActiveFilters && !isExpanded && (
        <div className="px-4 pb-4" aria-live="polite">
          <div className="flex flex-wrap gap-2">
            {filters.projectIds.map((id) => {
              const project = projects.find((p) => p.id === id);
              return project ? (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs"
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  {project.name}
                  <button
                    onClick={() => toggleProject(id)}
                    className="ml-1 hover:text-blue-900"
                    aria-label={`Remove ${project.name} filter`}
                  >
                    ✕
                  </button>
                </span>
              ) : null;
            })}
            {filters.skillIds.map((id) => {
              const skill = skills.find((s) => s.id === id);
              return skill ? (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-1 rounded text-xs"
                >
                  {skill.name}
                  <button
                    onClick={() => toggleSkill(id)}
                    className="ml-1 hover:text-purple-900"
                    aria-label={`Remove ${skill.name} filter`}
                  >
                    ✕
                  </button>
                </span>
              ) : null;
            })}
            {filters.statuses.map((statusValue) => {
              const status = statuses.find((s) => s.value === statusValue);
              return status ? (
                <span
                  key={statusValue}
                  className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded text-xs"
                >
                  {status.label}
                  <button
                    onClick={() => toggleStatus(statusValue)}
                    className="ml-1 hover:text-green-900"
                    aria-label={`Remove ${status.label} filter`}
                  >
                    ✕
                  </button>
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarFilters;
