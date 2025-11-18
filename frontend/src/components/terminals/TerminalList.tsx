/**
 * TerminalList - Sidebar showing all active terminals
 */
import React from 'react';
import { useTerminalsStore } from '../../store/searchStore';

export const TerminalList: React.FC = () => {
  const { terminals, selectedTerminalId, selectTerminal, getConnectionStatus } =
    useTerminalsStore();

  const handleTerminalClick = (terminalId: string) => {
    selectTerminal(terminalId);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return '●'; // Green dot
      case 'idle':
        return '○'; // Hollow circle
      case 'stopped':
        return '■'; // Square
      case 'error':
        return '▲'; // Triangle
      default:
        return '?';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#4ec9b0'; // Green
      case 'idle':
        return 'var(--color-text-secondary)'; // Gray
      case 'stopped':
        return '#646464'; // Dark gray
      case 'error':
        return '#f48771'; // Red
      default:
        return 'var(--color-text-secondary)';
    }
  };

  const getConnectionStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return '#4ec9b0'; // Green
      case 'connecting':
        return '#ce9178'; // Orange
      case 'disconnected':
        return 'var(--color-text-secondary)'; // Gray
      case 'error':
        return '#f48771'; // Red
      default:
        return 'var(--color-text-secondary)';
    }
  };

  return (
    <div className="terminal-list">
      <header className="terminal-list-header">
        <h3>Active Terminals</h3>
        <span className="terminal-count">{terminals.length}</span>
      </header>

      <div className="terminal-list-items">
        {terminals.length === 0 ? (
          <div className="terminal-list-empty">
            <p>No active terminals</p>
          </div>
        ) : (
          terminals.map((terminal) => {
            const isSelected = terminal.id === selectedTerminalId;
            const connectionStatus = getConnectionStatus(terminal.id);

            return (
              <div
                key={terminal.id}
                className={`terminal-list-item ${isSelected ? 'selected' : ''}`}
                onClick={() => handleTerminalClick(terminal.id)}
              >
                <div className="terminal-item-header">
                  <span
                    className="terminal-status-icon"
                    style={{ color: getStatusColor(terminal.status) }}
                  >
                    {getStatusIcon(terminal.status)}
                  </span>
                  <span className="terminal-project-id">{terminal.project_id}</span>
                </div>

                <div className="terminal-item-details">
                  <div className="terminal-working-dir">
                    {terminal.working_dir.split('\\').pop() || terminal.working_dir}
                  </div>

                  <div className="terminal-meta">
                    {terminal.pid && <span className="terminal-pid">PID: {terminal.pid}</span>}
                    <span
                      className="terminal-connection"
                      style={{ color: getConnectionStatusColor(connectionStatus) }}
                    >
                      {connectionStatus}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <style>{`
        .terminal-list {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .terminal-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid #3e3e42;
        }

        .terminal-list-header h3 {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          color: #d4d4d4;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .terminal-count {
          background: #3e3e42;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 11px;
          color: var(--color-text-secondary);
        }

        .terminal-list-items {
          flex: 1;
          overflow-y: auto;
        }

        .terminal-list-empty {
          padding: 24px 16px;
          text-align: center;
          color: var(--color-text-secondary);
          font-size: 12px;
        }

        .terminal-list-item {
          padding: 12px 16px;
          border-bottom: 1px solid #2d2d2d;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .terminal-list-item:hover {
          background: #2a2d2e;
        }

        .terminal-list-item.selected {
          background: #094771;
          border-left: 3px solid #007acc;
        }

        .terminal-item-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .terminal-status-icon {
          font-size: 12px;
        }

        .terminal-project-id {
          font-size: 13px;
          font-weight: 500;
          color: #d4d4d4;
        }

        .terminal-item-details {
          font-size: 11px;
          color: var(--color-text-secondary);
        }

        .terminal-working-dir {
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .terminal-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .terminal-pid {
          font-family: 'Consolas', 'Monaco', monospace;
        }

        .terminal-connection {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
      `}</style>
    </div>
  );
};
