# Metrics Aggregation Service - Complete Guide

## Overview

The Metrics Aggregation Service provides comprehensive analytics, cost optimization, and performance insights for agent operations.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Metrics Aggregation                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Time-Series │  │    Agent     │  │     Role     │  │
│  │ Aggregation  │  │ Aggregation  │  │ Aggregation  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │    Trend     │  │  Percentiles │  │   Outliers   │  │
│  │  Detection   │  │              │  │  Detection   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Cost Optimization Recommendations         │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │            Performance Insights                   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
                            │
                    ┌───────┴───────┐
                    │               │
            ┌───────▼──────┐  ┌────▼────────┐
            │    Cache     │  │  Background │
            │   Service    │  │    Jobs     │
            └──────────────┘  └─────────────┘
```

## Database Models

### AgentMetric
Stores individual agent performance metrics:
- Execution time
- Token usage
- API calls
- Success/failure
- Quality scores
- Costs

### BudgetAllocation
Tracks agent budgets:
- Total budget
- Used budget
- Utilization percentage
- Thresholds (warning, critical)
- Status

### MetricsAggregation
Pre-calculated aggregations:
- Time-series data
- Agent summaries
- Role summaries
- Statistics (mean, median, percentiles)

### CostRecommendation
Cost optimization suggestions:
- Reduce budget
- Increase capacity
- Pause agent
- Review performance

### PerformanceAlert
Automated alerts:
- Budget overruns
- Performance degradation
- Outliers
- Anomalies

## API Endpoints

### Time-Series Aggregation

```http
GET /api/v1/metrics/aggregate/timeseries
  ?start_date=2025-11-01T00:00:00Z
  &end_date=2025-11-17T23:59:59Z
  &granularity=day
```

**Granularity options:**
- `hour` - Hourly aggregation
- `day` - Daily aggregation (default)
- `week` - Weekly aggregation
- `month` - Monthly aggregation

**Response:**
```json
{
  "success": true,
  "period": {
    "start": "2025-11-01T00:00:00Z",
    "end": "2025-11-17T23:59:59Z",
    "granularity": "day"
  },
  "count": 17,
  "data": [
    {
      "timestamp": "2025-11-01T00:00:00Z",
      "total_operations": 150,
      "successful_operations": 142,
      "failed_operations": 8,
      "success_rate": 94.67,
      "avg_execution_time_ms": 245.32,
      "total_tokens": 45000,
      "total_cost_usd": 1.23,
      "avg_quality_score": 87.5
    }
  ]
}
```

### Agent-Level Aggregation

```http
GET /api/v1/metrics/aggregate/by-agent/{agent_id}
  ?start_date=2025-11-01T00:00:00Z
  &end_date=2025-11-17T23:59:59Z
```

**Response:**
```json
{
  "success": true,
  "data": {
    "agent_id": 1,
    "agent_name": "coder",
    "agent_role": "developer",
    "period": {
      "start": "2025-11-01T00:00:00Z",
      "end": "2025-11-17T23:59:59Z"
    },
    "tasks": {
      "total": 85,
      "successful": 80,
      "failed": 5,
      "success_rate": 94.12
    },
    "performance": {
      "avg_execution_time_ms": 325.45,
      "median_execution_time_ms": 298.12,
      "p95_execution_time_ms": 567.89,
      "total_tokens": 23500,
      "avg_tokens_per_task": 276.47
    },
    "cost": {
      "total_usd": 0.78,
      "avg_per_task_usd": 0.0092,
      "budget_allocated_usd": 30.0,
      "budget_remaining_usd": 29.22,
      "budget_utilization_percent": 2.6
    },
    "quality": {
      "avg_score": 88.5,
      "median_score": 90.0,
      "min_score": 65.0,
      "max_score": 98.0
    }
  }
}
```

### Role-Level Aggregation

```http
GET /api/v1/metrics/aggregate/by-role/{role}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "role": "developer",
    "period": {
      "start": "2025-10-18T00:00:00Z",
      "end": "2025-11-17T00:00:00Z"
    },
    "summary": {
      "total_agents": 3,
      "total_tasks": 245,
      "total_cost_usd": 2.45,
      "avg_cost_per_agent": 0.82
    },
    "agents": [
      {
        "agent_name": "coder",
        "total_tasks": 120,
        "success_rate": 95.83,
        "avg_execution_time_ms": 298.5,
        "total_cost_usd": 1.20,
        "avg_quality_score": 89.2
      }
    ]
  }
}
```

### Trend Detection

```http
GET /api/v1/metrics/trends/{metric_name}
  ?agent_id=1
  &lookback_days=30
```

**Metric options:**
- `execution_time`
- `cost`
- `success_rate`
- `quality_score`

**Response:**
```json
{
  "success": true,
  "data": {
    "metric": "execution_time",
    "trend": "improving",
    "slope": -2.34,
    "r_squared": 0.67,
    "p_value": 0.023,
    "data_points": 28,
    "period": {
      "start": "2025-10-18T00:00:00Z",
      "end": "2025-11-17T00:00:00Z"
    }
  }
}
```

**Trend values:**
- `improving` - Metric getting better over time
- `degrading` - Metric getting worse over time
- `stable` - No significant change
- `insufficient_data` - Not enough data points

### Percentiles

```http
GET /api/v1/metrics/percentiles/{metric_name}?agent_id=1
```

**Response:**
```json
{
  "success": true,
  "metric": "execution_time",
  "agent_id": 1,
  "data": {
    "p50": 298.5,
    "p75": 412.3,
    "p90": 556.7,
    "p95": 678.9,
    "p99": 823.4,
    "mean": 325.6,
    "median": 298.5,
    "std_dev": 112.4,
    "count": 85
  }
}
```

### Outlier Detection

```http
GET /api/v1/metrics/outliers/{metric_name}?z_threshold=3.0
```

**Response:**
```json
{
  "success": true,
  "metric": "execution_time",
  "z_threshold": 3.0,
  "count": 5,
  "data": [
    {
      "id": 12345,
      "agent_name": "coder",
      "operation_type": "implementation",
      "value": 1245.67,
      "z_score": 3.45,
      "deviation_from_mean": 920.07,
      "timestamp": "2025-11-17T14:30:00Z"
    }
  ]
}
```

### Cost Recommendations

```http
GET /api/v1/metrics/recommendations/cost
```

**Response:**
```json
{
  "success": true,
  "count": 4,
  "total_potential_savings": 45.50,
  "data": [
    {
      "type": "reduce_budget",
      "priority": "medium",
      "agent": "reviewer",
      "agent_role": "reviewer",
      "current_budget": 30.0,
      "recommended_budget": 15.0,
      "reason": "Low utilization (12.3%) and minimal activity (8 tasks)",
      "estimated_savings": 15.0
    },
    {
      "type": "pause_agent",
      "priority": "medium",
      "agent": "tester",
      "current_budget": 25.0,
      "recommended_budget": 0,
      "reason": "Rarely used (only 3 tasks in 30 days)",
      "estimated_savings": 23.5
    },
    {
      "type": "increase_capacity",
      "priority": "low",
      "agent": "coder",
      "current_budget": 30.0,
      "recommended_budget": 45.0,
      "reason": "High quality score (89.2) with capacity (92% available)",
      "estimated_savings": 0
    },
    {
      "type": "review_agent",
      "priority": "high",
      "agent": "bugfix",
      "current_budget": 20.0,
      "recommended_budget": 20.0,
      "reason": "High cost ($14.50) but low quality (58.3)",
      "estimated_savings": 0
    }
  ]
}
```

### Performance Insights

```http
GET /api/v1/metrics/insights/performance
```

**Response:**
```json
{
  "success": true,
  "data": {
    "fastest_agents_by_operation": {
      "implementation": {
        "agent": "coder",
        "avg_time_ms": 245.32
      },
      "code_review": {
        "agent": "reviewer",
        "avg_time_ms": 156.78
      }
    },
    "most_cost_efficient": [
      {
        "agent": "reviewer",
        "cost_per_task_usd": 0.0045
      },
      {
        "agent": "coder",
        "cost_per_task_usd": 0.0092
      }
    ],
    "highest_quality": [
      {
        "agent": "coder",
        "avg_quality_score": 89.2
      },
      {
        "agent": "tester",
        "avg_quality_score": 87.5
      }
    ],
    "peak_performance_hours": [
      {
        "hour": 14,
        "avg_time_ms": 198.45,
        "operations": 45
      },
      {
        "hour": 10,
        "avg_time_ms": 212.67,
        "operations": 52
      }
    ],
    "degrading_operations": [
      {
        "operation_type": "testing",
        "trend": {
          "metric": "execution_time",
          "trend": "degrading",
          "slope": 5.67
        }
      }
    ]
  }
}
```

### Alerts

```http
GET /api/v1/metrics/alerts
  ?status=active
  &severity=warning
  &limit=50
```

**Response:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": 1,
      "agent_name": "coder",
      "type": "budget_overrun",
      "severity": "warning",
      "metric": "budget_utilization",
      "current_value": 24.5,
      "expected_value": 30.0,
      "threshold_value": 24.0,
      "deviation_percent": -18.33,
      "message": "Budget alert: coder at 81.7% utilization ($24.50/$30.00)",
      "status": "active",
      "detected_at": "2025-11-17T12:00:00Z",
      "acknowledged_at": null,
      "resolved_at": null
    }
  ]
}
```

**Acknowledge alert:**
```http
PUT /api/v1/metrics/alerts/{alert_id}/acknowledge
```

**Resolve alert:**
```http
PUT /api/v1/metrics/alerts/{alert_id}/resolve
```

### Summary Dashboard

```http
GET /api/v1/metrics/summary
```

**Response:**
```json
{
  "success": true,
  "data": {
    "last_24h": {
      "total_operations": 156,
      "successful_operations": 148,
      "failed_operations": 8,
      "success_rate": 94.87,
      "avg_execution_time_ms": 287.45,
      "total_tokens": 42000,
      "total_cost_usd": 1.45,
      "avg_quality_score": 88.3
    },
    "last_30d_summary": {
      "total_operations": 3245,
      "total_cost_usd": 32.45,
      "avg_success_rate": 95.12
    },
    "active_alerts": 3,
    "pending_recommendations": 4
  }
}
```

## Background Jobs

The service includes automated background jobs:

### Daily Jobs (Midnight UTC)
- Calculate daily aggregations
- Generate cost recommendations

### Weekly Jobs (Sunday Midnight)
- Generate weekly reports
- Calculate weekly aggregations

### Hourly Jobs
- Detect anomalies and outliers
- Check budget overruns

### Monthly Jobs (1st of Month)
- Clean up old metrics (90+ days)

## Caching

All aggregation endpoints are cached for 5 minutes (300 seconds) to improve performance.

**Cache invalidation:**
- Automatic on new metric insert
- Manual via pattern: `invalidate_cache_pattern("metrics:*")`

## Frontend Integration

### React Component Example

```javascript
import React, { useEffect, useState } from 'react';
import axios from 'axios';

const MetricsInsights = () => {
  const [insights, setInsights] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch performance insights
      const insightsRes = await axios.get('/api/v1/metrics/insights/performance');
      setInsights(insightsRes.data.data);

      // Fetch cost recommendations
      const recsRes = await axios.get('/api/v1/metrics/recommendations/cost');
      setRecommendations(recsRes.data.data);

      // Fetch active alerts
      const alertsRes = await axios.get('/api/v1/metrics/alerts?status=active');
      setAlerts(alertsRes.data.data);
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  return (
    <div className="metrics-insights">
      <h2>Performance Insights</h2>

      {/* Cost Recommendations */}
      <section className="recommendations">
        <h3>Cost Optimization</h3>
        {recommendations.map(rec => (
          <div key={rec.agent} className={`recommendation priority-${rec.priority}`}>
            <h4>{rec.agent} - {rec.type}</h4>
            <p>{rec.reason}</p>
            <div className="savings">
              Potential Savings: ${rec.estimated_savings.toFixed(2)}
            </div>
          </div>
        ))}
      </section>

      {/* Active Alerts */}
      <section className="alerts">
        <h3>Active Alerts ({alerts.length})</h3>
        {alerts.map(alert => (
          <div key={alert.id} className={`alert severity-${alert.severity}`}>
            <strong>{alert.agent_name}</strong>: {alert.message}
          </div>
        ))}
      </section>

      {/* Fastest Agents */}
      {insights && (
        <section className="fastest-agents">
          <h3>Fastest Agents by Operation</h3>
          {Object.entries(insights.fastest_agents_by_operation).map(([op, data]) => (
            <div key={op}>
              <strong>{op}</strong>: {data.agent} ({data.avg_time_ms.toFixed(2)}ms)
            </div>
          ))}
        </section>
      )}
    </div>
  );
};

export default MetricsInsights;
```

### Time-Series Chart Example

```javascript
import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import axios from 'axios';

const MetricsTimeSeries = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetchTimeSeries();
  }, []);

  const fetchTimeSeries = async () => {
    const endDate = new Date().toISOString();
    const startDate = new Date(Date.now() - 30*24*60*60*1000).toISOString();

    const res = await axios.get('/api/v1/metrics/aggregate/timeseries', {
      params: {
        start_date: startDate,
        end_date: endDate,
        granularity: 'day'
      }
    });

    setData(res.data.data);
  };

  return (
    <div className="metrics-chart">
      <h3>30-Day Performance Trends</h3>
      <LineChart width={800} height={400} data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="timestamp" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="success_rate" stroke="#8884d8" name="Success Rate %" />
        <Line type="monotone" dataKey="avg_execution_time_ms" stroke="#82ca9d" name="Avg Time (ms)" />
        <Line type="monotone" dataKey="total_cost_usd" stroke="#ffc658" name="Cost (USD)" />
      </LineChart>
    </div>
  );
};

export default MetricsTimeSeries;
```

## Installation

1. Install dependencies:
```bash
cd backend
pip install -r requirements-metrics.txt
```

2. Run database migrations (if using SQLAlchemy migrations)

3. Start background jobs (optional):
```bash
python -m app.tasks.background_jobs
```

4. Verify API endpoints:
```bash
curl http://localhost:8000/api/v1/metrics/summary
```

## Testing

Run comprehensive tests:
```bash
pytest backend/tests/test_metrics_aggregation.py -v
```

## Performance Optimization

1. **Caching**: All endpoints cached for 5 minutes
2. **Pre-aggregation**: Background jobs calculate daily/weekly aggregations
3. **Indexes**: Database indexes on timestamp, agent_id, role, operation_type
4. **Pagination**: Use `limit` parameter on large result sets

## Best Practices

1. **Query Time Ranges**: Limit queries to reasonable time ranges (7-30 days)
2. **Use Pre-aggregated Data**: Query `MetricsAggregation` table for historical data
3. **Monitor Cache Hit Rates**: Check Redis metrics
4. **Set Up Alerts**: Configure email notifications for critical alerts
5. **Review Recommendations**: Check cost recommendations weekly
6. **Clean Up Old Data**: Background job removes metrics older than 90 days

## Troubleshooting

**Slow Queries:**
- Check database indexes
- Use pre-aggregated data
- Reduce time range

**Missing Data:**
- Verify metrics are being inserted
- Check background jobs are running
- Review database permissions

**Cache Issues:**
- Verify Redis connection
- Fall back to in-memory cache
- Check cache invalidation patterns

## Support

For issues or questions, contact the development team or create an issue in the repository.
