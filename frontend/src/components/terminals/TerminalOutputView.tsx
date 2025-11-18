/**
 * TerminalOutputView - xterm.js terminal output display with WebSocket streaming
 */
import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';
import { useTerminalStream } from '../../hooks/useTerminalStream';
import { useTerminalsStore } from '../../store/searchStore';

interface TerminalOutputViewProps {
  terminalId: string;
}

export const TerminalOutputView: React.FC<TerminalOutputViewProps> = ({ terminalId }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);

  const { getTerminal, getMessages } = useTerminalsStore();
  const terminal = getTerminal(terminalId);

  // Initialize xterm.js
  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal instance
    const xterm = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Consolas, Monaco, monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
      scrollback: 10000,
      convertEol: true,
    });

    // Add fit addon
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    fitAddonRef.current = fitAddon;

    // Add search addon
    const searchAddon = new SearchAddon();
    xterm.loadAddon(searchAddon);
    searchAddonRef.current = searchAddon;

    // Open terminal in DOM
    xterm.open(terminalRef.current);

    // Fit to container
    fitAddon.fit();

    // Store reference
    xtermRef.current = xterm;

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      xterm.dispose();
      xtermRef.current = null;
    };
  }, [terminalId]);

  // Connect to WebSocket stream
  useTerminalStream({
    terminalId,
    autoConnect: true,
    onMessage: (message) => {
      const xterm = xtermRef.current;
      if (!xterm) return;

      switch (message.type) {
        case 'stdout':
          if (message.line) {
            xterm.writeln(message.line);
          }
          break;

        case 'stderr':
          if (message.line) {
            // Write stderr in red
            xterm.writeln(`\x1b[31m${message.line}\x1b[0m`);
          }
          break;

        case 'connected':
          xterm.writeln(`\x1b[32m[Connected to terminal stream]\x1b[0m`);
          break;

        case 'status':
          if (message.status === 'stopped') {
            xterm.writeln(`\x1b[33m[Terminal stopped - exit code: ${message.exit_code}]\x1b[0m`);
          }
          break;

        case 'error':
          xterm.writeln(`\x1b[31m[Error: ${message.message}]\x1b[0m`);
          break;
      }
    },
  });

  // Load existing messages on mount
  useEffect(() => {
    const xterm = xtermRef.current;
    if (!xterm) return;

    const messages = getMessages(terminalId);
    messages.forEach((message) => {
      switch (message.type) {
        case 'stdout':
          if (message.line) {
            xterm.writeln(message.line);
          }
          break;

        case 'stderr':
          if (message.line) {
            xterm.writeln(`\x1b[31m${message.line}\x1b[0m`);
          }
          break;
      }
    });
  }, [terminalId, getMessages]);

  return (
    <div className="terminal-output-view">
      <header className="terminal-header">
        <div className="terminal-info">
          <h4>{terminal?.project_id || 'Terminal'}</h4>
          <span className="terminal-path">{terminal?.working_dir}</span>
        </div>
        <div className="terminal-status">
          <span className={`status-badge ${terminal?.status}`}>
            {terminal?.status || 'unknown'}
          </span>
        </div>
      </header>

      <div className="terminal-container" ref={terminalRef} />

      <style>{`
        .terminal-output-view {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #1e1e1e;
        }

        .terminal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #2d2d2d;
          border-bottom: 1px solid #3e3e42;
        }

        .terminal-info h4 {
          margin: 0 0 4px 0;
          font-size: 13px;
          font-weight: 500;
          color: #d4d4d4;
        }

        .terminal-path {
          font-size: 11px;
          color: var(--color-text-secondary);
          font-family: 'Consolas', 'Monaco', monospace;
        }

        .status-badge {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 11px;
          text-transform: uppercase;
          font-weight: 600;
          letter-spacing: 0.5px;
        }

        .status-badge.active {
          background: rgba(78, 201, 176, 0.2);
          color: #4ec9b0;
        }

        .status-badge.idle {
          background: rgba(133, 133, 133, 0.2);
          color: var(--color-text-secondary);
        }

        .status-badge.stopped {
          background: rgba(100, 100, 100, 0.2);
          color: #646464;
        }

        .status-badge.error {
          background: rgba(244, 135, 113, 0.2);
          color: #f48771;
        }

        .terminal-container {
          flex: 1;
          padding: 8px;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};
