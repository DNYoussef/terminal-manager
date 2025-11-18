/**
 * TerminalMonitor - Main layout for terminal monitoring
 *
 * Layout: Sidebar (terminal list) + Main panel (terminal output)
 */
import React, { useEffect } from 'react';
import { useTerminalsStore } from '../../store/searchStore';
import { TerminalList } from './TerminalList';
import { TerminalOutputView } from './TerminalOutputView';

export const TerminalMonitor: React.FC = () => {
  const { terminals, selectedTerminalId, setTerminals, selectTerminal } = useTerminalsStore();

  // Fetch terminals on mount
  useEffect(() => {
    const fetchTerminals = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/v1/terminals/');
        if (!response.ok) {
          throw new Error('Failed to fetch terminals');
        }

        const data = await response.json();
        setTerminals(data);

        // Auto-select first terminal if none selected
        if (!selectedTerminalId && data.length > 0) {
          selectTerminal(data[0].id);
        }
      } catch (error) {
        console.error('[TerminalMonitor] Error fetching terminals:', error);
      }
    };

    fetchTerminals();

    // Poll for terminal updates every 5 seconds
    const interval = setInterval(fetchTerminals, 5000);

    return () => clearInterval(interval);
  }, [setTerminals, selectedTerminalId, selectTerminal]);

  return (
    <div className="terminal-monitor">
      <div className="terminal-layout">
        {/* Sidebar - Terminal List */}
        <aside className="terminal-sidebar">
          <TerminalList />
        </aside>

        {/* Main Panel - Terminal Output */}
        <main className="terminal-main">
          {selectedTerminalId ? (
            <TerminalOutputView terminalId={selectedTerminalId} />
          ) : (
            <div className="terminal-empty-state">
              <p>No terminal selected</p>
              {terminals.length === 0 && <p>No active terminals</p>}
            </div>
          )}
        </main>
      </div>

      <style>{`
        .terminal-monitor {
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: #1e1e1e;
          color: #d4d4d4;
        }

        .terminal-layout {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .terminal-sidebar {
          width: 300px;
          background: #252526;
          border-right: 1px solid #3e3e42;
          overflow-y: auto;
        }

        .terminal-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .terminal-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--color-text-secondary);
          font-size: 14px;
        }

        .terminal-empty-state p {
          margin: 8px 0;
        }
      `}</style>
    </div>
  );
};
