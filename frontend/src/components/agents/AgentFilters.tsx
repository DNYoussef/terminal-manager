/**
 * AgentFilters Component
 * Provides filtering controls for the Agent Registry
 */

import React from 'react';
import { AgentRole, AgentCategory, AgentStatus, AgentFilters as Filters } from '../../store/agentsSlice';
import { Input } from '../design-system';

interface AgentFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Partial<Filters>) => void;
  onReset: () => void;
  totalAgents: number;
  filteredCount: number;
}

const roleOptions: { value: AgentRole | 'all'; label: string }[] = [
  { value: 'all', label: 'All Roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'developer', label: 'Developer' },
  { value: 'researcher', label: 'Researcher' },
  { value: 'tester', label: 'Tester' },
  { value: 'reviewer', label: 'Reviewer' },
  { value: 'architect', label: 'Architect' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'coordinator', label: 'Coordinator' },
  { value: 'specialist', label: 'Specialist' },
  { value: 'other', label: 'Other' },
];

const categoryOptions: { value: AgentCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All Categories' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'foundry', label: 'Foundry' },
  { value: 'security', label: 'Security' },
  { value: 'quality', label: 'Quality' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'research', label: 'Research' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'platform', label: 'Platform' },
  { value: 'other', label: 'Other' },
];

const statusOptions: { value: AgentStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'idle', label: 'Idle' },
  { value: 'paused', label: 'Paused' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'offline', label: 'Offline' },
];

export const AgentFilters: React.FC<AgentFiltersProps> = ({
  filters,
  onFiltersChange,
  onReset,
  totalAgents,
  filteredCount,
}) => {
  const hasActiveFilters = filters.role !== 'all' ||
    filters.category !== 'all' ||
    filters.status !== 'all' ||
    filters.specialistsOnly ||
    filters.searchQuery !== '';

  return (
    <div className="agent-filters">
      {/* Search Bar */}
      <div className="filter-section search-section">
        <Input
          type="text"
          placeholder="Search by name, capability, or tag..."
          value={filters.searchQuery}
          onChange={(e) => onFiltersChange({ searchQuery: e.target.value })}
          className="search-input"
        />
      </div>

      {/* Filter Dropdowns */}
      <div className="filter-section dropdowns">
        {/* Role Filter */}
        <div className="filter-group">
          <label htmlFor="role-filter">Role</label>
          <select
            id="role-filter"
            value={filters.role}
            onChange={(e) => onFiltersChange({ role: e.target.value as AgentRole | 'all' })}
            className="filter-select"
          >
            {roleOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Category Filter */}
        <div className="filter-group">
          <label htmlFor="category-filter">Category</label>
          <select
            id="category-filter"
            value={filters.category}
            onChange={(e) => onFiltersChange({ category: e.target.value as AgentCategory | 'all' })}
            className="filter-select"
          >
            {categoryOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="filter-group">
          <label htmlFor="status-filter">Status</label>
          <select
            id="status-filter"
            value={filters.status}
            onChange={(e) => onFiltersChange({ status: e.target.value as AgentStatus | 'all' })}
            className="filter-select"
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Specialists Toggle */}
        <div className="filter-group toggle-group">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={filters.specialistsOnly}
              onChange={(e) => onFiltersChange({ specialistsOnly: e.target.checked })}
              className="toggle-checkbox"
            />
            <span className="toggle-text">Specialists Only</span>
          </label>
        </div>
      </div>

      {/* Results Count & Reset */}
      <div className="filter-footer">
        <div className="results-count">
          Showing {filteredCount} of {totalAgents} agents
          {hasActiveFilters && (
            <button onClick={onReset} className="reset-button">
              Clear Filters
            </button>
          )}
        </div>
      </div>

      <style>{`
        .agent-filters {
          background: var(--surface-secondary, #f8f9fa);
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .filter-section {
          margin-bottom: 1rem;
        }

        .search-section .search-input {
          width: 100%;
          max-width: 500px;
        }

        .dropdowns {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          align-items: flex-end;
        }

        .filter-group {
          flex: 1;
          min-width: 150px;
          max-width: 200px;
        }

        .filter-group label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-secondary, #6c757d);
          margin-bottom: 0.5rem;
        }

        .filter-select {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid var(--border-color, #dee2e6);
          border-radius: 4px;
          background: white;
          font-size: 0.875rem;
          cursor: pointer;
        }

        .filter-select:focus {
          outline: none;
          border-color: var(--primary-color, #0066cc);
          box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
        }

        .toggle-group {
          display: flex;
          align-items: center;
        }

        .toggle-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          user-select: none;
        }

        .toggle-checkbox {
          width: 1.25rem;
          height: 1.25rem;
          cursor: pointer;
        }

        .toggle-text {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-primary, #212529);
        }

        .filter-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 1rem;
          border-top: 1px solid var(--border-color, #dee2e6);
        }

        .results-count {
          display: flex;
          align-items: center;
          gap: 1rem;
          font-size: 0.875rem;
          color: var(--text-secondary, #6c757d);
        }

        .reset-button {
          padding: 0.375rem 0.75rem;
          border: 1px solid var(--border-color, #dee2e6);
          border-radius: 4px;
          background: white;
          color: var(--text-primary, #212529);
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .reset-button:hover {
          background: var(--surface-secondary, #f8f9fa);
          border-color: var(--primary-color, #0066cc);
          color: var(--primary-color, #0066cc);
        }

        /* Responsive Design */
        @media (max-width: 768px) {
          .agent-filters {
            padding: 1rem;
          }

          .dropdowns {
            flex-direction: column;
          }

          .filter-group {
            max-width: 100%;
          }

          .filter-footer {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.75rem;
          }
        }
      `}</style>
    </div>
  );
};
