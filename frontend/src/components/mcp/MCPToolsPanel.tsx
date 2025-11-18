/**
 * MCPToolsPanel - MCP Server and Tool Management
 * Displays MCP servers, available tools, and allows tool execution
 */

import React, { useState } from 'react';
import { useMCP } from '../../hooks/useMCP';
import { MCPTool } from '../../store/mcpSlice';

export const MCPToolsPanel: React.FC = () => {
  const {
    servers,
    tools,
    toolCalls,
    loading,
    error,
    selectedServer,
    selectedTool,
    startServer,
    stopServer,
    callTool,
    selectServer,
    selectTool,
    fetchServers,
    getServerTools,
    runningServers,
    totalTools,
  } = useMCP();

  const [toolArgs, setToolArgs] = useState<Record<string, any>>({});

  const handleStartServer = async (serverName: string) => {
    await startServer(serverName);
  };

  const handleStopServer = async (serverName: string) => {
    await stopServer(serverName);
  };

  const handleCallTool = async (toolName: string) => {
    await callTool(toolName, toolArgs);
    setToolArgs({});
  };

  const handleToolArgChange = (key: string, value: any) => {
    setToolArgs((prev) => ({ ...prev, [key]: value }));
  };

  const renderToolForm = (tool: MCPTool) => {
    const schema = tool.inputSchema;
    const properties = schema.properties || {};
    const required = schema.required || [];

    return (
      <div className="tool-form">
        <h4 className="tool-form-title">{tool.name}</h4>
        <p className="tool-description">{tool.description}</p>

        <div className="form-fields">
          {Object.entries(properties).map(([key, prop]: [string, any]) => (
            <div key={key} className="form-field">
              <label className="field-label">
                {key}
                {required.includes(key) && <span className="required">*</span>}
              </label>
              {prop.type === 'string' ? (
                <input
                  type="text"
                  className="field-input"
                  placeholder={prop.description || `Enter ${key}`}
                  value={toolArgs[key] || ''}
                  onChange={(e) => handleToolArgChange(key, e.target.value)}
                />
              ) : prop.type === 'number' || prop.type === 'integer' ? (
                <input
                  type="number"
                  className="field-input"
                  placeholder={prop.description || `Enter ${key}`}
                  value={toolArgs[key] || ''}
                  onChange={(e) => handleToolArgChange(key, parseFloat(e.target.value))}
                />
              ) : prop.type === 'boolean' ? (
                <select
                  className="field-input"
                  value={toolArgs[key] === undefined ? '' : String(toolArgs[key])}
                  onChange={(e) => handleToolArgChange(key, e.target.value === 'true')}
                >
                  <option value="">Select...</option>
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              ) : (
                <textarea
                  className="field-input"
                  placeholder={prop.description || `Enter ${key} (JSON)`}
                  value={toolArgs[key] || ''}
                  onChange={(e) => handleToolArgChange(key, e.target.value)}
                  rows={3}
                />
              )}
              {prop.description && (
                <span className="field-hint">{prop.description}</span>
              )}
            </div>
          ))}
        </div>

        <button
          className="call-button"
          onClick={() => handleCallTool(tool.name)}
          disabled={loading}
        >
          {loading ? 'Calling...' : 'Call Tool'}
        </button>
      </div>
    );
  };

  return (
    <div className="mcp-tools-panel">
      {/* Header */}
      <header className="panel-header">
        <div>
          <h2>MCP Tools</h2>
          <p className="header-subtitle">
            {runningServers} servers running • {totalTools} tools available
          </p>
        </div>
        <button onClick={fetchServers} className="refresh-button" disabled={loading}>
          {loading ? '⟳' : '↻'}
        </button>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Main Content */}
      <div className="panel-content">
        {/* Servers Column */}
        <div className="servers-section">
          <h3 className="section-title">MCP Servers</h3>

          <div className="servers-list">
            {Object.values(servers).map((server) => (
              <div
                key={server.name}
                className={`server-card ${selectedServer === server.name ? 'selected' : ''}`}
                onClick={() => selectServer(server.name)}
              >
                <div className="server-header">
                  <div>
                    <h4 className="server-name">{server.name}</h4>
                    <p className="server-type">{server.type}</p>
                  </div>
                  <span className={`status-dot ${server.running ? 'running' : 'stopped'}`} />
                </div>

                <p className="server-description">{server.description}</p>

                <div className="server-stats">
                  <span className="stat">
                    {server.tools_count} {server.tools_count === 1 ? 'tool' : 'tools'}
                  </span>
                  {server.pid && (
                    <span className="stat">PID: {server.pid}</span>
                  )}
                </div>

                <div className="server-actions">
                  {server.running ? (
                    <button
                      className="server-button stop"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStopServer(server.name);
                      }}
                      disabled={loading}
                    >
                      Stop
                    </button>
                  ) : (
                    <button
                      className="server-button start"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartServer(server.name);
                      }}
                      disabled={loading}
                    >
                      Start
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tools & Results Column */}
        <div className="tools-section">
          <h3 className="section-title">
            {selectedServer ? `${selectedServer} Tools` : 'All Tools'}
          </h3>

          {selectedServer && getServerTools(selectedServer).length === 0 && (
            <div className="empty-state">
              <p>No tools available</p>
              <p className="hint">
                {servers[selectedServer]?.running
                  ? 'Server has no tools registered'
                  : 'Start the server to load tools'}
              </p>
            </div>
          )}

          {(selectedServer ? getServerTools(selectedServer) : tools).map((tool) => (
            <div key={tool.name} className="tool-card">
              <div className="tool-header" onClick={() => selectTool(tool.name)}>
                <h4>{tool.name}</h4>
                <span className="tool-server">{tool.server}</span>
              </div>

              {selectedTool === tool.name && renderToolForm(tool)}
            </div>
          ))}
        </div>

        {/* Call History Column */}
        <div className="history-section">
          <h3 className="section-title">Call History</h3>

          <div className="history-list">
            {toolCalls.length === 0 ? (
              <div className="empty-state">
                <p>No tool calls yet</p>
              </div>
            ) : (
              toolCalls.map((call) => (
                <div key={call.id} className={`call-card ${call.success ? 'success' : 'error'}`}>
                  <div className="call-header">
                    <span className="call-tool">{call.tool_name}</span>
                    <span className="call-time">
                      {new Date(call.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="call-args">
                    <strong>Args:</strong> {JSON.stringify(call.arguments)}
                  </div>

                  {call.success && call.result && (
                    <div className="call-result">
                      <strong>Result:</strong>
                      <pre>{JSON.stringify(call.result, null, 2)}</pre>
                    </div>
                  )}

                  {!call.success && call.error && (
                    <div className="call-error">
                      <strong>Error:</strong> {call.error}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <style>{`
        .mcp-tools-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #1e1e1e;
          color: #d4d4d4;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: #252526;
          border-bottom: 1px solid #3e3e42;
        }

        .panel-header h2 {
          margin: 0 0 4px 0;
          font-size: 16px;
          font-weight: 600;
        }

        .header-subtitle {
          margin: 0;
          font-size: 12px;
          color: var(--color-text-secondary);
        }

        .refresh-button {
          background: transparent;
          border: 1px solid #3e3e42;
          color: #d4d4d4;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
        }

        .refresh-button:hover:not(:disabled) {
          background: #2d2d30;
          border-color: #4ec9b0;
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

        .panel-content {
          flex: 1;
          display: grid;
          grid-template-columns: 300px 1fr 350px;
          gap: 1px;
          background: #3e3e42;
          overflow: hidden;
        }

        .servers-section,
        .tools-section,
        .history-section {
          background: #1e1e1e;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .section-title {
          margin: 0;
          padding: 12px 16px;
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--color-text-secondary);
          background: #252526;
          border-bottom: 1px solid #3e3e42;
        }

        .servers-list,
        .history-list,
        .tools-section {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .server-card {
          background: #252526;
          border: 1px solid #3e3e42;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .server-card:hover {
          border-color: #4ec9b0;
        }

        .server-card.selected {
          border-color: #4ec9b0;
          background: #2d2d30;
        }

        .server-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;
        }

        .server-name {
          margin: 0 0 4px 0;
          font-size: 14px;
          font-weight: 600;
          color: #4ec9b0;
        }

        .server-type {
          margin: 0;
          font-size: 11px;
          color: var(--color-text-secondary);
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-top: 4px;
        }

        .status-dot.running {
          background: #4ec9b0;
          box-shadow: 0 0 6px rgba(78, 201, 176, 0.6);
        }

        .status-dot.stopped {
          background: #646464;
        }

        .server-description {
          margin: 0 0 8px 0;
          font-size: 12px;
          color: var(--color-text-secondary);
          line-height: 1.4;
        }

        .server-stats {
          display: flex;
          gap: 12px;
          margin-bottom: 8px;
        }

        .stat {
          font-size: 11px;
          color: var(--color-text-secondary);
          padding: 2px 6px;
          background: #1e1e1e;
          border-radius: 3px;
        }

        .server-actions {
          display: flex;
          gap: 8px;
        }

        .server-button {
          flex: 1;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .server-button.start {
          background: rgba(78, 201, 176, 0.2);
          border: 1px solid #4ec9b0;
          color: #4ec9b0;
        }

        .server-button.start:hover:not(:disabled) {
          background: rgba(78, 201, 176, 0.3);
        }

        .server-button.stop {
          background: rgba(244, 71, 71, 0.2);
          border: 1px solid #f44747;
          color: #f48771;
        }

        .server-button.stop:hover:not(:disabled) {
          background: rgba(244, 71, 71, 0.3);
        }

        .tool-card {
          background: #252526;
          border: 1px solid #3e3e42;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 12px;
        }

        .tool-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          margin-bottom: 8px;
        }

        .tool-header h4 {
          margin: 0;
          font-size: 14px;
          color: #4ec9b0;
        }

        .tool-server {
          font-size: 11px;
          color: var(--color-text-secondary);
          background: #1e1e1e;
          padding: 2px 8px;
          border-radius: 3px;
        }

        .tool-form {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #3e3e42;
        }

        .tool-form-title {
          margin: 0 0 4px 0;
          font-size: 13px;
          color: #d4d4d4;
        }

        .tool-description {
          margin: 0 0 12px 0;
          font-size: 12px;
          color: var(--color-text-secondary);
        }

        .form-fields {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 12px;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .field-label {
          font-size: 12px;
          color: #d4d4d4;
          font-weight: 500;
        }

        .required {
          color: #f44747;
          margin-left: 2px;
        }

        .field-input {
          padding: 8px 12px;
          background: #1e1e1e;
          border: 1px solid #3e3e42;
          border-radius: 4px;
          color: #d4d4d4;
          font-size: 13px;
          font-family: 'Consolas', 'Monaco', monospace;
        }

        .field-input:focus {
          outline: none;
          border-color: #4ec9b0;
        }

        .field-hint {
          font-size: 11px;
          color: var(--color-text-secondary);
        }

        .call-button {
          width: 100%;
          padding: 8px 16px;
          background: rgba(78, 201, 176, 0.2);
          border: 1px solid #4ec9b0;
          border-radius: 4px;
          color: #4ec9b0;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }

        .call-button:hover:not(:disabled) {
          background: rgba(78, 201, 176, 0.3);
        }

        .call-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .call-card {
          background: #252526;
          border: 1px solid #3e3e42;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 12px;
          font-size: 12px;
        }

        .call-card.success {
          border-left: 3px solid #4ec9b0;
        }

        .call-card.error {
          border-left: 3px solid #f44747;
        }

        .call-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .call-tool {
          font-weight: 600;
          color: #4ec9b0;
        }

        .call-time {
          color: var(--color-text-secondary);
          font-size: 11px;
        }

        .call-args,
        .call-result,
        .call-error {
          margin-top: 8px;
          padding: 8px;
          background: #1e1e1e;
          border-radius: 4px;
        }

        .call-result pre {
          margin: 4px 0 0 0;
          white-space: pre-wrap;
          word-break: break-word;
          color: #4ec9b0;
        }

        .call-error {
          color: #f48771;
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: var(--color-text-secondary);
        }

        .empty-state .hint {
          margin-top: 4px;
          font-size: 12px;
          color: var(--color-text-secondary);
        }
      `}</style>
    </div>
  );
};
