# Agent Registry UI Components

Comprehensive agent management interface with real-time status updates, filtering, sorting, and detailed views.

## Components

### AgentRegistry (Main Component)
- **Path**: `./AgentRegistry.tsx`
- **Features**:
  - Real-time WebSocket updates for agent status
  - Automatic agent data fetching from /api/v1/agents/
  - Supports both Zustand store integration and standalone mode
  - Statistics dashboard (total, active, idle, blocked, specialists, avg quality)
  - Connection status indicator
  - Orchestrates filters, table, and modal components

### AgentFilters
- **Path**: `./AgentFilters.tsx`
- **Features**:
  - Search by name, capabilities, or tags
  - Filter by role (admin, developer, researcher, tester, etc.)
  - Filter by category (delivery, foundry, security, quality, etc.)
  - Filter by status (active, idle, paused, blocked, offline)
  - Specialists-only toggle
  - Active filter indicator with reset button
  - Results count display

### AgentTable
- **Path**: `./AgentTable.tsx`
- **Features**:
  - Sortable columns (name, role, category, status, budget, quality, tasks)
  - Status indicators with color coding (active, idle, paused, blocked, offline)
  - Budget visualization with progress bars
  - Quality grade display (A-F letter grades)
  - Pagination (25 agents per page)
  - Responsive design (table on desktop, cards on mobile)
  - Click to open details modal

### AgentDetailsModal
- **Path**: `./AgentDetailsModal.tsx`
- **Features**:
  - Comprehensive agent information display
  - Basic info (ID, role, category, specialist status, version)
  - Capabilities and tags
  - RBAC permissions (allowed/denied tools, path scopes, API access)
  - Budget tracking (cost and token usage with progress bars)
  - Performance metrics (success rate, quality score, execution time, tasks completed)
  - Timestamps (created, updated, last active)
  - Responsive modal design

## Budget Status Indicators

| Status | Threshold | Color | Behavior |
|--------|-----------|-------|----------|
| OK | <70% | Green | Normal operations |
| Warning | 70-90% | Yellow | Warning alert |
| Critical | 90-100% | Orange | Critical alert |
| Exceeded | >100% | Red | Operations paused |

## API Integration

### Endpoints Used
- `GET /api/v1/metrics/aggregate` - API usage metrics
- `GET /api/v1/agents/stats/summary` - Budget summary
- `GET /api/v1/agents` - Agent list with budgets
- `GET /api/v1/agents/alerts` - Budget alerts
- `GET /api/v1/metrics/aggregate?period=7d` - Time series data
- `GET /api/v1/agents/stats/history?days=30` - Budget history
- `WS /api/v1/agents/activity/stream` - Real-time updates
- `GET /api/v1/metrics/export?format=csv` - CSV export
- `GET /api/v1/metrics/report?period=daily|weekly|monthly` - PDF reports
- `POST /api/v1/metrics/email-report` - Email alerts

### WebSocket Events
```typescript
{
  type: 'budget_alert',
  alert: {
    id: string;
    severity: 'error' | 'warning' | 'info' | 'success';
    title: string;
    message: string;
    timestamp: string;
    agent_id?: string;
    agent_name?: string;
  }
}
```

## Usage Examples

### Basic Usage
```tsx
import ResourceMonitors from './components/agents/ResourceMonitors';

function App() {
  return (
    <div className="container mx-auto">
      <ResourceMonitors />
    </div>
  );
}
```

### Individual Components
```tsx
import { APIUsagePanel, CostDashboard, BudgetAlerts } from './components/agents';

function Dashboard() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <APIUsagePanel />
      <CostDashboard />
      <BudgetAlerts className="lg:col-span-2" />
    </div>
  );
}
```

### Charts Only
```tsx
import {
  UsageTimeSeriesChart,
  CostBreakdownPieChart,
  TopAgentsCostBarChart
} from './components/agents';

function ChartsPage() {
  const [data, setData] = useState({
    usage: [],
    breakdown: [],
    topAgents: []
  });

  return (
    <div className="space-y-6">
      <UsageTimeSeriesChart data={data.usage} />
      <CostBreakdownPieChart data={data.breakdown} />
      <TopAgentsCostBarChart data={data.topAgents} />
    </div>
  );
}
```

## Dependencies

Required npm packages:
```bash
npm install recharts lucide-react
```

## Performance Optimizations

1. **Data Refresh Intervals**:
   - API metrics: 30 seconds
   - Chart data: 60 seconds
   - WebSocket: Real-time

2. **Load Time Targets**:
   - Initial load: <200ms
   - Chart rendering: <100ms
   - Tab switching: <50ms

3. **Memoization**:
   - Chart data cached
   - Agent list sorted client-side
   - Alert filtering optimized

## Browser Notifications

Requires user permission for desktop notifications:

```typescript
// Request permission
if (Notification.permission === 'default') {
  Notification.requestPermission();
}

// Send notification
new Notification('Budget Alert', {
  body: 'Agent exceeded budget',
  icon: '/favicon.ico',
  tag: 'budget-alert-123'
});
```

## Export Features

### CSV Export
Downloads all budget data in CSV format with columns:
- Agent ID
- Agent Name
- Role
- Budget Used
- Budget Limit
- Percentage Used
- Status

### PDF Reports
Generates formatted reports with:
- Executive summary
- Cost trends
- Top agents
- Alert history
- Recommendations

### Email Alerts
Sends automated reports via email:
- Daily digest
- Weekly summary
- Monthly overview
- Critical alerts (immediate)

## Styling

Uses Tailwind CSS classes. Main color palette:
- Primary: Blue (#3b82f6)
- Success: Green (#10b981)
- Warning: Yellow (#f59e0b)
- Error: Red (#ef4444)

Custom animations in `./animations.css`:
- slideIn (alerts)
- fadeIn (charts)
- pulse (loading)
- spin (refresh)

## Testing

Run component tests:
```bash
npm test src/components/agents/
```

Coverage targets:
- Unit tests: >90%
- Integration tests: >80%
- E2E tests: Critical paths

## Troubleshooting

### Charts Not Rendering
- Verify Recharts installed: `npm list recharts`
- Check data format matches expected schema
- Inspect browser console for errors

### WebSocket Connection Failed
- Verify backend WebSocket server running
- Check CORS settings
- Inspect network tab for WebSocket errors

### Notifications Not Working
- Check browser notification permissions
- Verify HTTPS (required for notifications)
- Check `notificationsEnabled` state

### Data Not Refreshing
- Verify API endpoints accessible
- Check network tab for 200 responses
- Inspect auto-refresh intervals

## License

Proprietary - Part of Claude Flow Agent Management System
