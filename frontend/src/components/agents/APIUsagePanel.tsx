import React, { useState, useEffect } from 'react';
import { Activity, Zap, AlertCircle, TrendingUp } from 'lucide-react';

interface APIMetrics {
  total_calls: number;
  today_calls: number;
  tokens_used: number;
  today_tokens: number;
  rate_limit_percentage: number;
  requests_per_minute: number;
  average_latency_ms: number;
  error_rate: number;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
  color?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  trend = 'neutral',
  icon,
  color = 'blue'
}) => {
  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-600'
  };

  const bgColors: Record<string, string> = {
    blue: 'bg-blue-50',
    purple: 'bg-purple-50',
    green: 'bg-green-50',
    yellow: 'bg-yellow-50'
  };

  const iconColors: Record<string, string> = {
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    green: 'text-green-600',
    yellow: 'text-yellow-600'
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {change && (
            <div className={`flex items-center mt-2 text-sm ${trendColors[trend]}`}>
              {trend === 'up' && <TrendingUp className="w-4 h-4 mr-1" />}
              {trend === 'down' && <TrendingUp className="w-4 h-4 mr-1 rotate-180" />}
              <span>{change}</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${bgColors[color]}`}>
          <div className={iconColors[color]}>{icon}</div>
        </div>
      </div>
    </div>
  );
};

interface RateLimitProgressProps {
  percentage: number;
  label: string;
}

const RateLimitProgress: React.FC<RateLimitProgressProps> = ({ percentage, label }) => {
  const getColor = () => {
    if (percentage < 70) return 'bg-green-500';
    if (percentage < 90) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getTextColor = () => {
    if (percentage < 70) return 'text-green-700';
    if (percentage < 90) return 'text-yellow-700';
    return 'text-red-700';
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-600">Rate Limit Usage</p>
        <span className={`text-lg font-bold ${getTextColor()}`}>
          {percentage.toFixed(1)}%
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
        <div
          className={`h-full ${getColor()} transition-all duration-500`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-2">{label}</p>
    </div>
  );
};

interface APIUsagePanelProps {
  className?: string;
}

export const APIUsagePanel: React.FC<APIUsagePanelProps> = ({ className = '' }) => {
  const [metrics, setMetrics] = useState<APIMetrics>({
    total_calls: 0,
    today_calls: 0,
    tokens_used: 0,
    today_tokens: 0,
    rate_limit_percentage: 0,
    requests_per_minute: 0,
    average_latency_ms: 0,
    error_rate: 0
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/v1/metrics/aggregate');
      if (!response.ok) {
        throw new Error('Failed to fetch API metrics');
      }
      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

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
          <AlertCircle className="w-5 h-5 mr-2" />
          <p>Error loading API metrics: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">API Usage Dashboard</h2>
        <p className="text-gray-600">Real-time monitoring of API calls, tokens, and rate limits</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <MetricCard
          title="Total API Calls"
          value={formatNumber(metrics.total_calls)}
          change={`+${formatNumber(metrics.today_calls)} today`}
          trend="up"
          icon={<Activity className="w-6 h-6" />}
          color="blue"
        />

        <MetricCard
          title="Tokens Used"
          value={formatNumber(metrics.tokens_used)}
          change={`+${formatNumber(metrics.today_tokens)} today`}
          trend="up"
          icon={<Zap className="w-6 h-6" />}
          color="purple"
        />

        <MetricCard
          title="Requests/Minute"
          value={metrics.requests_per_minute.toFixed(1)}
          change={metrics.requests_per_minute > 50 ? 'High load' : 'Normal'}
          trend={metrics.requests_per_minute > 50 ? 'up' : 'neutral'}
          icon={<TrendingUp className="w-6 h-6" />}
          color="green"
        />

        <MetricCard
          title="Avg Latency"
          value={`${metrics.average_latency_ms.toFixed(0)}ms`}
          change={metrics.average_latency_ms > 200 ? 'Slow' : 'Fast'}
          trend={metrics.average_latency_ms > 200 ? 'down' : 'up'}
          icon={<Activity className="w-6 h-6" />}
          color="yellow"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RateLimitProgress
          percentage={metrics.rate_limit_percentage}
          label={`${metrics.rate_limit_percentage < 70 ? 'Within safe limits' :
                   metrics.rate_limit_percentage < 90 ? 'Approaching limit' :
                   'Critical - near rate limit'}`}
        />

        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-600">Error Rate</p>
            <span className={`text-lg font-bold ${
              metrics.error_rate < 1 ? 'text-green-700' :
              metrics.error_rate < 5 ? 'text-yellow-700' :
              'text-red-700'
            }`}>
              {metrics.error_rate.toFixed(2)}%
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Success Rate:</span>
              <span className="font-semibold text-green-700">
                {(100 - metrics.error_rate).toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Failed Requests:</span>
              <span className="font-semibold text-red-700">
                {Math.round((metrics.total_calls * metrics.error_rate) / 100)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 text-right">
        <button
          onClick={fetchMetrics}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh Metrics
        </button>
      </div>
    </div>
  );
};

export default APIUsagePanel;
