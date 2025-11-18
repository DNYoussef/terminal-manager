/**
 * SessionsList Component
 * Displays discovered Claude Code sessions with search/filter capabilities
 */

import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useSessions } from '../../hooks/useSessions';
import { SessionInfo } from '../../store/sessionsSlice';
import { useTerminalsStore } from '../../store/searchStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface SessionsListProps {
  onTerminalAttached?: (terminalId: string) => void;
}

export const SessionsList: React.FC<SessionsListProps> = ({ onTerminalAttached }) => {
  const {
    filteredSessions,
    selectedSession,
    loading,
    error,
    searchQuery,
    filterByRecent,
    setSearchQuery,
    setFilterByRecent,
    selectSession,
    refreshSessions,
    totalSessions,
    filteredCount,
  } = useSessions();

  const [attachingSession, setAttachingSession] = useState<string | null>(null);
  const { addTerminal } = useTerminalsStore();

  const handleSessionClick = (session: SessionInfo) => {
    selectSession(session);
  };

  const handleAttachTerminal = async (session: SessionInfo) => {
    setAttachingSession(session.project_path);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/projects/attach-session?project_path=${encodeURIComponent(session.project_path)}&command=claude`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || 'Failed to attach terminal');
      }

      const data = await response.json();

      // Add terminal to store
      addTerminal({
        id: data.terminal_id,
        project_id: data.project_id,
        working_dir: data.working_dir,
        status: 'active',
        created_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      });

      toast.success(`Terminal attached to ${session.project_name}`);

      // Notify parent to switch to terminals tab
      if (onTerminalAttached) {
        onTerminalAttached(data.terminal_id);
      }

    } catch (error) {
      console.error('Failed to attach terminal:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to attach terminal');
    } finally {
      setAttachingSession(null);
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'No recent activity';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  return (
    <div className="sessions-list">
      {/* Header */}
      <header className="sessions-header">
        <div className="header-top">
          <h2>Claude Code Sessions</h2>
          <button
            onClick={refreshSessions}
            className="refresh-button"
            disabled={loading}
            title="Refresh sessions"
          >
            {loading ? '⟳' : '↻'}
          </button>
        </div>

        <div className="sessions-stats">
          <span className="stat">
            {totalSessions} total
          </span>
          {filteredCount !== totalSessions && (
            <span className="stat filtered">
              {filteredCount} filtered
            </span>
          )}
        </div>

        {/* Search and Filter */}
        <div className="search-controls">
          <input
            type="text"
            placeholder="Search sessions by name, path, commands, or agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />

          <label className="filter-checkbox">
            <input
              type="checkbox"
              checked={filterByRecent}
              onChange={(e) => setFilterByRecent(e.target.checked)}
            />
            <span>Recent (24h)</span>
          </label>
        </div>
      </header>

      {/* Error State */}
      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Discovering Claude Code sessions...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredSessions.length === 0 && (
        <div className="empty-state">
          {searchQuery || filterByRecent ? (
            <>
              <p>No sessions match your filters</p>
              <button onClick={() => {
                setSearchQuery('');
                setFilterByRecent(false);
              }}>
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p>No Claude Code sessions found</p>
              <p className="hint">Sessions are discovered from .claude/ directories</p>
            </>
          )}
        </div>
      )}

      {/* Sessions Grid */}
      {!loading && !error && filteredSessions.length > 0 && (
        <div className="sessions-grid">
          {filteredSessions.map((session) => (
            <SessionCard
              key={session.project_path}
              session={session}
              isSelected={selectedSession?.project_path === session.project_path}
              onClick={() => handleSessionClick(session)}
              onAttach={() => handleAttachTerminal(session)}
              isAttaching={attachingSession === session.project_path}
              formatDate={formatDate}
            />
          ))}
        </div>
      )}

      <style>{`
        .sessions-list {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #1e1e1e;
          color: #d4d4d4;
        }

        .sessions-header {
          padding: 16px 20px;
          background: #252526;
          border-bottom: 1px solid #3e3e42;
        }

        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .sessions-header h2 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        .refresh-button {
          background: transparent;
          border: 1px solid #3e3e42;
          color: #d4d4d4;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          transition: all 0.2s;
        }

        .refresh-button:hover:not(:disabled) {
          background: #2d2d30;
          border-color: #4ec9b0;
        }

        .refresh-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .sessions-stats {
          display: flex;
          gap: 12px;
          margin-bottom: 12px;
          font-size: 12px;
          color: var(--color-text-secondary); /* Fixed: was var(--color-text-secondary) (3.72:1) */
        }

        .stat {
          padding: 4px 8px;
          background: #2d2d30;
          border-radius: 4px;
        }

        .stat.filtered {
          background: rgba(78, 201, 176, 0.15);
          color: #4ec9b0;
        }

        .search-controls {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .search-input {
          flex: 1;
          padding: 8px 12px;
          background: #2d2d30;
          border: 1px solid #3e3e42;
          border-radius: 4px;
          color: #d4d4d4;
          font-size: 13px;
        }

        .search-input:focus {
          outline: none;
          border-color: #4ec9b0;
        }

        .filter-checkbox {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          cursor: pointer;
          user-select: none;
        }

        .filter-checkbox input[type="checkbox"] {
          cursor: pointer;
        }

        .error-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: rgba(244, 71, 71, 0.15);
          border-left: 3px solid #f44747;
          color: #f48771;
          font-size: 13px;
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          gap: 16px;
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #3e3e42;
          border-top-color: #4ec9b0;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          gap: 12px;
          color: var(--color-text-secondary);
        }

        .empty-state .hint {
          font-size: 12px;
          color: var(--color-text-secondary); /* Fixed: was var(--color-text-secondary) (3.08:1) */
        }

        .empty-state button {
          margin-top: 8px;
          padding: 8px 16px;
          background: #2d2d30;
          border: 1px solid #3e3e42;
          border-radius: 4px;
          color: #d4d4d4;
          cursor: pointer;
        }

        .empty-state button:hover {
          background: #3e3e42;
        }

        .sessions-grid {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
          align-content: start;
        }

        .sessions-grid::-webkit-scrollbar {
          width: 10px;
        }

        .sessions-grid::-webkit-scrollbar-track {
          background: #1e1e1e;
        }

        .sessions-grid::-webkit-scrollbar-thumb {
          background: #3e3e42;
          border-radius: 5px;
        }

        .sessions-grid::-webkit-scrollbar-thumb:hover {
          background: #4e4e52;
        }
      `}</style>
    </div>
  );
};

// Session Card Component
interface SessionCardProps {
  session: SessionInfo;
  isSelected: boolean;
  onClick: () => void;
  onAttach: () => void;
  isAttaching: boolean;
  formatDate: (date: string | null) => string;
}

const SessionCard: React.FC<SessionCardProps> = ({
  session,
  isSelected,
  onClick,
  onAttach,
  isAttaching,
  formatDate,
}) => {
  const handleAttachClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection
    onAttach();
  };

  return (
    <div
      className={`session-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="card-header">
        <h3 className="project-name" title={session.project_path}>
          {session.project_name}
        </h3>
        <span className="command-count">
          {session.command_count} commands
        </span>
      </div>

      <div className="card-body">
        <div className="project-path" title={session.project_path}>
          {session.project_path}
        </div>

        <div className="last-activity">
          <span className="activity-label">Last activity:</span>
          <span className="activity-time">{formatDate(session.last_activity)}</span>
        </div>

        {session.recent_agents.length > 0 && (
          <div className="agents-section">
            <div className="section-label">Recent agents:</div>
            <div className="agents-tags">
              {session.recent_agents.slice(0, 5).map((agent, idx) => (
                <span key={idx} className="agent-tag" title={agent}>
                  {agent}
                </span>
              ))}
              {session.recent_agents.length > 5 && (
                <span className="agent-tag more">
                  +{session.recent_agents.length - 5}
                </span>
              )}
            </div>
          </div>
        )}

        {session.recent_commands.length > 0 && (
          <div className="commands-section">
            <div className="section-label">Recent commands:</div>
            <div className="commands-list">
              {session.recent_commands.slice(0, 3).map((cmd, idx) => (
                <div key={idx} className="command-item" title={cmd}>
                  {cmd}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card-footer">
        <button
          className="attach-button"
          onClick={handleAttachClick}
          disabled={isAttaching}
        >
          {isAttaching ? (
            <>
              <span className="attach-spinner"></span>
              Attaching...
            </>
          ) : (
            'Attach Terminal'
          )}
        </button>
      </div>

      <style>{`
        .session-card {
          background: #252526;
          border: 1px solid #3e3e42;
          border-radius: 6px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
        }

        .session-card:hover {
          border-color: #4ec9b0;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .session-card.selected {
          border-color: #4ec9b0;
          background: #2d2d30;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #2d2d30;
          border-bottom: 1px solid #3e3e42;
        }

        .project-name {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #4ec9b0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 200px;
        }

        .command-count {
          font-size: 11px;
          color: var(--color-text-secondary);
          background: #1e1e1e;
          padding: 4px 8px;
          border-radius: 10px;
        }

        .card-body {
          flex: 1;
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .project-path {
          font-size: 11px;
          color: var(--color-text-secondary);
          font-family: 'Consolas', 'Monaco', monospace;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .last-activity {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
        }

        .activity-label {
          color: var(--color-text-secondary);
        }

        .activity-time {
          color: #d4d4d4;
          font-weight: 500;
        }

        .section-label {
          font-size: 11px;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }

        .agents-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .agent-tag {
          font-size: 11px;
          padding: 4px 8px;
          background: rgba(78, 201, 176, 0.15);
          color: #4ec9b0;
          border-radius: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 120px;
        }

        .agent-tag.more {
          background: rgba(133, 133, 133, 0.15);
          color: var(--color-text-secondary);
        }

        .commands-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .command-item {
          font-size: 12px;
          color: #d4d4d4;
          font-family: 'Consolas', 'Monaco', monospace;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          padding: 4px 8px;
          background: #1e1e1e;
          border-radius: 4px;
        }

        .card-footer {
          padding: 12px 16px;
          background: #2d2d30;
          border-top: 1px solid #3e3e42;
        }

        .attach-button {
          width: 100%;
          padding: 8px 16px;
          background: rgba(78, 201, 176, 0.2);
          border: 1px solid #4ec9b0;
          border-radius: 4px;
          color: #4ec9b0;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .attach-button:hover:not(:disabled) {
          background: rgba(78, 201, 176, 0.3);
          box-shadow: 0 2px 8px rgba(78, 201, 176, 0.2);
        }

        .attach-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .attach-spinner {
          display: inline-block;
          width: 12px;
          height: 12px;
          margin-right: 6px;
          border: 2px solid rgba(78, 201, 176, 0.3);
          border-top-color: #4ec9b0;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
