import React, { useState } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Chip,
  Box,
  Typography,
  TextField,
  InputAdornment
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import RemoveIcon from '@mui/icons-material/Remove';

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

interface AgentQualityTableProps {
  agents: AgentQuality[];
}

type SortField = 'name' | 'role' | 'quality_score' | 'grade' | 'violations' | 'trend';
type SortOrder = 'asc' | 'desc';

const AgentQualityTable: React.FC<AgentQualityTableProps> = ({ agents }) => {
  const [sortField, setSortField] = useState<SortField>('quality_score');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 90) return '#4caf50';
    if (score >= 80) return '#8bc34a';
    if (score >= 70) return '#ffc107';
    if (score >= 60) return '#ff9800';
    return '#f44336';
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

  const getTrendIcon = (trend: number) => {
    if (trend > 0) {
      return <TrendingUpIcon sx={{ color: '#4caf50', fontSize: 18 }} />;
    } else if (trend < 0) {
      return <TrendingDownIcon sx={{ color: '#f44336', fontSize: 18 }} />;
    } else {
      return <RemoveIcon sx={{ color: '#9e9e9e', fontSize: 18 }} />;
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
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const sortedAgents = [...agents]
    .filter(agent => {
      const query = searchQuery.toLowerCase();
      return agent.name.toLowerCase().includes(query) ||
             agent.role.toLowerCase().includes(query);
    })
    .sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'name' || sortField === 'role' || sortField === 'grade') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  return (
    <Paper sx={{ p: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">
          Agent Quality Scores
        </Typography>
        <TextField
          placeholder="Search agents..."
          size="small"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
          sx={{ width: 300 }}
        />
      </Box>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'name'}
                  direction={sortField === 'name' ? sortOrder : 'asc'}
                  onClick={() => handleSort('name')}
                >
                  Agent Name
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'role'}
                  direction={sortField === 'role' ? sortOrder : 'asc'}
                  onClick={() => handleSort('role')}
                >
                  Role
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">
                <TableSortLabel
                  active={sortField === 'quality_score'}
                  direction={sortField === 'quality_score' ? sortOrder : 'asc'}
                  onClick={() => handleSort('quality_score')}
                >
                  Quality Score
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">
                <TableSortLabel
                  active={sortField === 'grade'}
                  direction={sortField === 'grade' ? sortOrder : 'asc'}
                  onClick={() => handleSort('grade')}
                >
                  Grade
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">
                <TableSortLabel
                  active={sortField === 'violations'}
                  direction={sortField === 'violations' ? sortOrder : 'asc'}
                  onClick={() => handleSort('violations')}
                >
                  Violations
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">
                <TableSortLabel
                  active={sortField === 'trend'}
                  direction={sortField === 'trend' ? sortOrder : 'asc'}
                  onClick={() => handleSort('trend')}
                >
                  Trend
                </TableSortLabel>
              </TableCell>
              <TableCell>
                Last Analysis
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedAgents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="textSecondary">
                    {searchQuery ? 'No agents match your search' : 'No agent quality data available'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              sortedAgents.map((agent) => (
                <TableRow
                  key={agent.id}
                  sx={{
                    '&:hover': {
                      bgcolor: '#f5f5f5',
                      cursor: 'pointer'
                    }
                  }}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {agent.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={agent.role}
                      size="small"
                      sx={{ bgcolor: '#e3f2fd', color: '#1976d2' }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Typography
                      variant="body1"
                      fontWeight="bold"
                      sx={{ color: getScoreColor(agent.quality_score) }}
                    >
                      {agent.quality_score}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={agent.grade}
                      size="small"
                      sx={{
                        bgcolor: getGradeColor(agent.grade),
                        color: 'white',
                        fontWeight: 'bold',
                        minWidth: 40
                      }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={agent.violations}
                      size="small"
                      color={agent.violations === 0 ? 'success' : agent.violations < 5 ? 'warning' : 'error'}
                      sx={{ minWidth: 40 }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
                      {getTrendIcon(agent.trend)}
                      <Typography
                        variant="body2"
                        sx={{
                          color: agent.trend > 0 ? '#4caf50' : agent.trend < 0 ? '#f44336' : '#9e9e9e'
                        }}
                      >
                        {agent.trend !== 0 && (agent.trend > 0 ? '+' : '')}{agent.trend}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="textSecondary">
                      {formatTimestamp(agent.last_analysis)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Summary Statistics */}
      <Box display="flex" gap={4} mt={3} justifyContent="center">
        <Box textAlign="center">
          <Typography variant="h4" color="primary">
            {agents.length}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            Total Agents
          </Typography>
        </Box>
        <Box textAlign="center">
          <Typography variant="h4" color="success.main">
            {agents.filter(a => a.grade === 'A' || a.grade === 'B').length}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            High Quality
          </Typography>
        </Box>
        <Box textAlign="center">
          <Typography variant="h4" color="warning.main">
            {agents.filter(a => a.violations > 0).length}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            With Violations
          </Typography>
        </Box>
        <Box textAlign="center">
          <Typography variant="h4" sx={{ color: getScoreColor(
            Math.round(agents.reduce((sum, a) => sum + a.quality_score, 0) / agents.length || 0)
          )}}>
            {Math.round(agents.reduce((sum, a) => sum + a.quality_score, 0) / agents.length || 0)}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            Average Score
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default AgentQualityTable;
