/**
 * AgentDetailsModal Component
 * Displays comprehensive details about a selected agent
 */

import React from 'react';
import { AgentIdentity } from '../../store/agentsSlice';

interface AgentDetailsModalProps {
  agent: AgentIdentity | null;
  isOpen: boolean;
  onClose: () => void;
}

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  return date.toLocaleString();
};

const formatCurrency = (amount: number, currency: string): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-US').format(num);
};

const formatPercent = (value: number): string => {
  return `${Math.round(value)}%`;
};

export const AgentDetailsModal: React.FC<AgentDetailsModalProps> = ({
  agent,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !agent) return null;

  const budgetPercent = (agent.budget.cost_used_today / agent.budget.max_cost_per_day) * 100;
  const tokensPercent = (agent.budget.tokens_used_today / agent.budget.max_tokens_per_session) * 100;

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal-container">
        <div className="modal-header">
          <h2>{agent.name}</h2>
          <button onClick={onClose} className="close-button">
            &times;
          </button>
        </div>

        <div className="modal-body">
          {/* Basic Information */}
          <section className="details-section">
            <h3>Basic Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Agent ID</span>
                <span className="value monospace">{agent.agent_id}</span>
              </div>
              <div className="info-item">
                <span className="label">Role</span>
                <span className="value badge">{agent.role}</span>
              </div>
              <div className="info-item">
                <span className="label">Category</span>
                <span className="value badge">{agent.metadata.category}</span>
              </div>
              <div className="info-item">
                <span className="label">Specialist</span>
                <span className="value">
                  {agent.metadata.specialist ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="info-item">
                <span className="label">Version</span>
                <span className="value">{agent.metadata.version}</span>
              </div>
              <div className="info-item">
                <span className="label">Status</span>
                <span className={`value status-${agent.status}`}>
                  {agent.status || 'unknown'}
                </span>
              </div>
            </div>
          </section>

          {/* Capabilities */}
          <section className="details-section">
            <h3>Capabilities</h3>
            <div className="tags-container">
              {agent.capabilities.map((cap, idx) => (
                <span key={idx} className="tag capability-tag">
                  {cap}
                </span>
              ))}
            </div>
          </section>

          {/* Tags */}
          {agent.metadata.tags.length > 0 && (
            <section className="details-section">
              <h3>Tags</h3>
              <div className="tags-container">
                {agent.metadata.tags.map((tag, idx) => (
                  <span key={idx} className="tag info-tag">
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* RBAC Permissions */}
          <section className="details-section">
            <h3>RBAC Permissions</h3>
            <div className="rbac-grid">
              <div className="rbac-item">
                <h4>Allowed Tools ({agent.rbac.allowed_tools.length})</h4>
                <div className="tool-list">
                  {agent.rbac.allowed_tools.length > 0 ? (
                    agent.rbac.allowed_tools.map((tool, idx) => (
                      <span key={idx} className="tag tool-tag allowed">
                        {tool}
                      </span>
                    ))
                  ) : (
                    <span className="empty-state">No allowed tools</span>
                  )}
                </div>
              </div>

              {agent.rbac.denied_tools.length > 0 && (
                <div className="rbac-item">
                  <h4>Denied Tools ({agent.rbac.denied_tools.length})</h4>
                  <div className="tool-list">
                    {agent.rbac.denied_tools.map((tool, idx) => (
                      <span key={idx} className="tag tool-tag denied">
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="rbac-item">
                <h4>Path Scopes ({agent.rbac.path_scopes.length})</h4>
                <div className="path-list">
                  {agent.rbac.path_scopes.length > 0 ? (
                    agent.rbac.path_scopes.map((path, idx) => (
                      <code key={idx} className="path-item">{path}</code>
                    ))
                  ) : (
                    <span className="empty-state">No path restrictions</span>
                  )}
                </div>
              </div>

              <div className="rbac-item">
                <h4>API Access ({agent.rbac.api_access.length})</h4>
                <div className="api-list">
                  {agent.rbac.api_access.length > 0 ? (
                    agent.rbac.api_access.map((api, idx) => (
                      <span key={idx} className="tag api-tag">{api}</span>
                    ))
                  ) : (
                    <span className="empty-state">No API access</span>
                  )}
                </div>
              </div>

              <div className="rbac-item">
                <h4>Approval Settings</h4>
                <div className="approval-info">
                  <div className="info-row">
                    <span>Requires Approval:</span>
                    <strong>{agent.rbac.requires_approval ? 'Yes' : 'No'}</strong>
                  </div>
                  {agent.rbac.requires_approval && (
                    <div className="info-row">
                      <span>Threshold:</span>
                      <strong>
                        {formatCurrency(agent.rbac.approval_threshold, agent.budget.currency)}
                      </strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Budget Information */}
          <section className="details-section">
            <h3>Budget</h3>
            <div className="budget-details">
              <div className="budget-item">
                <div className="budget-header">
                  <span>Cost Budget</span>
                  <span className="budget-amount">
                    {formatCurrency(agent.budget.cost_used_today, agent.budget.currency)} /
                    {formatCurrency(agent.budget.max_cost_per_day, agent.budget.currency)}
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(budgetPercent, 100)}%`,
                      backgroundColor: budgetPercent >= 90 ? '#dc3545' :
                        budgetPercent >= 75 ? '#fd7e14' :
                        budgetPercent >= 50 ? '#ffc107' : '#28a745',
                    }}
                  />
                </div>
                <div className="budget-percent">{formatPercent(budgetPercent)}</div>
              </div>

              <div className="budget-item">
                <div className="budget-header">
                  <span>Token Budget</span>
                  <span className="budget-amount">
                    {formatNumber(agent.budget.tokens_used_today)} /
                    {formatNumber(agent.budget.max_tokens_per_session)}
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(tokensPercent, 100)}%`,
                      backgroundColor: tokensPercent >= 90 ? '#dc3545' :
                        tokensPercent >= 75 ? '#fd7e14' :
                        tokensPercent >= 50 ? '#ffc107' : '#28a745',
                    }}
                  />
                </div>
                <div className="budget-percent">{formatPercent(tokensPercent)}</div>
              </div>

              <div className="budget-meta">
                <div className="info-row">
                  <span>Last Reset:</span>
                  <strong>{formatDate(agent.budget.last_reset)}</strong>
                </div>
              </div>
            </div>
          </section>

          {/* Performance Metrics */}
          <section className="details-section">
            <h3>Performance Metrics</h3>
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">Success Rate</div>
                <div className="metric-value">
                  {formatPercent(agent.performance.success_rate)}
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Quality Score</div>
                <div className="metric-value">
                  {agent.performance.quality_score.toFixed(1)}
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Avg Execution Time</div>
                <div className="metric-value">
                  {agent.performance.avg_execution_time_ms.toFixed(0)}ms
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Tasks Completed</div>
                <div className="metric-value">
                  {formatNumber(agent.performance.total_tasks_completed)}
                </div>
              </div>
            </div>
          </section>

          {/* Timestamps */}
          <section className="details-section">
            <h3>Timestamps</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Created At</span>
                <span className="value">{formatDate(agent.timestamps.created_at)}</span>
              </div>
              <div className="info-item">
                <span className="label">Updated At</span>
                <span className="value">{formatDate(agent.timestamps.updated_at)}</span>
              </div>
              <div className="info-item">
                <span className="label">Last Active</span>
                <span className="value">{formatDate(agent.timestamps.last_active_at)}</span>
              </div>
            </div>
          </section>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="close-footer-button">
            Close
          </button>
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 1000;
        }

        .modal-container {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 90%;
          max-width: 900px;
          max-height: 90vh;
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
          z-index: 1001;
          display: flex;
          flex-direction: column;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 1px solid var(--border-color, #dee2e6);
        }

        .modal-header h2 {
          margin: 0;
          font-size: 1.5rem;
          color: var(--text-primary, #212529);
        }

        .close-button {
          background: none;
          border: none;
          font-size: 2rem;
          line-height: 1;
          color: var(--text-secondary, #6c757d);
          cursor: pointer;
          padding: 0;
          width: 2rem;
          height: 2rem;
        }

        .close-button:hover {
          color: var(--text-primary, #212529);
        }

        .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
        }

        .details-section {
          margin-bottom: 2rem;
        }

        .details-section:last-child {
          margin-bottom: 0;
        }

        .details-section h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 1rem;
          color: var(--text-primary, #212529);
        }

        .details-section h4 {
          font-size: 0.875rem;
          font-weight: 600;
          margin-bottom: 0.75rem;
          color: var(--text-secondary, #6c757d);
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }

        .info-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .info-item .label {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--text-secondary, #6c757d);
          text-transform: uppercase;
        }

        .info-item .value {
          font-size: 0.875rem;
          color: var(--text-primary, #212529);
        }

        .value.badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          background: var(--surface-secondary, #f8f9fa);
          text-transform: capitalize;
          font-weight: 500;
        }

        .value.monospace {
          font-family: 'Courier New', monospace;
          font-size: 0.75rem;
        }

        .value.status-active { color: #28a745; }
        .value.status-idle { color: #ffc107; }
        .value.status-paused { color: #007bff; }
        .value.status-blocked { color: #dc3545; }
        .value.status-offline { color: #6c757d; }

        .tags-container {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .tag {
          display: inline-block;
          padding: 0.375rem 0.75rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .capability-tag {
          background: #e7f3ff;
          color: #0066cc;
        }

        .info-tag {
          background: #f8f9fa;
          color: #495057;
        }

        .tool-tag {
          padding: 0.25rem 0.5rem;
        }

        .tool-tag.allowed {
          background: #d4edda;
          color: #155724;
        }

        .tool-tag.denied {
          background: #f8d7da;
          color: #721c24;
        }

        .api-tag {
          background: #fff3cd;
          color: #856404;
        }

        .rbac-grid {
          display: grid;
          gap: 1.5rem;
        }

        .rbac-item {
          padding: 1rem;
          background: var(--surface-secondary, #f8f9fa);
          border-radius: 6px;
        }

        .tool-list,
        .api-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .path-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .path-item {
          display: block;
          padding: 0.5rem;
          background: #f1f3f5;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
          font-size: 0.75rem;
          color: #495057;
        }

        .empty-state {
          font-size: 0.875rem;
          color: var(--text-secondary, #6c757d);
          font-style: italic;
        }

        .approval-info {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.875rem;
        }

        .budget-details {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .budget-item {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .budget-header {
          display: flex;
          justify-content: space-between;
          font-size: 0.875rem;
        }

        .budget-amount {
          font-weight: 600;
        }

        .progress-bar {
          height: 8px;
          background: var(--surface-secondary, #f8f9fa);
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          transition: width 0.3s;
        }

        .budget-percent {
          text-align: right;
          font-size: 0.75rem;
          color: var(--text-secondary, #6c757d);
        }

        .budget-meta {
          padding: 1rem;
          background: var(--surface-secondary, #f8f9fa);
          border-radius: 6px;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
        }

        .metric-card {
          padding: 1rem;
          background: var(--surface-secondary, #f8f9fa);
          border-radius: 6px;
          text-align: center;
        }

        .metric-label {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--text-secondary, #6c757d);
          margin-bottom: 0.5rem;
        }

        .metric-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary, #212529);
        }

        .modal-footer {
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--border-color, #dee2e6);
          display: flex;
          justify-content: flex-end;
        }

        .close-footer-button {
          padding: 0.5rem 1.5rem;
          border: 1px solid var(--border-color, #dee2e6);
          border-radius: 4px;
          background: white;
          color: var(--text-primary, #212529);
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .close-footer-button:hover {
          background: var(--surface-secondary, #f8f9fa);
          border-color: var(--primary-color, #0066cc);
          color: var(--primary-color, #0066cc);
        }

        /* Responsive */
        @media (max-width: 768px) {
          .modal-container {
            width: 95%;
            max-height: 95vh;
          }

          .modal-header,
          .modal-body,
          .modal-footer {
            padding: 1rem;
          }

          .info-grid,
          .metrics-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
};
