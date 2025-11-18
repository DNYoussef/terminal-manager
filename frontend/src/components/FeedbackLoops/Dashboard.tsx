import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Tabs,
  Tab,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  LinearProgress
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  Info,
  TrendingUp,
  Settings,
  Speed,
  Refresh
} from '@mui/icons-material';

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
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          {icon}
          <Typography variant="h6" ml={1}>
            {title}
          </Typography>
        </Box>
        <Typography variant="body2" color="textSecondary">
          Total runs: {stats.runs}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Last run: {new Date(stats.last_run).toLocaleString()}
        </Typography>
        {title === 'Prompt Refinement' && (
          <Typography variant="body2" color="textSecondary">
            Total refinements: {stats.total_refinements}
          </Typography>
        )}
        {title === 'Tool Tuning' && (
          <Typography variant="body2" color="textSecondary">
            Total recommendations: {stats.total_recommendations}
          </Typography>
        )}
        {title === 'Workflow Optimizer' && (
          <Typography variant="body2" color="textSecondary">
            Total optimizations: {stats.total_optimizations}
          </Typography>
        )}
      </CardContent>
    </Card>
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
      <ListItem key={rec.id} divider>
        <ListItemText
          primary={getTitle()}
          secondary={
            <>
              <Typography variant="body2" component="span">
                {getSecondary()}
              </Typography>
              <br />
              <Typography variant="caption" color="textSecondary">
                {new Date(rec.timestamp).toLocaleString()}
              </Typography>
            </>
          }
        />
        <ListItemSecondaryAction>
          <IconButton
            edge="end"
            onClick={() => openApprovalDialog(rec)}
            color="primary"
          >
            <Info />
          </IconButton>
        </ListItemSecondaryAction>
      </ListItem>
    );
  };

  // Render approval dialog
  const renderApprovalDialog = () => {
    if (!selectedRecommendation) return null;

    const renderDetails = () => {
      if (selectedRecommendation.type === 'prompt_refinement') {
        const data = selectedRecommendation.data;
        return (
          <>
            <Typography variant="subtitle2" gutterBottom>
              Changes:
            </Typography>
            <List dense>
              {data.changes?.map((change: any, idx: number) => (
                <ListItem key={idx}>
                  <ListItemText
                    primary={change.change}
                    secondary={`Pattern: ${change.pattern} (${change.count} occurrences)`}
                  />
                </ListItem>
              ))}
            </List>
            <Typography variant="subtitle2" gutterBottom mt={2}>
              A/B Test Results:
            </Typography>
            <Typography variant="body2">
              Original success rate: {(data.test_results?.originalSuccessRate * 100).toFixed(1)}%
            </Typography>
            <Typography variant="body2">
              Refined success rate: {(data.test_results?.refinedSuccessRate * 100).toFixed(1)}%
            </Typography>
            <Typography variant="body2">
              Improvement: {(data.test_results?.improvement * 100).toFixed(1)}%
            </Typography>
            <Typography variant="body2">
              P-value: {data.test_results?.pValue?.toFixed(4)}
            </Typography>
          </>
        );
      } else if (selectedRecommendation.type === 'tool_tuning') {
        const data = selectedRecommendation.data;
        return (
          <>
            {data.remove_tools?.length > 0 && (
              <>
                <Typography variant="subtitle2" gutterBottom>
                  Tools to Remove:
                </Typography>
                <List dense>
                  {data.remove_tools.map((tool: any, idx: number) => (
                    <ListItem key={idx}>
                      <ListItemText
                        primary={tool.tool}
                        secondary={tool.reason}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}
            {data.allow_tools?.length > 0 && (
              <>
                <Typography variant="subtitle2" gutterBottom mt={2}>
                  Tools to Allow:
                </Typography>
                <List dense>
                  {data.allow_tools.map((tool: any, idx: number) => (
                    <ListItem key={idx}>
                      <ListItemText
                        primary={tool.tool}
                        secondary={tool.justification}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}
            {data.encourage_patterns?.length > 0 && (
              <>
                <Typography variant="subtitle2" gutterBottom mt={2}>
                  Successful Patterns:
                </Typography>
                <List dense>
                  {data.encourage_patterns.slice(0, 5).map((pattern: any, idx: number) => (
                    <ListItem key={idx}>
                      <ListItemText
                        primary={pattern.tools.join(' + ')}
                        secondary={`Success rate: ${(pattern.success_rate * 100).toFixed(1)}% (${pattern.usage_count} uses)`}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </>
        );
      } else {
        const data = selectedRecommendation.data;
        return (
          <>
            <Typography variant="subtitle2" gutterBottom>
              Simulation Results:
            </Typography>
            <Typography variant="body2">
              Current duration: {data.simulation?.current_duration?.toFixed(2)}ms
            </Typography>
            <Typography variant="body2">
              Optimized duration: {data.simulation?.optimized_duration?.toFixed(2)}ms
            </Typography>
            <Typography variant="body2" color="primary">
              Time improvement: {data.simulation?.time_improvement?.toFixed(1)}%
            </Typography>
            <Typography variant="body2" color="primary">
              Cost improvement: {data.simulation?.cost_improvement?.toFixed(1)}%
            </Typography>

            {data.bottlenecks?.length > 0 && (
              <>
                <Typography variant="subtitle2" gutterBottom mt={2}>
                  Bottlenecks:
                </Typography>
                <List dense>
                  {data.bottlenecks.map((bottleneck: any, idx: number) => (
                    <ListItem key={idx}>
                      <ListItemText
                        primary={bottleneck.agent}
                        secondary={`Avg time: ${bottleneck.avg_time?.toFixed(2)}ms (${bottleneck.executions} runs)`}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}

            {data.parallelize?.length > 0 && (
              <>
                <Typography variant="subtitle2" gutterBottom mt={2}>
                  Parallelization Opportunities: {data.parallelize.length}
                </Typography>
              </>
            )}

            {data.remove?.length > 0 && (
              <>
                <Typography variant="subtitle2" gutterBottom mt={2}>
                  Redundant Steps: {data.remove.length}
                </Typography>
              </>
            )}
          </>
        );
      }
    };

    return (
      <Dialog
        open={approvalDialogOpen}
        onClose={() => setApprovalDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Review Recommendation
          <Chip
            label={selectedRecommendation.type.replace(/_/g, ' ')}
            size="small"
            color="primary"
            sx={{ ml: 2 }}
          />
        </DialogTitle>
        <DialogContent dividers>
          {renderDetails()}

          <TextField
            label="Approval Notes (optional)"
            multiline
            rows={3}
            fullWidth
            value={approvalNotes}
            onChange={(e) => setApprovalNotes(e.target.value)}
            sx={{ mt: 3 }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => handleApprove(false)}
            color="error"
            startIcon={<Cancel />}
            disabled={loading}
          >
            Reject
          </Button>
          <Button
            onClick={() => handleApprove(true)}
            color="primary"
            variant="contained"
            startIcon={<CheckCircle />}
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Approve & Apply'}
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Feedback Loops Dashboard</Typography>
        <Button
          startIcon={<Refresh />}
          onClick={() => {
            fetchStats();
            fetchPendingRecommendations();
          }}
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Statistics Cards */}
      {stats && (
        <Grid container spacing={3} mb={4}>
          <Grid item xs={12} md={4}>
            {renderStatsCard('Prompt Refinement', stats.prompt_refinement, <TrendingUp color="primary" />)}
          </Grid>
          <Grid item xs={12} md={4}>
            {renderStatsCard('Tool Tuning', stats.tool_tuning, <Settings color="primary" />)}
          </Grid>
          <Grid item xs={12} md={4}>
            {renderStatsCard('Workflow Optimizer', stats.workflow_optimizer, <Speed color="primary" />)}
          </Grid>
        </Grid>
      )}

      {/* Pending Approvals */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Pending Approvals ({pendingRecommendations.length})
          </Typography>

          {pendingRecommendations.length === 0 ? (
            <Alert severity="info">No pending approvals</Alert>
          ) : (
            <>
              <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
                <Tab label="All" />
                <Tab label="Prompt Refinement" />
                <Tab label="Tool Tuning" />
                <Tab label="Workflow Optimization" />
              </Tabs>

              <List>
                {pendingRecommendations
                  .filter(rec => {
                    if (activeTab === 0) return true;
                    if (activeTab === 1) return rec.type === 'prompt_refinement';
                    if (activeTab === 2) return rec.type === 'tool_tuning';
                    if (activeTab === 3) return rec.type === 'workflow_optimization';
                    return true;
                  })
                  .map(renderRecommendation)}
              </List>
            </>
          )}
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      {renderApprovalDialog()}
    </Box>
  );
};

export default FeedbackLoopsDashboard;
