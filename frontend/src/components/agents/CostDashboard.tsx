import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

interface CostMetrics {
  total_spent: number;
  daily_average: number;
  monthly_projection: number;
  budget_remaining: number;
  budget_limit: number;
}

interface AgentBudget {
  agent_id: string;
  agent_name: string;
  role: string;
  budget_used: number;
  budget_limit: number;
  status: 'ok' | 'warning' | 'critical' | 'exceeded';
}

interface BudgetStatus {
  percentage: number;
  status: 'ok' | 'warning' | 'critical' | 'exceeded';
  color: string;
  bgColor: string;
  textColor: string;
  icon: React.ReactNode;
}

const getBudgetStatus = (used: number, limit: number): BudgetStatus => {
  const percentage = (used / limit) * 100;

  if (percentage >= 100) {
    return {
      percentage,
      status: 'exceeded',
      color: 'bg-red-500',
      bgColor: 'bg-red-50',
      textColor: 'text-red-700',
      icon: <AlertTriangle className="w-4 h-4" />
    };
  }
  if (percentage >= 90) {
    return {
      percentage,
      status: 'critical',
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-700',
      icon: <AlertTriangle className="w-4 h-4" />
    };
  }
  if (percentage >= 70) {
    return {
      percentage,
      status: 'warning',
      color: 'bg-yellow-500',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-700',
      icon: <AlertTriangle className="w-4 h-4" />
    };
  }
  return {
    percentage,
    status: 'ok',
    color: 'bg-green-500',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    icon: <CheckCircle className="w-4 h-4" />
  };
};

interface BudgetBarProps {
  agent: AgentBudget;
}

const BudgetBar: React.FC<BudgetBarProps> = ({ agent }) => {
  const budgetStatus = getBudgetStatus(agent.budget_used, agent.budget_limit);

  return (
    <div className={`p-4 rounded-lg border ${budgetStatus.bgColor} border-gray-200 mb-3`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-900">{agent.agent_name}</h4>
            <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
              {agent.role}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">ID: {agent.agent_id}</p>
        </div>
        <div className={`flex items-center gap-1 ${budgetStatus.textColor}`}>
          {budgetStatus.icon}
          <span className="text-sm font-semibold">
            {budgetStatus.percentage.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden mb-2">
        <div
          className={`h-full ${budgetStatus.color} transition-all duration-500`}
          style={{ width: `${Math.min(budgetStatus.percentage, 100)}%` }}
        />
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-gray-600">
          Used: <span className="font-semibold">${agent.budget_used.toFixed(2)}</span>
        </span>
        <span className="text-gray-600">
          Limit: <span className="font-semibold">${agent.budget_limit.toFixed(2)}</span>
        </span>
        <span className={budgetStatus.textColor}>
          Remaining: <span className="font-semibold">
            ${Math.max(0, agent.budget_limit - agent.budget_used).toFixed(2)}
          </span>
        </span>
      </div>

      {budgetStatus.status === 'exceeded' && (
        <div className="mt-2 text-xs text-red-700 bg-red-100 p-2 rounded">
          Budget exceeded - operations paused
        </div>
      )}
      {budgetStatus.status === 'critical' && (
        <div className="mt-2 text-xs text-orange-700 bg-orange-100 p-2 rounded">
          Critical - approaching budget limit
        </div>
      )}
      {budgetStatus.status === 'warning' && (
        <div className="mt-2 text-xs text-yellow-700 bg-yellow-100 p-2 rounded">
          Warning - 70% of budget used
        </div>
      )}
    </div>
  );
};

interface CostOverviewProps {
  metrics: CostMetrics;
}

const CostOverview: React.FC<CostOverviewProps> = ({ metrics }) => {
  const budgetPercentage = (metrics.total_spent / metrics.budget_limit) * 100;
  const onTrack = metrics.monthly_projection <= metrics.budget_limit;

  return (
    <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-6 rounded-lg shadow-lg text-white">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <DollarSign className="w-5 h-5" />
        Cost Overview
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div>
          <p className="text-blue-100 text-sm mb-1">Total Spent</p>
          <p className="text-4xl font-bold">${metrics.total_spent.toFixed(2)}</p>
          <p className="text-blue-100 text-sm mt-1">
            {budgetPercentage.toFixed(1)}% of budget
          </p>
        </div>

        <div>
          <p className="text-blue-100 text-sm mb-1">Daily Average</p>
          <p className="text-4xl font-bold">${metrics.daily_average.toFixed(2)}</p>
          <p className="text-blue-100 text-sm mt-1">per day</p>
        </div>

        <div>
          <p className="text-blue-100 text-sm mb-1">Monthly Projection</p>
          <p className="text-4xl font-bold">${metrics.monthly_projection.toFixed(2)}</p>
          <div className={`flex items-center gap-1 text-sm mt-1 ${
            onTrack ? 'text-green-300' : 'text-red-300'
          }`}>
            <TrendingUp className={`w-4 h-4 ${onTrack ? '' : 'rotate-180'}`} />
            <span>{onTrack ? 'On track' : 'Over budget'}</span>
          </div>
        </div>
      </div>

      <div className="bg-white/10 rounded-lg p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-blue-100 text-sm">Budget Remaining</span>
          <span className="text-xl font-bold">
            ${metrics.budget_remaining.toFixed(2)}
          </span>
        </div>
        <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-white transition-all duration-500"
            style={{ width: `${Math.min((metrics.budget_remaining / metrics.budget_limit) * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-blue-100 mt-1">
          <span>${metrics.total_spent.toFixed(2)}</span>
          <span>${metrics.budget_limit.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

interface CostDashboardProps {
  className?: string;
}

export const CostDashboard: React.FC<CostDashboardProps> = ({ className = '' }) => {
  const [metrics, setMetrics] = useState<CostMetrics>({
    total_spent: 0,
    daily_average: 0,
    monthly_projection: 0,
    budget_remaining: 0,
    budget_limit: 1000
  });

  const [agentBudgets, setAgentBudgets] = useState<AgentBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'usage' | 'percentage' | 'name'>('percentage');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [metricsRes, budgetsRes] = await Promise.all([
        fetch('/api/v1/agents/stats/summary'),
        fetch('/api/v1/agents')
      ]);

      if (!metricsRes.ok || !budgetsRes.ok) {
        throw new Error('Failed to fetch budget data');
      }

      const metricsData = await metricsRes.json();
      const budgetsData = await budgetsRes.json();

      setMetrics(metricsData);
      setAgentBudgets(budgetsData.agents || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const sortedAgents = [...agentBudgets].sort((a, b) => {
    if (sortBy === 'usage') {
      return b.budget_used - a.budget_used;
    }
    if (sortBy === 'percentage') {
      const aPercentage = (a.budget_used / a.budget_limit) * 100;
      const bPercentage = (b.budget_used / b.budget_limit) * 100;
      return bPercentage - aPercentage;
    }
    return a.agent_name.localeCompare(b.agent_name);
  });

  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center p-12`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className} bg-red-50 border border-red-200 rounded-lg p-6`}>
        <div className="flex items-center text-red-800">
          <AlertTriangle className="w-5 h-5 mr-2" />
          <p>Error loading cost data: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Cost Dashboard</h2>
        <p className="text-gray-600">Monitor spending, budgets, and cost projections</p>
      </div>

      <div className="mb-6">
        <CostOverview metrics={metrics} />
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Agent Budget Breakdown</h3>
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="percentage">Sort by % Used</option>
              <option value="usage">Sort by $ Spent</option>
              <option value="name">Sort by Name</option>
            </select>
          </div>
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {sortedAgents.map(agent => (
            <BudgetBar key={agent.agent_id} agent={agent} />
          ))}
        </div>

        {agentBudgets.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No agent budget data available
          </div>
        )}
      </div>

      <div className="mt-4 text-right">
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh Data
        </button>
      </div>
    </div>
  );
};

export default CostDashboard;
