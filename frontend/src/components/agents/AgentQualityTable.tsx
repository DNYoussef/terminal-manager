import React, { useState } from 'react';
import { Search, TrendingUp, TrendingDown, Minus } from 'lucide-react';

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

  const getScoreColorClass = (score: number): string => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-lime-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 60) return 'text-orange-500';
    return 'text-red-500';
  };

  const getGradeColorClass = (grade: string): string => {
    switch (grade) {
      case 'A': return 'bg-green-500';
      case 'B': return 'bg-lime-500';
      case 'C': return 'bg-yellow-500';
      case 'D': return 'bg-orange-500';
      case 'F': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) {
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    } else if (trend < 0) {
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    } else {
      return <Minus className="w-4 h-4 text-gray-400" />;
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

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? <span>↑</span> : <span>↓</span>;
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h6 className="text-lg font-semibold text-gray-800">
          Agent Quality Scores
        </h6>
        <div className="relative w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search agents..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('name')}
              >
                Agent Name <SortIcon field="name" />
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('role')}
              >
                Role <SortIcon field="role" />
              </th>
              <th 
                className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('quality_score')}
              >
                Quality Score <SortIcon field="quality_score" />
              </th>
              <th 
                className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('grade')}
              >
                Grade <SortIcon field="grade" />
              </th>
              <th 
                className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('violations')}
              >
                Violations <SortIcon field="violations" />
              </th>
              <th 
                className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('trend')}
              >
                Trend <SortIcon field="trend" />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Analysis
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedAgents.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  {searchQuery ? 'No agents match your search' : 'No agent quality data available'}
                </td>
              </tr>
            ) : (
              sortedAgents.map((agent) => (
                <tr 
                  key={agent.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900">{agent.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {agent.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className={`text-sm font-bold ${getScoreColorClass(agent.quality_score)}`}>
                      {agent.quality_score}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs font-bold text-white min-w-[40px] ${getGradeColorClass(agent.grade)}`}>
                      {agent.grade}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs font-medium min-w-[40px] ${
                      agent.violations === 0 ? 'bg-green-100 text-green-800' : 
                      agent.violations < 5 ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-red-100 text-red-800'
                    }`}>
                      {agent.violations}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-1">
                      {getTrendIcon(agent.trend)}
                      <span className={`text-sm ${
                        agent.trend > 0 ? 'text-green-600' : 
                        agent.trend < 0 ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {agent.trend !== 0 && (agent.trend > 0 ? '+' : '')}{agent.trend}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatTimestamp(agent.last_analysis)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Statistics */}
      <div className="flex gap-8 mt-6 justify-center">
        <div className="text-center">
          <div className="text-3xl font-bold text-blue-600">
            {agents.length}
          </div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">
            Total Agents
          </div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-green-600">
            {agents.filter(a => a.grade === 'A' || a.grade === 'B').length}
          </div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">
            High Quality
          </div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-orange-500">
            {agents.filter(a => a.violations > 0).length}
          </div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">
            With Violations
          </div>
        </div>
        <div className="text-center">
          <div className={`text-3xl font-bold ${getScoreColorClass(
            Math.round(agents.reduce((sum, a) => sum + a.quality_score, 0) / agents.length || 0)
          )}`}>
            {Math.round(agents.reduce((sum, a) => sum + a.quality_score, 0) / agents.length || 0)}
          </div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">
            Average Score
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentQualityTable;