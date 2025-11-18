/**
 * AgentTable Component
 * Displays agents in a sortable, paginated table with status indicators
 */

import React from 'react';
import { AgentIdentity, SortField, SortDirection } from '../../store/agentsSlice';

interface AgentTableProps {
  agents: AgentIdentity[];
  onAgentClick: (agentId: string) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const getStatusIcon = (status: string): { icon: string; color: string } => {
  switch (status) {
    case 'active':
      return { icon: '\u{1F7E2}', color: '#28a745' }; // Green circle
    case 'idle':
      return { icon: '\u{1F7E1}', color: '#ffc107' }; // Yellow circle
    case 'paused':
      return { icon: '\u{1F535}', color: '#007bff' }; // Blue circle
    case 'blocked':
      return { icon: '\u{1F534}', color: '#dc3545' }; // Red circle
    case 'offline':
      return { icon: '\u{26AB}', color: '#6c757d' }; // Black circle
    default:
      return { icon: '\u{26AA}', color: '#adb5bd' }; // Gray circle
  }
};

const getQualityGrade = (score: number): { grade: string; color: string } => {
  if (score >= 90) return { grade: 'A', color: '#28a745' };
  if (score >= 80) return { grade: 'B', color: '#5cb85c' };
  if (score >= 70) return { grade: 'C', color: '#ffc107' };
  if (score >= 60) return { grade: 'D', color: '#fd7e14' };
  return { grade: 'F', color: '#dc3545' };
};

const formatBudgetPercent = (used: number, max: number): number => {
  if (max === 0) return 0;
  return Math.round((used / max) * 100);
};

const getBudgetColor = (percent: number): string => {
  if (percent >= 90) return '#dc3545'; // Red
  if (percent >= 75) return '#fd7e14'; // Orange
  if (percent >= 50) return '#ffc107'; // Yellow
  return '#28a745'; // Green
};

export const AgentTable: React.FC<AgentTableProps> = ({
  agents,
  onAgentClick,
  sortField,
  sortDirection,
  onSort,
  currentPage,
  totalPages,
  onPageChange,
}) => {
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <span className="sort-icon inactive">\u{2195}</span>; // Up-down arrow
    }
    return (
      <span className="sort-icon active">
        {sortDirection === 'asc' ? '\u{2191}' : '\u{2193}'}
      </span>
    );
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }

    return (
      <div className="pagination">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="page-btn prev"
        >
          &lt;
        </button>

        {pages.map((page, idx) => (
          <React.Fragment key={idx}>
            {page === '...' ? (
              <span className="page-ellipsis">...</span>
            ) : (
              <button
                onClick={() => onPageChange(page as number)}
                className={`page-btn ${currentPage === page ? 'active' : ''}`}
              >
                {page}
              </button>
            )}
          </React.Fragment>
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="page-btn next"
        >
          &gt;
        </button>
      </div>
    );
  };

  return (
    <div className="agent-table-container">
      {/* Desktop/Tablet Table View */}
      <div className="table-wrapper">
        <table className="agent-table">
          <thead>
            <tr>
              <th onClick={() => onSort('status')} className="sortable">
                Status {renderSortIcon('status')}
              </th>
              <th onClick={() => onSort('name')} className="sortable">
                Name {renderSortIcon('name')}
              </th>
              <th onClick={() => onSort('role')} className="sortable">
                Role {renderSortIcon('role')}
              </th>
              <th onClick={() => onSort('category')} className="sortable">
                Category {renderSortIcon('category')}
              </th>
              <th onClick={() => onSort('budgetUsed')} className="sortable">
                Budget {renderSortIcon('budgetUsed')}
              </th>
              <th onClick={() => onSort('qualityScore')} className="sortable">
                Quality {renderSortIcon('qualityScore')}
              </th>
              <th onClick={() => onSort('tasksCompleted')} className="sortable">
                Tasks {renderSortIcon('tasksCompleted')}
              </th>
            </tr>
          </thead>
          <tbody>
            {agents.length === 0 ? (
              <tr>
                <td colSpan={7} className="no-results">
                  No agents found matching the current filters.
                </td>
              </tr>
            ) : (
              agents.map(agent => {
                const status = getStatusIcon(agent.status || 'offline');
                const budgetPercent = formatBudgetPercent(
                  agent.budget.cost_used_today,
                  agent.budget.max_cost_per_day
                );
                const budgetColor = getBudgetColor(budgetPercent);
                const quality = getQualityGrade(agent.performance.quality_score);

                return (
                  <tr
                    key={agent.agent_id}
                    onClick={() => onAgentClick(agent.agent_id)}
                    className="agent-row"
                  >
                    <td className="status-cell">
                      <span className="status-indicator" style={{ color: status.color }}>
                        {status.icon}
                      </span>
                    </td>
                    <td className="name-cell">
                      <div className="agent-name">
                        {agent.name}
                        {agent.metadata.specialist && (
                          <span className="specialist-badge">S</span>
                        )}
                      </div>
                    </td>
                    <td className="role-cell">
                      <span className="role-badge">{agent.role}</span>
                    </td>
                    <td className="category-cell">
                      <span className="category-badge">{agent.metadata.category}</span>
                    </td>
                    <td className="budget-cell">
                      <div className="budget-bar-container">
                        <div
                          className="budget-bar"
                          style={{
                            width: `${budgetPercent}%`,
                            backgroundColor: budgetColor,
                          }}
                        />
                        <span className="budget-text">{budgetPercent}%</span>
                      </div>
                    </td>
                    <td className="quality-cell">
                      <span className="quality-grade" style={{ color: quality.color }}>
                        {quality.grade}
                      </span>
                    </td>
                    <td className="tasks-cell">
                      {agent.performance.total_tasks_completed}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="mobile-cards">
        {agents.length === 0 ? (
          <div className="no-results-mobile">
            No agents found matching the current filters.
          </div>
        ) : (
          agents.map(agent => {
            const status = getStatusIcon(agent.status || 'offline');
            const budgetPercent = formatBudgetPercent(
              agent.budget.cost_used_today,
              agent.budget.max_cost_per_day
            );
            const budgetColor = getBudgetColor(budgetPercent);
            const quality = getQualityGrade(agent.performance.quality_score);

            return (
              <div
                key={agent.agent_id}
                onClick={() => onAgentClick(agent.agent_id)}
                className="agent-card"
              >
                <div className="card-header">
                  <span className="status-indicator" style={{ color: status.color }}>
                    {status.icon}
                  </span>
                  <span className="agent-name">
                    {agent.name}
                    {agent.metadata.specialist && (
                      <span className="specialist-badge">S</span>
                    )}
                  </span>
                </div>
                <div className="card-body">
                  <div className="card-row">
                    <span className="label">Role:</span>
                    <span className="role-badge">{agent.role}</span>
                  </div>
                  <div className="card-row">
                    <span className="label">Category:</span>
                    <span className="category-badge">{agent.metadata.category}</span>
                  </div>
                  <div className="card-row">
                    <span className="label">Budget:</span>
                    <div className="budget-bar-container">
                      <div
                        className="budget-bar"
                        style={{
                          width: `${budgetPercent}%`,
                          backgroundColor: budgetColor,
                        }}
                      />
                      <span className="budget-text">{budgetPercent}%</span>
                    </div>
                  </div>
                  <div className="card-row">
                    <span className="label">Quality:</span>
                    <span className="quality-grade" style={{ color: quality.color }}>
                      {quality.grade}
                    </span>
                  </div>
                  <div className="card-row">
                    <span className="label">Tasks:</span>
                    <span>{agent.performance.total_tasks_completed}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {renderPagination()}

      <style>{`
        .agent-table-container {
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .table-wrapper {
          overflow-x: auto;
        }

        .agent-table {
          width: 100%;
          border-collapse: collapse;
        }

        .agent-table thead {
          background: var(--surface-secondary, #f8f9fa);
          border-bottom: 2px solid var(--border-color, #dee2e6);
        }

        .agent-table th {
          padding: 1rem;
          text-align: left;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-secondary, #6c757d);
          cursor: default;
        }

        .agent-table th.sortable {
          cursor: pointer;
          user-select: none;
        }

        .agent-table th.sortable:hover {
          background: var(--surface-hover, #e9ecef);
        }

        .sort-icon {
          margin-left: 0.5rem;
          opacity: 0.5;
        }

        .sort-icon.active {
          opacity: 1;
          color: var(--primary-color, #0066cc);
        }

        .agent-table tbody tr {
          border-bottom: 1px solid var(--border-color, #dee2e6);
        }

        .agent-row {
          cursor: pointer;
          transition: background-color 0.15s;
        }

        .agent-row:hover {
          background: var(--surface-hover, #f8f9fa);
        }

        .agent-table td {
          padding: 1rem;
          font-size: 0.875rem;
        }

        .status-cell {
          width: 60px;
          text-align: center;
        }

        .status-indicator {
          font-size: 1.25rem;
        }

        .agent-name {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 500;
        }

        .specialist-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 1.25rem;
          height: 1.25rem;
          border-radius: 50%;
          background: var(--primary-color, #0066cc);
          color: white;
          font-size: 0.625rem;
          font-weight: 600;
        }

        .role-badge,
        .category-badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          background: var(--surface-secondary, #f8f9fa);
          color: var(--text-primary, #212529);
          font-size: 0.75rem;
          text-transform: capitalize;
        }

        .budget-bar-container {
          position: relative;
          width: 100px;
          height: 20px;
          background: var(--surface-secondary, #f8f9fa);
          border-radius: 10px;
          overflow: hidden;
        }

        .budget-bar {
          height: 100%;
          transition: width 0.3s;
        }

        .budget-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-primary, #212529);
        }

        .quality-grade {
          font-size: 1.125rem;
          font-weight: 700;
        }

        .no-results {
          text-align: center;
          padding: 3rem;
          color: var(--text-secondary, #6c757d);
        }

        /* Pagination */
        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 0.5rem;
          padding: 1.5rem;
          border-top: 1px solid var(--border-color, #dee2e6);
        }

        .page-btn {
          padding: 0.5rem 0.75rem;
          border: 1px solid var(--border-color, #dee2e6);
          border-radius: 4px;
          background: white;
          color: var(--text-primary, #212529);
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .page-btn:hover:not(:disabled) {
          background: var(--surface-hover, #f8f9fa);
          border-color: var(--primary-color, #0066cc);
        }

        .page-btn.active {
          background: var(--primary-color, #0066cc);
          color: white;
          border-color: var(--primary-color, #0066cc);
        }

        .page-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .page-ellipsis {
          padding: 0.5rem 0.25rem;
          color: var(--text-secondary, #6c757d);
        }

        /* Mobile Cards - Hidden by default */
        .mobile-cards {
          display: none;
        }

        /* Responsive Design */
        @media (max-width: 1024px) {
          .agent-table th,
          .agent-table td {
            padding: 0.75rem 0.5rem;
          }

          .budget-bar-container {
            width: 80px;
          }
        }

        @media (max-width: 768px) {
          .table-wrapper {
            display: none;
          }

          .mobile-cards {
            display: block;
            padding: 1rem;
          }

          .agent-card {
            background: white;
            border: 1px solid var(--border-color, #dee2e6);
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 1rem;
            cursor: pointer;
            transition: box-shadow 0.2s;
          }

          .agent-card:hover {
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          }

          .card-header {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 1rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid var(--border-color, #dee2e6);
          }

          .card-body {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          }

          .card-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .card-row .label {
            font-weight: 500;
            color: var(--text-secondary, #6c757d);
            font-size: 0.875rem;
          }

          .no-results-mobile {
            text-align: center;
            padding: 3rem 1rem;
            color: var(--text-secondary, #6c757d);
          }
        }
      `}</style>
    </div>
  );
};
