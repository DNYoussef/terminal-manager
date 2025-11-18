import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Download, FileSpreadsheet, Mail, RefreshCw } from 'lucide-react';
import APIUsagePanel from './APIUsagePanel';
import CostDashboard from './CostDashboard';
import BudgetAlerts from './BudgetAlerts';
import {
  UsageTimeSeriesChart,
  TokenUsageChart,
  CostBreakdownPieChart,
  TopAgentsCostBarChart,
  BudgetBurnRateChart
} from './Charts';

interface ResourceMonitorsProps {
  className?: string;
}

interface ChartData {
  usageTimeSeries: Array<{ timestamp: string; value: number }>;
  tokenUsage: Array<{ timestamp: string; value: number }>;
  costBreakdown: Array<{ name: string; value: number; color?: string }>;
  topAgents: Array<{ name: string; value: number; fill?: string }>;
  burnRate: Array<{ timestamp: string; value: number }>;
  budgetLimit: number;
}

export const ResourceMonitors: React.FC<ResourceMonitorsProps> = ({ className = '' }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [chartData, setChartData] = useState<ChartData>({
    usageTimeSeries: [],
    tokenUsage: [],
    costBreakdown: [],
    topAgents: [],
    burnRate: [],
    budgetLimit: 1000
  });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchChartData();
    const interval = setInterval(fetchChartData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchChartData = async () => {
    try {
      setLoading(true);
      const [usageRes, costRes, budgetRes] = await Promise.all([
        fetch('/api/v1/metrics/aggregate?period=7d'),
        fetch('/api/v1/agents/stats/summary'),
        fetch('/api/v1/agents/stats/history?days=30')
      ]);

      if (!usageRes.ok || !costRes.ok || !budgetRes.ok) {
        throw new Error('Failed to fetch chart data');
      }

      const usageData = await usageRes.json();
      const costData = await costRes.json();
      const budgetData = await budgetRes.json();

      setChartData({
        usageTimeSeries: usageData.timeSeries || [],
        tokenUsage: usageData.tokenTimeSeries || [],
        costBreakdown: costData.breakdown || [],
        topAgents: costData.topAgents || [],
        burnRate: budgetData.burnRate || [],
        budgetLimit: costData.budget_limit || 1000
      });
    } catch (err) {
      console.error('Error fetching chart data:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = async () => {
    try {
      setExporting(true);
      const response = await fetch('/api/v1/metrics/export?format=csv');
      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `budget-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error exporting data:', err);
      alert('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const generateReport = async (period: 'daily' | 'weekly' | 'monthly') => {
    try {
      const response = await fetch(`/api/v1/metrics/report?period=${period}`);
      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `budget-report-${period}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error generating report:', err);
      alert('Failed to generate report');
    }
  };

  const sendEmailAlert = async () => {
    try {
      const response = await fetch('/api/v1/metrics/email-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: 'weekly' })
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      alert('Email report sent successfully');
    } catch (err) {
      console.error('Error sending email:', err);
      alert('Failed to send email report');
    }
  };

  return (
    <div className={`${className} p-6`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Resource Monitors</h1>
          <p className="text-gray-600 mt-2">
            Comprehensive monitoring of API usage, costs, and budgets
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchChartData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <div className="relative group">
            <button
              onClick={exportToCSV}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>

            <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={() => generateReport('daily')}
                className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 w-full text-left"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Daily Report</span>
              </button>
              <button
                onClick={() => generateReport('weekly')}
                className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 w-full text-left"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Weekly Report</span>
              </button>
              <button
                onClick={() => generateReport('monthly')}
                className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 w-full text-left"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Monthly Report</span>
              </button>
              <hr className="my-1" />
              <button
                onClick={sendEmailAlert}
                className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 w-full text-left"
              >
                <Mail className="w-4 h-4" />
                <span>Email Report</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white border border-gray-200 p-1 rounded-lg">
          <TabsTrigger
            value="overview"
            className="px-6 py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-colors"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="api-usage"
            className="px-6 py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-colors"
          >
            API Usage
          </TabsTrigger>
          <TabsTrigger
            value="costs"
            className="px-6 py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-colors"
          >
            Costs
          </TabsTrigger>
          <TabsTrigger
            value="alerts"
            className="px-6 py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-colors"
          >
            Alerts
          </TabsTrigger>
          <TabsTrigger
            value="charts"
            className="px-6 py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-colors"
          >
            Charts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <APIUsagePanel />
            <CostDashboard />
          </div>
          <BudgetAlerts />
        </TabsContent>

        <TabsContent value="api-usage">
          <APIUsagePanel />
        </TabsContent>

        <TabsContent value="costs">
          <CostDashboard />
        </TabsContent>

        <TabsContent value="alerts">
          <BudgetAlerts />
        </TabsContent>

        <TabsContent value="charts" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <UsageTimeSeriesChart
              data={chartData.usageTimeSeries}
              title="API Usage Over Last 7 Days"
              color="#3b82f6"
            />
            <TokenUsageChart
              data={chartData.tokenUsage}
              title="Token Usage Over Last 7 Days"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CostBreakdownPieChart
              data={chartData.costBreakdown}
              title="Cost Distribution by Agent Role"
            />
            <TopAgentsCostBarChart
              data={chartData.topAgents}
              title="Top 10 Agents by Cost"
            />
          </div>

          <BudgetBurnRateChart
            data={chartData.burnRate}
            budgetLimit={chartData.budgetLimit}
            title="30-Day Budget Burn Rate"
          />
        </TabsContent>
      </Tabs>

      {loading && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
            <p className="mt-4 text-gray-700">Loading data...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResourceMonitors;
