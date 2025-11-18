# Resource Monitors - Quick Start Guide

## 1-Minute Setup

### Install Dependencies
```bash
npm install recharts lucide-react
```

### Basic Usage
```tsx
import ResourceMonitors from './components/agents/ResourceMonitors';
import './components/agents/animations.css';

function App() {
  return <ResourceMonitors />;
}
```

## Component Overview

### ResourceMonitors
Main dashboard with 5 tabs
```tsx
<ResourceMonitors className="my-custom-class" />
```

### APIUsagePanel
API metrics only
```tsx
import { APIUsagePanel } from './components/agents';
<APIUsagePanel />
```

### CostDashboard
Budget tracking only
```tsx
import { CostDashboard } from './components/agents';
<CostDashboard />
```

### BudgetAlerts
Alerts only
```tsx
import { BudgetAlerts } from './components/agents';
<BudgetAlerts />
```

### Individual Charts
```tsx
import { UsageTimeSeriesChart } from './components/agents';
<UsageTimeSeriesChart data={myData} title="Custom Title" />
```

## Backend Requirements

Ensure these endpoints work:
- GET /api/v1/metrics/aggregate
- GET /api/v1/agents/stats/summary
- GET /api/v1/agents
- WS /api/v1/agents/activity/stream

## Budget Status Colors

| Color | Threshold | Meaning |
|-------|-----------|---------|
| Green | <70% | OK |
| Yellow | 70-90% | Warning |
| Orange | 90-100% | Critical |
| Red | >100% | Exceeded |

## Key Features

- Real-time updates (30-60s)
- WebSocket alerts
- CSV export
- PDF reports
- Email notifications
- Browser notifications

## Troubleshooting

**Charts not showing?**
```bash
npm install recharts
```

**No data?**
Check backend API endpoints are running.

**Notifications not working?**
Enable browser notifications permission.

## Full Documentation

- README.md - Complete documentation
- INTEGRATION-CHECKLIST.md - Deployment guide
- ResourceMonitors.test.tsx - Example tests

## Support

Check browser console for errors.
Verify network requests in DevTools.
