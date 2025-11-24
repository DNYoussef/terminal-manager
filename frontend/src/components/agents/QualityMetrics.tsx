import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, CheckCircle, AlertCircle } from 'lucide-react';
import ViolationBreakdown from './ViolationBreakdown';
import QualityTrends from './QualityTrends';
import AgentQualityTable from './AgentQualityTable';
import ViolationDetailsModal from './ViolationDetailsModal';

interface QualityScore {
  overall: number;
  grade: string;
  trend: {
    direction: 'up' | 'down' | 'stable';
    change: number;
    period: string;
  };
  distribution: {
    grade: string;
    count: number;
    percentage: number;
  }[];
}

interface Violation {
  id: string;
  type: 'god_objects' | 'parameter_bombs' | 'complexity' | 'nesting' | 'long_functions' | 'magic_literals';
  severity: 'high' | 'medium' | 'low';
  count: number;
  trend: number;
  threshold: string;
  description: string;
}

interface AgentQuality {
  id: string;
  name: string;
  role: string;
  quality_score: number;
  grade: string;
  violations: number;
  trend: number;
  last_analysis: string;
}

interface QualityGateEvent {
  id: string;
  agent_name: string;
  status: 'passed' | 'failed';
  score: number;
  threshold: number;
  violations: string[];
  timestamp: string;
}

const QualityMetrics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [qualityScore, setQualityScore] = useState<QualityScore | null>(null);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [agentQuality, setAgentQuality] = useState<AgentQuality[]>([]);
  const [qualityGates, setQualityGates] = useState<QualityGateEvent[]>([]);
  const [selectedViolation, setSelectedViolation] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    fetchQualityData();
    setupWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  const fetchQualityData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch quality scores
      const metricsResponse = await fetch('/api/v1/metrics/quality');
      if (!metricsResponse.ok) {
        throw new Error(`Failed to fetch quality metrics: ${metricsResponse.statusText}`);
      }
      const metricsData = await metricsResponse.json();
      setQualityScore(metricsData);
      setViolations(metricsData.violations || []);
      setAgentQuality(metricsData.agent_quality || []);

      // Fetch quality gate events
      const gatesResponse = await fetch('/api/v1/events/audit?operation_type=quality_gate&limit=10');
      if (!gatesResponse.ok) {
        throw new Error(`Failed to fetch quality gates: ${gatesResponse.statusText}`);
      }
      const gatesData = await gatesResponse.json();
      setQualityGates(gatesData.events || []);

    } catch (err) {
      console.error('Error fetching quality data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load quality data');
    } finally {
      setLoading(false);
    }
  };

  const setupWebSocket = () => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/api/v1/agents/activity/stream`;
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('WebSocket connected for quality metrics');
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'quality_update') {
          // Update quality scores in real-time
          setQualityScore(prev => prev ? { ...prev, overall: data.score } : null);
        } else if (data.type === 'quality_gate') {
          // Add new quality gate event
          setQualityGates(prev => [data, ...prev.slice(0, 9)]);
        } else if (data.type === 'violation_detected') {
          // Update violation counts
          setViolations(prev => {
            const updated = [...prev];
            const index = updated.findIndex(v => v.type === data.violation_type);
            if (index !== -1) {
              updated[index] = { ...updated[index], count: updated[index].count + 1 };
            }
            return updated;
          });
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    websocket.onclose = () => {
      console.log('WebSocket disconnected, attempting reconnect...');
      setTimeout(setupWebSocket, 5000);
    };

    setWs(websocket);
  };

  const getGradeColor = (grade: string): string => {
    switch (grade) {
      case 'A': return '#4caf50';
      case 'B': return '#8bc34a';
      case 'C': return '#ffc107';
      case 'D': return '#ff9800';
      case 'F': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up':
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'down':
        return <TrendingDown className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-4 p-4 bg-red-50 text-red-700 border border-red-200 rounded-md flex items-center">
        <AlertCircle className="w-5 h-5 mr-2" />
        {error}
      </div>
    );
  }

  return (
    <div className="p-6">
      <h4 className="text-2xl font-bold mb-6 text-gray-800">
        Code Quality Metrics
      </h4>

      {/* Overall Quality Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-6">
        <div className="md:col-span-4">
          <div className="bg-white rounded-lg shadow p-6 h-full">
            <h6 className="text-gray-500 font-medium mb-4">
              Overall Quality Score
            </h6>
            <div className="flex flex-col items-center justify-center my-4">
              <div className="relative flex items-center justify-center w-32 h-32">
                {/* Simple CSS Circle for Score */}
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle
                    className="text-gray-200 stroke-current"
                    strokeWidth="8"
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                  ></circle>
                  <circle
                    className="text-current stroke-current transition-all duration-500 ease-out"
                    strokeWidth="8"
                    strokeLinecap="round"
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    strokeDasharray={`${(qualityScore?.overall || 0) * 2.51} 251`}
                    transform="rotate(-90 50 50)"
                    style={{ color: getGradeColor(qualityScore?.grade || 'F') }}
                  ></circle>
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-3xl font-bold text-gray-800">
                    {qualityScore?.overall || 0}
                  </span>
                  <span className="text-lg text-gray-500 font-medium">
                    Grade {qualityScore?.grade || 'F'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center mt-2">
              {getTrendIcon(qualityScore?.trend.direction || 'stable')}
              <span className="text-sm text-gray-500 ml-2">
                {qualityScore?.trend.change > 0 ? '+' : ''}{qualityScore?.trend.change} from {qualityScore?.trend.period}
              </span>
            </div>
          </div>
        </div>

        <div className="md:col-span-8">
          <div className="bg-white rounded-lg shadow p-6 h-full">
            <h6 className="text-gray-500 font-medium mb-4">
              Quality Distribution
            </h6>
            <div className="mt-4 space-y-4">
              {qualityScore?.distribution.map((dist) => (
                <div key={dist.grade}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">
                      Grade {dist.grade}
                    </span>
                    <span className="text-sm text-gray-500">
                      {dist.count} agents ({dist.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-6 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300 ease-out"
                      style={{
                        width: `${dist.percentage}%`,
                        backgroundColor: getGradeColor(dist.grade),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs for different views */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8" aria-label="Tabs">
          {['Violations', 'Quality Trends', 'Agent Scores', 'Quality Gates'].map((tabName, index) => (
            <button
              key={tabName}
              onClick={() => setActiveTab(index)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === index
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              {tabName}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Panels */}
      {activeTab === 0 && (
        <ViolationBreakdown
          violations={violations}
          onViolationClick={setSelectedViolation}
        />
      )}

      {activeTab === 1 && (
        <QualityTrends />
      )}

      {activeTab === 2 && (
        <AgentQualityTable agents={agentQuality} />
      )}

      {activeTab === 3 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h6 className="text-lg font-semibold text-gray-800 mb-4">
            Recent Quality Gate Events
          </h6>
          {qualityGates.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No quality gate events yet
            </p>
          ) : (
            <div className="space-y-3">
              {qualityGates.map((gate) => (
                <div
                  key={gate.id}
                  className={`p-4 border rounded-md ${
                    gate.status === 'passed'
                      ? 'border-green-500 bg-green-50'
                      : 'border-red-500 bg-red-50'
                  }`}
                >
                  <div className="flex items-center mb-2">
                    {gate.status === 'passed' ? (
                      <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                    )}
                    <span className="font-bold text-gray-900">
                      Agent "{gate.agent_name}" {gate.status === 'passed' ? 'passed' : 'blocked by'} quality gate
                    </span>
                  </div>
                  <div className="ml-7">
                    <p className="text-sm text-gray-600">
                      Score: {gate.score} (threshold: {gate.threshold})
                    </p>
                    {gate.violations.length > 0 && (
                      <div className="mt-1">
                        <p className="text-sm text-red-600 font-medium">
                          Violations: {gate.violations.join(', ')}
                        </p>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {formatTimestamp(gate.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Violation Details Modal */}
      <ViolationDetailsModal
        violationId={selectedViolation}
        onClose={() => setSelectedViolation(null)}
      />
    </div>
  );
};

export default QualityMetrics;