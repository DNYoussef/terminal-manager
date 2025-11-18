import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Chip,
  Paper
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
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
        return <TrendingUpIcon sx={{ color: '#4caf50', fontSize: 20 }} />;
      case 'down':
        return <TrendingDownIcon sx={{ color: '#f44336', fontSize: 20 }} />;
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
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Code Quality Metrics
      </Typography>

      {/* Overall Quality Dashboard */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Overall Quality Score
              </Typography>
              <Box display="flex" alignItems="center" justifyContent="center" my={2}>
                <Box position="relative" display="inline-flex">
                  <CircularProgress
                    variant="determinate"
                    value={qualityScore?.overall || 0}
                    size={120}
                    thickness={6}
                    sx={{
                      color: getGradeColor(qualityScore?.grade || 'F')
                    }}
                  />
                  <Box
                    position="absolute"
                    top={0}
                    left={0}
                    bottom={0}
                    right={0}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    flexDirection="column"
                  >
                    <Typography variant="h3" component="div" color="textPrimary">
                      {qualityScore?.overall || 0}
                    </Typography>
                    <Typography variant="h6" color="textSecondary">
                      Grade {qualityScore?.grade || 'F'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
              <Box display="flex" alignItems="center" justifyContent="center">
                {getTrendIcon(qualityScore?.trend.direction || 'stable')}
                <Typography variant="body2" color="textSecondary" ml={1}>
                  {qualityScore?.trend.change > 0 ? '+' : ''}{qualityScore?.trend.change} from {qualityScore?.trend.period}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Quality Distribution
              </Typography>
              <Box sx={{ mt: 2 }}>
                {qualityScore?.distribution.map((dist) => (
                  <Box key={dist.grade} sx={{ mb: 2 }}>
                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                      <Typography variant="body2">
                        Grade {dist.grade}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {dist.count} agents ({dist.percentage}%)
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        width: '100%',
                        height: 24,
                        bgcolor: '#f5f5f5',
                        borderRadius: 1,
                        overflow: 'hidden'
                      }}
                    >
                      <Box
                        sx={{
                          width: `${dist.percentage}%`,
                          height: '100%',
                          bgcolor: getGradeColor(dist.grade),
                          transition: 'width 0.3s ease'
                        }}
                      />
                    </Box>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs for different views */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Violations" />
          <Tab label="Quality Trends" />
          <Tab label="Agent Scores" />
          <Tab label="Quality Gates" />
        </Tabs>
      </Box>

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
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Recent Quality Gate Events
          </Typography>
          {qualityGates.length === 0 ? (
            <Typography variant="body2" color="textSecondary">
              No quality gate events yet
            </Typography>
          ) : (
            <Box>
              {qualityGates.map((gate) => (
                <Box
                  key={gate.id}
                  sx={{
                    p: 2,
                    mb: 1,
                    border: 1,
                    borderColor: gate.status === 'passed' ? '#4caf50' : '#f44336',
                    borderRadius: 1,
                    bgcolor: gate.status === 'passed' ? '#f1f8f4' : '#fef1f1'
                  }}
                >
                  <Box display="flex" alignItems="center" mb={1}>
                    {gate.status === 'passed' ? (
                      <CheckCircleIcon sx={{ color: '#4caf50', mr: 1 }} />
                    ) : (
                      <ErrorIcon sx={{ color: '#f44336', mr: 1 }} />
                    )}
                    <Typography variant="body1" fontWeight="bold">
                      Agent "{gate.agent_name}" {gate.status === 'passed' ? 'passed' : 'blocked by'} quality gate
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="textSecondary" ml={4}>
                    Score: {gate.score} (threshold: {gate.threshold})
                  </Typography>
                  {gate.violations.length > 0 && (
                    <Box ml={4} mt={1}>
                      <Typography variant="body2" color="error">
                        Violations: {gate.violations.join(', ')}
                      </Typography>
                    </Box>
                  )}
                  <Typography variant="caption" color="textSecondary" ml={4}>
                    {formatTimestamp(gate.timestamp)}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Paper>
      )}

      {/* Violation Details Modal */}
      <ViolationDetailsModal
        violationId={selectedViolation}
        onClose={() => setSelectedViolation(null)}
      />
    </Box>
  );
};

export default QualityMetrics;
