import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface TimeSeriesData {
  timestamp: string;
  value: number;
  label?: string;
}

interface BarData {
  name: string;
  value: number;
  fill?: string;
}

interface PieData {
  name: string;
  value: number;
  color?: string;
  [key: string]: string | number | undefined;
}

interface UsageChartProps {
  data: TimeSeriesData[];
  title?: string;
  color?: string;
}

interface CostBreakdownProps {
  data: PieData[];
  title?: string;
}

interface AgentCostBarProps {
  data: BarData[];
  title?: string;
}

interface BudgetBurnRateProps {
  data: TimeSeriesData[];
  budgetLimit: number;
  title?: string;
}

const COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#06b6d4', '#ef4444', '#f97316'
];

export const UsageTimeSeriesChart: React.FC<UsageChartProps> = ({
  data,
  title = 'API Usage Over Time',
  color = '#3b82f6'
}) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.8}/>
              <stop offset="95%" stopColor={color} stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px'
            }}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fillOpacity={1}
            fill="url(#colorUsage)"
            name="API Calls"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const CostBreakdownPieChart: React.FC<CostBreakdownProps> = ({
  data,
  title = 'Cost Breakdown by Agent Role'
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const renderLabel = (entry: any) => {
    const percent = ((entry.value / total) * 100).toFixed(1);
    return `${entry.name}: ${percent}%`;
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderLabel}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => `$${value.toFixed(2)}`}
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px'
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {data.map((entry, index) => (
          <div key={entry.name} className="flex items-center text-sm">
            <div
              className="w-3 h-3 rounded-full mr-2"
              style={{ backgroundColor: entry.color || COLORS[index % COLORS.length] }}
            />
            <span className="text-gray-700">{entry.name}: ${entry.value.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const TopAgentsCostBarChart: React.FC<AgentCostBarProps> = ({
  data,
  title = 'Top 10 Agents by Cost'
}) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data} layout="horizontal">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis
            dataKey="name"
            type="category"
            width={120}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            formatter={(value: number) => `$${value.toFixed(2)}`}
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px'
            }}
          />
          <Bar dataKey="value" fill="#3b82f6" name="Cost">
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.fill || COLORS[index % COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const BudgetBurnRateChart: React.FC<BudgetBurnRateProps> = ({
  data,
  budgetLimit,
  title = 'Budget Burn Rate'
}) => {
  const maxValue = Math.max(...data.map(d => d.value), budgetLimit);

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            domain={[0, maxValue * 1.1]}
          />
          <Tooltip
            formatter={(value: number) => `$${value.toFixed(2)}`}
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px'
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#3b82f6"
            strokeWidth={2}
            name="Actual Spend"
            dot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey={() => budgetLimit}
            stroke="#ef4444"
            strokeWidth={2}
            strokeDasharray="5 5"
            name="Budget Limit"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-4 flex justify-between text-sm">
        <div className="flex items-center">
          <div className="w-4 h-0.5 bg-blue-500 mr-2" />
          <span className="text-gray-700">Actual Spend</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-0.5 bg-red-500 mr-2 border-dashed border-t-2" />
          <span className="text-gray-700">Budget Limit: ${budgetLimit.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

export const TokenUsageChart: React.FC<UsageChartProps> = ({
  data,
  title = 'Token Usage Over Time'
}) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value: number) => value.toLocaleString()}
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px'
            }}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#8b5cf6"
            fillOpacity={1}
            fill="url(#colorTokens)"
            name="Tokens"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
