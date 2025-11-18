/**
 * Agent Registry Page
 * Standalone page for testing and showcasing Agent Registry UI
 */

import React from 'react';
import { AgentRegistry } from '../components/agents';

export const AgentRegistryPage: React.FC = () => {
  return (
    <div className="agent-registry-page">
      <AgentRegistry />

      <style>{`
        .agent-registry-page {
          min-height: 100vh;
          background: var(--background, #ffffff);
        }
      `}</style>
    </div>
  );
};
