import React from 'react';
import { AgentEvent } from '../../hooks/useAgentStream';

interface EventCardProps {
  event: AgentEvent;
  onClick?: (event: AgentEvent) => void;
}

const EVENT_CONFIG = {
  agent_spawned: {
    icon: '🟦',
    color: 'blue',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
  },
  operation_allowed: {
    icon: '✓',
    color: 'green',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-700',
  },
  operation_denied: {
    icon: '✕',
    color: 'red',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
  },
  budget_updated: {
    icon: '💰',
    color: 'yellow',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-700',
  },
  quality_gate_passed: {
    icon: '✓',
    color: 'green',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-700',
  },
  quality_gate_failed: {
    icon: '⚠',
    color: 'orange',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-700',
  },
  task_completed: {
    icon: '✓',
    color: 'green',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-700',
  },
  task_failed: {
    icon: '✕',
    color: 'red',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
  },
};

const formatTimeAgo = (timestamp: string): string => {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 60) return `${diffSecs} seconds ago`;
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)} minutes ago`;
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)} hours ago`;
  return `${Math.floor(diffSecs / 86400)} days ago`;
};

const formatCost = (cost: number): string => {
  return `$${cost.toFixed(4)}`;
};

const formatBudgetRemaining = (remaining: number): string => {
  return `${Math.round(remaining * 100)}%`;
};

export const EventCard: React.FC<EventCardProps> = ({ event, onClick }) => {
  const config = EVENT_CONFIG[event.type];
  const { metadata } = event;

  return (
    <div
      onClick={() => onClick?.(event)}
      className={`flex items-start gap-3 p-3 border-l-4 ${config.borderColor} ${config.bgColor} rounded-r-lg hover:shadow-md transition-shadow cursor-pointer`}
    >
      {/* Event Icon */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${config.bgColor} ${config.textColor} font-bold`}>
        <span className="text-lg">{config.icon}</span>
      </div>

      {/* Event Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className={`font-semibold ${config.textColor}`}>
            {event.agentName}
          </span>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
            {event.agentRole}
          </span>
          <span className="text-xs text-gray-400 ml-auto">
            {formatTimeAgo(event.timestamp)}
          </span>
        </div>

        {/* Message */}
        <div className="text-sm text-gray-700 mb-1">
          {event.message}
        </div>

        {/* Metadata */}
        {metadata && Object.keys(metadata).length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs text-gray-500">
            {metadata.cost !== undefined && (
              <span className="bg-gray-100 px-2 py-0.5 rounded">
                Cost: {formatCost(metadata.cost)}
              </span>
            )}
            {metadata.tokens !== undefined && (
              <span className="bg-gray-100 px-2 py-0.5 rounded">
                Tokens: {metadata.tokens.toLocaleString()}
              </span>
            )}
            {metadata.budgetRemaining !== undefined && (
              <span className="bg-gray-100 px-2 py-0.5 rounded">
                Budget: {formatBudgetRemaining(metadata.budgetRemaining)} remaining
              </span>
            )}
            {metadata.score !== undefined && (
              <span className="bg-gray-100 px-2 py-0.5 rounded">
                Score: {metadata.score}
              </span>
            )}
            {metadata.duration !== undefined && (
              <span className="bg-gray-100 px-2 py-0.5 rounded">
                Time: {metadata.duration}ms
              </span>
            )}
            {metadata.file && (
              <span className="bg-gray-100 px-2 py-0.5 rounded truncate max-w-xs">
                File: {metadata.file}
              </span>
            )}
            {metadata.operation && (
              <span className="bg-gray-100 px-2 py-0.5 rounded">
                Op: {metadata.operation}
              </span>
            )}
          </div>
        )}

        {/* Error/Reason */}
        {(metadata?.error || metadata?.reason) && (
          <div className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
            {metadata.error || metadata.reason}
          </div>
        )}
      </div>
    </div>
  );
};
