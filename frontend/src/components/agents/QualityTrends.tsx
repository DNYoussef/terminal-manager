import React, { useState, useEffect } from 'react';
import { Card } from '../design-system/Card';
import { Badge } from '../design-system/Badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../design-system/Select';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart
} from 'recharts';

interface QualityDataPoint {
  date: string;
  score: number;
  average: number;
  min: number;
  max: number;
  events: {
    type: 'quality_gate' | 'code_review' | 'deployment';
    label: string;
  }[];
}

const QualityTrends: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [data, setData] = useState<QualityDataPoint[]>([]);
  const [stats, setStats] = useState({
    current: 0,
    average: 0,
    min: 0,
    max: 0,
    trend: 0
  });

  useEffect(() => {
    fetchQualityTrends();
  }, [timeRange]);

  const fetchQualityTrends = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/v1/metrics/quality/trends?range=${timeRange}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch quality trends: ${response.statusText}`);
      }

      const result = await response.json();
      setData(result.data || []);
      setStats(result.stats || { current: 0, average: 0, min: 0, max: 0, trend: 0 });

    } catch (err) {
      console.error('Error fetching quality trends:', err);
      setError(err instanceof Error ? err.message : 'Failed to load quality trends');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Card className="border border-border">
          <p className="text-sm font-semibold mb-2">{formatDate(label)}</p>
          <p className="text-sm text-accent-primary">
            Score: {payload[0].value}
          </p>
          <p className="text-sm text-text-secondary">
            Average: {data.average}
          </p>
          <p className="text-sm text-text-secondary">
            Range: {data.min} - {data.max}
          </p>
          {data.events && data.events.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {data.events.map((event: any, idx: number) => (
                <Badge key={idx} variant="secondary">
                  {event.label}
                </Badge>
              ))}
            </div>
          )}
        </Card>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-accent-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <Card>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-text-primary">
          Quality Score Trends
        </h3>
        <Select value={timeRange} onValueChange={(value) => setTimeRange(value as '7d' | '30d' | '90d')}>
          <SelectTrigger size="sm" className="w-[180px]">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-6 mb-6">
        <div>
          <p className="text-xs text-text-secondary mb-1">Current Score</p>
          <p className="text-3xl font-bold text-accent-primary">{stats.current}</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary mb-1">Average</p>
          <p className="text-3xl font-bold text-text-primary">{stats.average}</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary mb-1">Min / Max</p>
          <p className="text-3xl font-bold text-text-primary">{stats.min} / {stats.max}</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary mb-1">Trend</p>
          <p className={`text-3xl font-bold ${stats.trend > 0 ? 'text-green-600' : stats.trend < 0 ? 'text-red-600' : 'text-text-primary'}`}>
            {stats.trend > 0 ? '+' : ''}{stats.trend}%
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id="colorRange" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8884d8" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            style={{ fontSize: '0.75rem' }}
          />
          <YAxis
            domain={[0, 100]}
            style={{ fontSize: '0.75rem' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />

          <Area
            type="monotone"
            dataKey="max"
            stroke="none"
            fill="url(#colorRange)"
            name="Range"
          />
          <Area
            type="monotone"
            dataKey="min"
            stroke="none"
            fill="#ffffff"
          />

          <Line
            type="monotone"
            dataKey="average"
            stroke="#9e9e9e"
            strokeDasharray="5 5"
            dot={false}
            name="Average"
          />

          <Line
            type="monotone"
            dataKey="score"
            stroke="#1976d2"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            name="Quality Score"
          />

          <ReferenceLine y={70} stroke="#ff9800" strokeDasharray="3 3" label="Threshold" />
          <ReferenceLine y={90} stroke="#4caf50" strokeDasharray="3 3" label="Excellent" />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-6 flex gap-2 flex-wrap">
        <p className="text-xs text-text-secondary mr-2">Events:</p>
        <Badge variant="error">Quality Gate Failure</Badge>
        <Badge variant="info">Code Review</Badge>
        <Badge variant="success">Deployment</Badge>
      </div>

      {data.length === 0 && (
        <div className="text-center py-12">
          <h4 className="text-lg font-semibold text-text-secondary mb-2">
            No quality trend data available
          </h4>
          <p className="text-sm text-text-secondary">
            Quality metrics will appear here as agents complete tasks
          </p>
        </div>
      )}
    </Card>
  );
};

export default QualityTrends;
