import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckCircle, XCircle, Info, TrendingUp, Settings, Zap, RefreshCw } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

interface FeedbackStats {
  prompt_refinement: {
    runs: number;
    last_run: string;
    total_refinements: number;
  };
  tool_tuning: {
    runs: number;
    last_run: string;
    total_recommendations: number;
  };
  workflow_optimizer: {
    runs: number;
    last_run: string;
    total_optimizations: number;
  };
}

interface Recommendation {
  id: string;
  type: 'prompt_refinement' | 'tool_tuning' | 'workflow_optimization';
  agent_id?: string;
  workflow_id?: string;
  timestamp: string;
  status: 'pending_approval' | 'approved' | 'rejected';
  data: any;
}

const FeedbackLoopsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [pendingRecommendations, setPendingRecommendations] = useState<Recommendation[]>([]);
  const [selectedRecommendation, setSelectedRecommendation] = useState<Recommendation | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/feedback/stats`);
      setStats(response.data);
    } catch (err: any) {
      console.error('Error fetching stats:', err);
      setError(err.message);
    }
  };

  // Fetch pending recommendations
  const fetchPendingRecommendations = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/feedback/pending-approvals`);
      setPendingRecommendations(response.data.recommendations || []);
    } catch (err: any) {
      console.error('Error fetching recommendations:', err);
      setError(err.message);
    }
  };

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchPendingRecommendations();

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchStats();
      fetchPendingRecommendations();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Handle recommendation approval/rejection
  const handleApprove = async (approved: boolean) => {
    if (!selectedRecommendation) return;

    setLoading(true);
    try {
      const endpoint = selectedRecommendation.type === 'prompt_refinement'
        ? `/api/feedback/prompt-recommendations/${selectedRecommendation.id}/approve`
        : selectedRecommendation.type === 'tool_tuning'
        ? `/api/feedback/rbac-recommendations/${selectedRecommendation.id}/approve`
        : `/api/feedback/workflow-recommendations/${selectedRecommendation.id}/approve`;

      await axios.post(`${BACKEND_URL}${endpoint}`, {
        approved,
        notes: approvalNotes
      });

      // Refresh data
      await fetchPendingRecommendations();

      setApprovalDialogOpen(false);
      setSelectedRecommendation(null);
      setApprovalNotes('');
    } catch (err: any) {
      console.error('Error approving recommendation:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Open approval dialog
  const openApprovalDialog = (recommendation: Recommendation) => {
    setSelectedRecommendation(recommendation);
    setApprovalDialogOpen(true);
  };

  // Render statistics card
  const renderStatsCard = (title: string, stats: any, icon: React.ReactNode) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center mb-4 text-blue-600">
        {icon}
        <h3 className="text-lg font-semibold ml-2 text-gray-800">
          {title}
        </h3>
      </div>
      <p className="text-sm text-gray-600">
        Total runs: {stats.runs}
      </p>
      <p className="text-sm text-gray-600">
        Last run: {new Date(stats.last_run).toLocaleString()}
      </p>
      {title === 'Prompt Refinement' && (
        <p className="text-sm text-gray-600">
          Total refinements: {stats.total_refinements}
        </p>
      )}
      {title === 'Tool Tuning' && (
        <p className="text-sm text-gray-600">
          Total recommendations: {stats.total_recommendations}
        </p>
      )}
      {title === 'Workflow Optimizer' && (
        <p className="text-sm text-gray-600">
          Total optimizations: {stats.total_optimizations}
        </p>
      )}
    </div>
  );

  // Render recommendation item
  const renderRecommendation = (rec: Recommendation) => {
    const getTitle = () => {
      if (rec.type === 'prompt_refinement') {
        return `Agent ${rec.agent_id}: Prompt Refinement`;
      } else if (rec.type === 'tool_tuning') {
        return `Agent ${rec.agent_id}: Tool Tuning`;
      } else {
        return `Workflow ${rec.workflow_id}: Optimization`;
      }
    };

    const getSecondary = () => {
      if (rec.type === 'prompt_refinement') {
        const improvement = rec.data?.test_results?.improvement || 0;
        return `Improvement: ${(improvement * 100).toFixed(1)}%`;
      } else if (rec.type === 'tool_tuning') {
        const remove = rec.data?.remove_tools?.length || 0;
        const allow = rec.data?.allow_tools?.length || 0;
        return `Remove: ${remove}, Allow: ${allow}`;
      } else {
        const timeImp = rec.data?.simulation?.time_improvement || 0;
        return `Time savings: ${timeImp.toFixed(1)}%`;
      }
    };

    return (
      <div key={rec.id} className="border-b border-gray-200 last:border-0 py-4 flex justify-between items-start">
        <div>
          <h4 className="text-base font-medium text-gray-900">{getTitle()}</h4>
          <div className="mt-1">
            <span className="text-sm text-gray-600">{getSecondary()}</span>
            <br />
            <span className="text-xs text-gray-400">
              {new Date(rec.timestamp).toLocaleString()}
            </span>
          </div>
        </div>
        <button
          onClick={() => openApprovalDialog(rec)}
          className="text-blue-600 hover:text-blue-800 p-2"
        >
          <Info className="w-5 h-5" />
        </button>
      </div>
    );
  };

  // Render approval dialog
  const renderApprovalDialog = () => {
    if (!selectedRecommendation || !approvalDialogOpen) return null;

    const renderDetails = () => {
      if (selectedRecommendation.type === 'prompt_refinement') {
        const data = selectedRecommendation.data;
        return (
          <>
            <h5 className="text-sm font-semibold text-gray-700 mb-2">Changes:</h5>
            <ul className="list-disc pl-5 space-y-1 mb-4 text-sm text-gray-600">
              {data.changes?.map((change: any, idx: number) => (
                <li key={idx}>
                  <span className="font-medium">{change.change}</span>
                  <span className="block text-xs text-gray-500">Pattern: {change.pattern} ({change.count} occurrences)</span>
                </li>
              ))}
            </ul>
            <h5 className="text-sm font-semibold text-gray-700 mb-2">A/B Test Results:</h5>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Original success rate: {(data.test_results?.originalSuccessRate * 100).toFixed(1)}%</p>
              <p>Refined success rate: {(data.test_results?.refinedSuccessRate * 100).toFixed(1)}%</p>
              <p>Improvement: {(data.test_results?.improvement * 100).toFixed(1)}%</p>
              <p>P-value: {data.test_results?.pValue?.toFixed(4)}</p>
            </div>
          </>
        );
      } else if (selectedRecommendation.type === 'tool_tuning') {
        const data = selectedRecommendation.data;
        return (
          <>
            {data.remove_tools?.length > 0 && (
              <>
                <h5 className="text-sm font-semibold text-gray-700 mb-2">Tools to Remove:</h5>
                <ul className="list-disc pl-5 space-y-1 mb-4 text-sm text-gray-600">
                  {data.remove_tools.map((tool: any, idx: number) => (
                    <li key={idx}>
                      <span className="font-medium">{tool.tool}</span>
                      <span className="block text-xs text-gray-500">{tool.reason}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {data.allow_tools?.length > 0 && (
              <>
                <h5 className="text-sm font-semibold text-gray-700 mb-2">Tools to Allow:</h5>
                <ul className="list-disc pl-5 space-y-1 mb-4 text-sm text-gray-600">
                  {data.allow_tools.map((tool: any, idx: number) => (
                    <li key={idx}>
                      <span className="font-medium">{tool.tool}</span>
                      <span className="block text-xs text-gray-500">{tool.justification}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {data.encourage_patterns?.length > 0 && (
              <>
                <h5 className="text-sm font-semibold text-gray-700 mb-2">Successful Patterns:</h5>
                <ul className="list-disc pl-5 space-y-1 mb-4 text-sm text-gray-600">
                  {data.encourage_patterns.slice(0, 5).map((pattern: any, idx: number) => (
                    <li key={idx}>
                      <span className="font-medium">{pattern.tools.join(' + ')}</span>
                      <span className="block text-xs text-gray-500">Success rate: ${(pattern.success_rate * 100).toFixed(1)}% ({pattern.usage_count} uses)</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        );
      } else {
        const data = selectedRecommendation.data;
        return (
          <>
            <h5 className="text-sm font-semibold text-gray-700 mb-2">Simulation Results:</h5>
            <div className="text-sm text-gray-600 space-y-1 mb-4">
              <p>Current duration: {data.simulation?.current_duration?.toFixed(2)}ms</p>
              <p>Optimized duration: {data.simulation?.optimized_duration?.toFixed(2)}ms</p>
              <p className="text-blue-600 font-medium">Time improvement: {data.simulation?.time_improvement?.toFixed(1)}%</p>
              <p className="text-blue-600 font-medium">Cost improvement: {data.simulation?.cost_improvement?.toFixed(1)}%</p>
            </div>

            {data.bottlenecks?.length > 0 && (
              <>
                <h5 className="text-sm font-semibold text-gray-700 mb-2">Bottlenecks:</h5>
                <ul className="list-disc pl-5 space-y-1 mb-4 text-sm text-gray-600">
                  {data.bottlenecks.map((bottleneck: any, idx: number) => (
                    <li key={idx}>
                      <span className="font-medium">{bottleneck.agent}</span>
                      <span className="block text-xs text-gray-500">Avg time: {bottleneck.avg_time?.toFixed(2)}ms ({bottleneck.executions} runs)</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {data.parallelize?.length > 0 && (
              <>
                <h5 className="text-sm font-semibold text-gray-700 mb-2">Parallelization Opportunities:</h5>
                <p className="text-sm text-gray-600 mb-4">{data.parallelize.length} opportunities identified</p>
              </>
            )}

            {data.remove?.length > 0 && (
              <>
                <h5 className="text-sm font-semibold text-gray-700 mb-2">Redundant Steps:</h5>
                <p className="text-sm text-gray-600 mb-4">{data.remove.length} redundant steps identified</p>
              </>
            )}
          </>
        );
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Review Recommendation</h3>
              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                {selectedRecommendation.type.replace(/_/g, ' ')}
              </span>
            </div>
            <button 
              onClick={() => setApprovalDialogOpen(false)}
              className="text-gray-400 hover:text-gray-500"
            >
              <span className="sr-only">Close</span>
              <XCircle className="w-6 h-6" />
            </button>
          </div>
          
          <div className="p-6 overflow-y-auto flex-1">
            {renderDetails()}

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Approval Notes (optional)
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                rows={3}
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
            <button
              onClick={() => handleApprove(false)}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Reject
            </button>
            <button
              onClick={() => handleApprove(true)}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Approve & Apply
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h4 className="text-2xl font-bold text-gray-800">Feedback Loops Dashboard</h4>
        <button
          onClick={() => {
            fetchStats();
            fetchPendingRecommendations();
          }}
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md flex items-start">
          <XCircle className="w-5 h-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-500">
            <span className="sr-only">Dismiss</span>
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {renderStatsCard('Prompt Refinement', stats.prompt_refinement, <TrendingUp className="w-6 h-6" />)}
          {renderStatsCard('Tool Tuning', stats.tool_tuning, <Settings className="w-6 h-6" />)}
          {renderStatsCard('Workflow Optimizer', stats.workflow_optimizer, <Zap className="w-6 h-6" />)}
        </div>
      )}

      {/* Pending Approvals */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h6 className="text-lg font-semibold text-gray-800">
            Pending Approvals ({pendingRecommendations.length})
          </h6>
        </div>

        <div className="p-6">
          {pendingRecommendations.length === 0 ? (
            <div className="p-4 bg-blue-50 text-blue-700 rounded-md flex items-center">
              <Info className="w-5 h-5 mr-2" />
              No pending approvals
            </div>
          ) : (
            <>
              <div className="border-b border-gray-200 mb-4">
                <nav className="flex space-x-8">
                  {['All', 'Prompt Refinement', 'Tool Tuning', 'Workflow Optimization'].map((tab, index) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(index)}
                      className={`
                        py-4 px-1 border-b-2 font-medium text-sm
                        ${activeTab === index
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                      `}
                    >
                      {tab}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="space-y-1">
                {pendingRecommendations
                  .filter(rec => {
                    if (activeTab === 0) return true;
                    if (activeTab === 1) return rec.type === 'prompt_refinement';
                    if (activeTab === 2) return rec.type === 'tool_tuning';
                    if (activeTab === 3) return rec.type === 'workflow_optimization';
                    return true;
                  })
                  .map(renderRecommendation)}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Approval Dialog */}
      {renderApprovalDialog()}
    </div>
  );
};

export default FeedbackLoopsDashboard;