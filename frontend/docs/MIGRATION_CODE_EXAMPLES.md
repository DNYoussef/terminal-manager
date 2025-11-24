# Migration Code Examples - MUI to Tailwind + Radix

**Purpose**: Practical before/after code examples for migrating Material UI components to Tailwind + Radix design-system.

---

## 1. AgentQualityTable.tsx Migration

### BEFORE (Material UI)

```tsx
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

const AgentQualityTable: React.FC<AgentQualityTableProps> = ({ agents }) => {
  return (
    <Box sx={{ width: '100%' }}>
      <TextField
        fullWidth
        variant="outlined"
        placeholder="Search agents..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
      />

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'name'}
                  direction={sortOrder}
                  onClick={() => handleSort('name')}
                >
                  Agent Name
                </TableSortLabel>
              </TableCell>
              <TableCell>Quality Score</TableCell>
              <TableCell>Grade</TableCell>
              <TableCell>Trend</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedAgents.map((agent) => (
              <TableRow key={agent.id}>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {agent.name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={agent.quality_score}
                    sx={{ bgcolor: getScoreColor(agent.quality_score) }}
                  />
                </TableCell>
                <TableCell>
                  <Chip label={agent.grade} sx={{ bgcolor: getGradeColor(agent.grade) }} />
                </TableCell>
                <TableCell>{getTrendIcon(agent.trend)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
```

### AFTER (Tailwind + Radix)

```tsx
import React, { useState } from 'react';
import { Search, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Input } from '../design-system/Input';
import { Badge } from '../design-system/Badge';
import { Card } from '../design-system/Card';

const AgentQualityTable: React.FC<AgentQualityTableProps> = ({ agents }) => {
  return (
    <div className="w-full space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
        <Input
          type="text"
          placeholder="Search agents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-hover border-b border-border">
              <tr>
                <th
                  className="px-4 py-3 text-left text-sm font-medium text-text-primary cursor-pointer hover:text-accent-primary transition-colors"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-2">
                    Agent Name
                    {sortField === 'name' && (
                      <span className="text-accent-primary">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-primary">
                  Quality Score
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-primary">
                  Grade
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-primary">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedAgents.map((agent) => (
                <tr key={agent.id} className="hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-text-primary">
                      {agent.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={getScoreVariant(agent.quality_score)}
                      className="inline-flex"
                    >
                      {agent.quality_score}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={getGradeVariant(agent.grade)}>
                      {agent.grade}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {getTrendIcon(agent.trend)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// Helper functions updated
const getScoreVariant = (score: number): 'success' | 'warning' | 'error' => {
  if (score >= 80) return 'success';
  if (score >= 60) return 'warning';
  return 'error';
};

const getGradeVariant = (grade: string): 'success' | 'warning' | 'error' => {
  if (grade === 'A' || grade === 'B') return 'success';
  if (grade === 'C') return 'warning';
  return 'error';
};

const getTrendIcon = (trend: number) => {
  if (trend > 0) {
    return <TrendingUp className="h-4 w-4 text-status-success" />;
  } else if (trend < 0) {
    return <TrendingDown className="h-4 w-4 text-status-error" />;
  } else {
    return <Minus className="h-4 w-4 text-text-tertiary" />;
  }
};
```

**Key Changes**:
- MUI Paper/Table → Tailwind `<table>` inside Card
- MUI TextField → design-system Input with Lucide icon
- MUI Chip → design-system Badge
- MUI icons → Lucide icons
- sx props → Tailwind className utilities
- TableSortLabel → Custom clickable header with arrow

---

## 2. QualityMetrics.tsx Migration

### BEFORE (Material UI)

```tsx
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

const QualityMetrics: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Quality Metrics Dashboard
      </Typography>

      <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)}>
        <Tab label="Overview" />
        <Tab label="Trends" />
        <Tab label="Violations" />
      </Tabs>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">Overall Score</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h3">{score.overall}</Typography>
                <Chip label={score.grade} color="success" size="small" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">Trend</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {score.trend.direction === 'up' ? (
                  <TrendingUpIcon color="success" />
                ) : (
                  <TrendingDownIcon color="error" />
                )}
                <Typography variant="body1">{score.trend.change}%</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
```

### AFTER (Tailwind + Radix)

```tsx
import { TrendingUp, TrendingDown, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../design-system/Card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../design-system/Tabs';
import { Badge } from '../design-system/Badge';
import { Spinner } from '../design-system/Spinner'; // New component
import { Alert } from '../design-system/Alert'; // New component

const QualityMetrics: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-semibold text-text-primary">
        Quality Metrics Dashboard
      </h2>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="violations">Violations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {loading && (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          )}

          {error && (
            <Alert variant="error" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              {error}
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Overall Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-bold text-text-primary">
                    {score.overall}
                  </span>
                  <Badge variant="success" className="text-sm">
                    {score.grade}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  {score.trend.direction === 'up' ? (
                    <TrendingUp className="h-6 w-6 text-status-success" />
                  ) : (
                    <TrendingDown className="h-6 w-6 text-status-error" />
                  )}
                  <span className="text-xl font-semibold text-text-primary">
                    {score.trend.change}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends">
          {/* Trends content */}
        </TabsContent>

        <TabsContent value="violations">
          {/* Violations content */}
        </TabsContent>
      </Tabs>
    </div>
  );
};
```

**Key Changes**:
- MUI Box → div with Tailwind classes
- MUI Typography → semantic HTML (h2, span) with Tailwind
- MUI Grid → Tailwind grid utilities
- MUI Card → design-system Card (already exists)
- MUI Tabs → design-system Tabs (already uses Radix)
- MUI CircularProgress → custom Spinner component
- MUI Alert → custom Alert component
- MUI icons → Lucide icons

---

## 3. FeedbackLoops/Dashboard.tsx Migration

### BEFORE (Material UI)

```tsx
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Tabs,
  Tab,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  LinearProgress
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  Info,
  TrendingUp,
  Settings,
  Speed,
  Refresh
} from '@mui/icons-material';

const FeedbackLoopsDashboard: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">Feedback Loops Dashboard</Typography>
        <Button
          variant="contained"
          startIcon={<Refresh />}
          onClick={handleRefresh}
        >
          Refresh
        </Button>
      </Box>

      <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)}>
        <Tab label="Overview" />
        <Tab label="Pending Approvals" />
        <Tab label="Settings" />
      </Tabs>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6">Prompt Refinement</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                <TrendingUp color="success" />
                <Typography variant="h4">{stats.prompt_refinement.runs}</Typography>
              </Box>
              <LinearProgress variant="determinate" value={75} sx={{ mt: 2 }} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={approvalDialogOpen} onClose={() => setApprovalDialogOpen(false)}>
        <DialogTitle>Approve Recommendation</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Notes"
            value={approvalNotes}
            onChange={(e) => setApprovalNotes(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovalDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleApprove}>
            Approve
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
```

### AFTER (Tailwind + Radix)

```tsx
import {
  CheckCircle,
  X,
  Info,
  TrendingUp,
  Settings,
  Gauge,
  RefreshCw
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../design-system/Card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../design-system/Tabs';
import { Button } from '../design-system/Button';
import { Badge } from '../design-system/Badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '../design-system/Dialog';
import { Input } from '../design-system/Input';
import { Alert } from '../design-system/Alert';
import { Progress } from '../design-system/Progress'; // New component

const FeedbackLoopsDashboard: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-text-primary">
          Feedback Loops Dashboard
        </h2>
        <Button variant="primary" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="approvals">Pending Approvals</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Prompt Refinement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-6 w-6 text-status-success" />
                  <span className="text-4xl font-bold text-text-primary">
                    {stats.prompt_refinement.runs}
                  </span>
                </div>
                <Progress value={75} className="w-full" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="approvals">
          {/* Pending approvals list */}
          <div className="space-y-2 mt-4">
            {pendingRecommendations.map((rec) => (
              <Card key={rec.id} hover>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-text-primary">{rec.type}</p>
                    <p className="text-sm text-text-secondary">{rec.timestamp}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => openApprovalDialog(rec)}
                  >
                    Review
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Approval Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Recommendation</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-text-primary">Notes</span>
              <textarea
                className="w-full min-h-[100px] rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-border-focus"
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Add approval notes..."
              />
            </label>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button variant="primary" onClick={handleApprove}>
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
```

**Key Changes**:
- MUI Box → div with Tailwind flex/grid
- MUI Typography → semantic HTML with Tailwind
- MUI Grid → Tailwind grid utilities
- MUI Card → design-system Card
- MUI Tabs → design-system Tabs (Radix)
- MUI Button → design-system Button (Radix)
- MUI Dialog → design-system Dialog (Radix)
- MUI TextField → Tailwind styled textarea
- MUI LinearProgress → custom Progress component
- MUI List → Tailwind flex/grid layout
- MUI icons → Lucide icons

---

## 4. New Components to Create

### Spinner.tsx (Replaces CircularProgress)

```tsx
import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const spinnerVariants = cva(
  'animate-spin rounded-full border-2 border-current border-t-transparent',
  {
    variants: {
      size: {
        sm: 'h-4 w-4',
        md: 'h-6 w-6',
        lg: 'h-8 w-8',
        xl: 'h-12 w-12',
      },
      variant: {
        primary: 'text-accent-primary',
        secondary: 'text-text-secondary',
        success: 'text-status-success',
        error: 'text-status-error',
      },
    },
    defaultVariants: {
      size: 'md',
      variant: 'primary',
    },
  }
);

export interface SpinnerProps extends VariantProps<typeof spinnerVariants> {
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size, variant, className }) => {
  return <div className={spinnerVariants({ size, variant, className })} />;
};
```

### Progress.tsx (Replaces LinearProgress)

```tsx
import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const progressVariants = cva(
  'relative w-full overflow-hidden rounded-full bg-surface-hover',
  {
    variants: {
      size: {
        sm: 'h-1',
        md: 'h-2',
        lg: 'h-3',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const progressBarVariants = cva(
  'h-full transition-all duration-300 ease-in-out rounded-full',
  {
    variants: {
      variant: {
        primary: 'bg-accent-primary',
        success: 'bg-status-success',
        warning: 'bg-status-warning',
        error: 'bg-status-error',
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  }
);

export interface ProgressProps extends VariantProps<typeof progressVariants> {
  value: number; // 0-100
  variant?: 'primary' | 'success' | 'warning' | 'error';
  className?: string;
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  size,
  variant = 'primary',
  className,
}) => {
  return (
    <div className={progressVariants({ size, className })}>
      <div
        className={progressBarVariants({ variant })}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
};
```

### Alert.tsx (Replaces MUI Alert)

```tsx
import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

const alertVariants = cva(
  'flex items-start gap-3 rounded-md border p-4',
  {
    variants: {
      variant: {
        info: 'border-status-info bg-status-info/10 text-status-info',
        success: 'border-status-success bg-status-success/10 text-status-success',
        warning: 'border-status-warning bg-status-warning/10 text-status-warning',
        error: 'border-status-error bg-status-error/10 text-status-error',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  }
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  children: React.ReactNode;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, children, ...props }, ref) => {
    const Icon = {
      info: Info,
      success: CheckCircle,
      warning: AlertTriangle,
      error: AlertCircle,
    }[variant || 'info'];

    return (
      <div ref={ref} className={alertVariants({ variant, className })} {...props}>
        <Icon className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">{children}</div>
      </div>
    );
  }
);

Alert.displayName = 'Alert';
```

---

## 5. Package.json Changes

### BEFORE

```json
{
  "dependencies": {
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.1",
    "@mui/icons-material": "^6.5.0",
    "@mui/material": "^6.5.0",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-select": "^2.2.6",
    "@radix-ui/react-slot": "^1.2.4",
    "@radix-ui/react-tabs": "^1.1.13",
    "lucide-react": "^0.553.0",
    "tailwindcss": "^4.1.17"
  }
}
```

### AFTER

```json
{
  "dependencies": {
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-select": "^2.2.6",
    "@radix-ui/react-slot": "^1.2.4",
    "@radix-ui/react-tabs": "^1.1.13",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.553.0",
    "tailwindcss": "^4.1.17"
  }
}
```

**Removed**:
- @mui/material
- @mui/icons-material
- @emotion/react
- @emotion/styled

**Total reduction**: 4 packages, ~200KB bundle size

---

## 6. Testing Strategy

### Unit Tests (Before/After Pattern Matching)

```tsx
// BEFORE (MUI)
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import AgentQualityTable from './AgentQualityTable';

test('renders search input', () => {
  render(
    <ThemeProvider theme={createTheme()}>
      <AgentQualityTable agents={[]} />
    </ThemeProvider>
  );
  expect(screen.getByPlaceholderText('Search agents...')).toBeInTheDocument();
});

// AFTER (Tailwind)
import { render, screen } from '@testing-library/react';
import AgentQualityTable from './AgentQualityTable';

test('renders search input', () => {
  render(<AgentQualityTable agents={[]} />);
  expect(screen.getByPlaceholderText('Search agents...')).toBeInTheDocument();
});
```

**Note**: No ThemeProvider wrapper needed, simpler test setup.

### Visual Regression Tests

```tsx
// Playwright visual regression
import { test, expect } from '@playwright/test';

test('AgentQualityTable visual regression', async ({ page }) => {
  await page.goto('/agents/quality');
  await page.waitForSelector('[data-testid="quality-table"]');

  // Take screenshot before migration
  await expect(page).toHaveScreenshot('quality-table-before.png');

  // After migration, compare
  await expect(page).toHaveScreenshot('quality-table-after.png', {
    maxDiffPixelRatio: 0.05, // Allow 5% visual difference
  });
});
```

---

## 7. Bundle Size Verification

### Before Migration

```bash
npx vite-bundle-visualizer --template treemap
```

**Expected output**:
```
@mui/material: ~120KB
@mui/icons-material: ~50KB
@emotion/react: ~20KB
@emotion/styled: ~10KB
Total MUI ecosystem: ~200KB
```

### After Migration

```bash
npm uninstall @mui/material @mui/icons-material @emotion/react @emotion/styled
npm run build
npx vite-bundle-visualizer --template treemap
```

**Expected output**:
```
@radix-ui/react-*: ~30KB
lucide-react: ~20KB
class-variance-authority: ~5KB
Total: ~55KB
Savings: -145KB minimum (-72%)
```

---

## 8. Migration Checklist Per Component

### AgentQualityTable.tsx
- [ ] Create feature branch: `feat/migrate-agent-quality-table`
- [ ] Replace MUI imports with Lucide/design-system
- [ ] Convert Table to Tailwind `<table>`
- [ ] Replace TextField with Input
- [ ] Replace Chip with Badge
- [ ] Replace icons (SearchIcon → Search, etc.)
- [ ] Update helper functions (color → variant)
- [ ] Add data-testid attributes
- [ ] Run unit tests
- [ ] Run visual regression tests
- [ ] PR review + merge

### QualityMetrics.tsx
- [ ] Create feature branch: `feat/migrate-quality-metrics`
- [ ] Create Spinner component
- [ ] Create Progress component
- [ ] Create Alert component
- [ ] Replace MUI Grid with Tailwind grid
- [ ] Replace MUI Card with design-system Card
- [ ] Replace MUI Tabs with design-system Tabs
- [ ] Replace CircularProgress with Spinner
- [ ] Replace LinearProgress with Progress
- [ ] Replace Alert with custom Alert
- [ ] Replace icons
- [ ] Run unit tests
- [ ] Run visual regression tests
- [ ] PR review + merge

### FeedbackLoops/Dashboard.tsx
- [ ] Create feature branch: `feat/migrate-feedback-dashboard`
- [ ] Replace MUI Dialog with design-system Dialog
- [ ] Replace MUI Button with design-system Button
- [ ] Replace MUI List with Tailwind flex layout
- [ ] Replace MUI Grid with Tailwind grid
- [ ] Replace TextField with Tailwind textarea
- [ ] Replace Progress components
- [ ] Replace icons
- [ ] Test approval workflow
- [ ] Run unit tests
- [ ] Run visual regression tests
- [ ] PR review + merge

### Final Cleanup
- [ ] Create branch: `feat/remove-mui-packages`
- [ ] Run global search for `@mui/` imports (should be 0)
- [ ] Run global search for `@emotion/` imports (should be 0)
- [ ] Uninstall packages: `npm uninstall @mui/material @mui/icons-material @emotion/react @emotion/styled`
- [ ] Run `npm run build` (should succeed)
- [ ] Verify bundle size reduction (vite-bundle-visualizer)
- [ ] Run full E2E test suite
- [ ] Update documentation
- [ ] PR review + merge
- [ ] Deploy to staging
- [ ] Monitor for errors
- [ ] Deploy to production

---

**End of Migration Code Examples**
