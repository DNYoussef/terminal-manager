/**
 * Best-of-N Comparison View Component
 *
 * Displays side-by-side comparison of agent outputs with:
 * - Artifact diff viewer
 * - Quality metrics dashboard
 * - Score breakdown visualization
 * - Human override selection
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface ArtifactMetrics {
  quality_score: number;
  normalized_score: number;
  additional_metrics: Record<string, any>;
}

interface AgentArtifacts {
  code: {
    files: string[];
    quality_score: number;
    lines_of_code: number;
  };
  tests: {
    files: string[];
    count: number;
    coverage: number;
    passing: number;
  };
  docs: {
    files: string[];
    completeness: number;
    word_count: number;
  };
}

export interface AgentResult {
  agent_id: string;
  agent_type: string;
  score: number;
  breakdown: {
    code_quality: number;
    test_coverage: number;
    documentation: number;
    performance: number;
  };
  artifacts: AgentArtifacts;
  metrics: {
    execution_time_ms: number;
    tokens_used: number;
    cost_usd: number;
  };
  comparison: {
    code_metrics: ArtifactMetrics;
    test_metrics: ArtifactMetrics;
    doc_metrics: ArtifactMetrics;
    performance_metrics: ArtifactMetrics;
  };
}

export interface ExecutionResults {
  task_id: string;
  status: string;
  winner: AgentResult | null;
  all_results: AgentResult[];
  execution_time_ms: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface ComparisonViewProps {
  taskId: string;
  onClose?: () => void;
}

const ComparisonView: React.FC<ComparisonViewProps> = ({ taskId, onClose }) => {
  const [results, setResults] = useState<ExecutionResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState<'overview' | 'diff' | 'metrics'>('overview');
  const [selectionRationale, setSelectionRationale] = useState('');

  useEffect(() => {
    fetchResults();
    const interval = setInterval(() => {
      if (results?.status === 'running') {
        fetchResults();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [taskId]);

  const fetchResults = async () => {
    try {
      const response = await axios.get(`/api/v1/best-of-n/${taskId}/results`);
      setResults(response.data);
      if (response.data.status === 'completed') {
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleHumanSelection = async () => {
    if (!selectedAgent || !selectionRationale.trim()) {
      alert('Please select an agent and provide rationale');
      return;
    }

    try {
      await axios.post(`/api/v1/best-of-n/${taskId}/select`, {
        selected_agent_id: selectedAgent,
        rationale: selectionRationale
      });
      alert('Selection recorded successfully!');
    } catch (err: any) {
      alert(`Failed to record selection: ${err.message}`);
    }
  };

  const renderScoreBar = (score: number, maxScore: number = 100) => {
    const percentage = (score / maxScore) * 100;
    const color = percentage >= 80 ? 'bg-green-500' :
                  percentage >= 60 ? 'bg-yellow-500' :
                  'bg-red-500';

    return (
      <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700">
        <div
          className={`${color} h-4 rounded-full flex items-center justify-center text-xs text-white`}
          style={{ width: `${percentage}%` }}
        >
          {score.toFixed(1)}
        </div>
      </div>
    );
  };

  const renderAgentCard = (result: AgentResult, isWinner: boolean = false) => {
    return (
      <div
        key={result.agent_id}
        className={`
          border rounded-lg p-6 mb-4
          ${isWinner ? 'border-green-500 bg-green-50' : 'border-gray-300'}
          ${selectedAgent === result.agent_id ? 'ring-2 ring-blue-500' : ''}
          cursor-pointer hover:shadow-lg transition-shadow
        `}
        onClick={() => setSelectedAgent(result.agent_id)}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <h3 className="text-xl font-bold mr-3">{result.agent_type}</h3>
            {isWinner && (
              <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm">
                Winner
              </span>
            )}
          </div>
          <div className="text-2xl font-bold text-gray-700">
            {result.score.toFixed(1)}
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="space-y-3 mb-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Code Quality</span>
              <span>{result.breakdown.code_quality.toFixed(1)}</span>
            </div>
            {renderScoreBar(result.breakdown.code_quality, 40)}
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Test Coverage</span>
              <span>{result.breakdown.test_coverage.toFixed(1)}</span>
            </div>
            {renderScoreBar(result.breakdown.test_coverage, 30)}
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Documentation</span>
              <span>{result.breakdown.documentation.toFixed(1)}</span>
            </div>
            {renderScoreBar(result.breakdown.documentation, 20)}
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Performance</span>
              <span>{result.breakdown.performance.toFixed(1)}</span>
            </div>
            {renderScoreBar(result.breakdown.performance, 10)}
          </div>
        </div>

        {/* Artifacts Summary */}
        <div className="grid grid-cols-3 gap-4 text-sm border-t pt-4">
          <div>
            <div className="font-semibold">Code</div>
            <div>{result.artifacts.code.files.length} files</div>
            <div>{result.artifacts.code.lines_of_code} LOC</div>
          </div>
          <div>
            <div className="font-semibold">Tests</div>
            <div>{result.artifacts.tests.count} tests</div>
            <div>{result.artifacts.tests.coverage.toFixed(1)}% coverage</div>
          </div>
          <div>
            <div className="font-semibold">Docs</div>
            <div>{result.artifacts.docs.files.length} files</div>
            <div>{result.artifacts.docs.word_count} words</div>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-4 text-sm border-t pt-4 mt-4">
          <div>
            <div className="font-semibold">Execution Time</div>
            <div>{(result.metrics.execution_time_ms / 1000).toFixed(1)}s</div>
          </div>
          <div>
            <div className="font-semibold">Tokens Used</div>
            <div>{result.metrics.tokens_used.toLocaleString()}</div>
          </div>
          <div>
            <div className="font-semibold">Cost</div>
            <div>${result.metrics.cost_usd.toFixed(2)}</div>
          </div>
        </div>
      </div>
    );
  };

  const renderOverview = () => {
    if (!results?.all_results) return null;

    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">Agent Comparison</h2>

        {/* Winner */}
        {results.winner && (
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4">Winner</h3>
            {renderAgentCard(results.winner, true)}
          </div>
        )}

        {/* Runners-up */}
        {results.all_results.length > 1 && (
          <div>
            <h3 className="text-xl font-semibold mb-4">Runners-up</h3>
            {results.all_results
              .filter(r => r.agent_id !== results.winner?.agent_id)
              .map(result => renderAgentCard(result))}
          </div>
        )}
      </div>
    );
  };

  const renderDiffView = () => {
    return (
      <div className="p-6 bg-gray-50 rounded-lg">
        <h2 className="text-2xl font-bold mb-6">Artifact Diff View</h2>
        <p className="text-gray-600">
          Side-by-side diff viewer will be rendered here with file comparisons
        </p>
        {/* TODO: Implement diff viewer using react-diff-viewer or similar */}
      </div>
    );
  };

  const renderMetricsView = () => {
    if (!results?.all_results) return null;

    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">Metrics Dashboard</h2>

        {/* Comparative Metrics Chart */}
        <div className="grid grid-cols-2 gap-6">
          {results.all_results.map(result => (
            <div key={result.agent_id} className="border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">{result.agent_type}</h3>

              <div className="space-y-4">
                <div>
                  <div className="text-sm font-semibold mb-2">Code Quality</div>
                  <div className="text-2xl">
                    {result.comparison.code_metrics.quality_score.toFixed(1)}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold mb-2">Test Coverage</div>
                  <div className="text-2xl">
                    {result.artifacts.tests.coverage.toFixed(1)}%
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold mb-2">Documentation</div>
                  <div className="text-2xl">
                    {result.comparison.doc_metrics.quality_score.toFixed(1)}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold mb-2">Performance</div>
                  <div className="text-2xl">
                    {result.comparison.performance_metrics.quality_score.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading && !results) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-300 rounded-lg p-6">
        <h3 className="text-red-800 font-semibold mb-2">Error</h3>
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (!results) return null;

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Best-of-N Results</h1>
          <p className="text-gray-600">Task ID: {taskId}</p>
          <p className="text-sm text-gray-500">
            Status: {results.status}
            {results.execution_time_ms && ` | Execution time: ${(results.execution_time_ms / 1000).toFixed(1)}s`}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
          >
            Close
          </button>
        )}
      </div>

      {/* Running Status */}
      {results.status === 'running' && (
        <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3"></div>
            <p className="text-blue-800">Agents are executing in parallel sandboxes...</p>
          </div>
        </div>
      )}

      {/* View Tabs */}
      {results.status === 'completed' && (
        <>
          <div className="flex space-x-4 mb-6 border-b">
            <button
              onClick={() => setCompareMode('overview')}
              className={`px-4 py-2 ${compareMode === 'overview' ? 'border-b-2 border-blue-500 font-semibold' : ''}`}
            >
              Overview
            </button>
            <button
              onClick={() => setCompareMode('diff')}
              className={`px-4 py-2 ${compareMode === 'diff' ? 'border-b-2 border-blue-500 font-semibold' : ''}`}
            >
              Diff View
            </button>
            <button
              onClick={() => setCompareMode('metrics')}
              className={`px-4 py-2 ${compareMode === 'metrics' ? 'border-b-2 border-blue-500 font-semibold' : ''}`}
            >
              Metrics
            </button>
          </div>

          {/* Content */}
          <div className="mb-8">
            {compareMode === 'overview' && renderOverview()}
            {compareMode === 'diff' && renderDiffView()}
            {compareMode === 'metrics' && renderMetricsView()}
          </div>

          {/* Human Override Selection */}
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Human Override</h3>
            <p className="text-gray-700 mb-4">
              Click on an agent card above to select it, then provide your rationale:
            </p>

            <textarea
              className="w-full border rounded-lg p-3 mb-4"
              rows={4}
              placeholder="Explain why you selected this agent's output over the automatic winner..."
              value={selectionRationale}
              onChange={(e) => setSelectionRationale(e.target.value)}
            />

            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {selectedAgent
                  ? `Selected: ${results.all_results.find(r => r.agent_id === selectedAgent)?.agent_type}`
                  : 'No agent selected'}
              </p>
              <button
                onClick={handleHumanSelection}
                disabled={!selectedAgent || !selectionRationale.trim()}
                className={`
                  px-6 py-2 rounded-lg font-semibold
                  ${selectedAgent && selectionRationale.trim()
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'}
                `}
              >
                Record Selection
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ComparisonView;
