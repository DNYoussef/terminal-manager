import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ResourceMonitors from './ResourceMonitors';
import { APIUsagePanel } from './APIUsagePanel';
import { CostDashboard } from './CostDashboard';
import { BudgetAlerts } from './BudgetAlerts';

global.fetch = jest.fn();

describe('ResourceMonitors Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        total_calls: 12543,
        today_calls: 234,
        tokens_used: 2400000,
        today_tokens: 45000,
        rate_limit_percentage: 67
      })
    });
  });

  test('renders main ResourceMonitors component', async () => {
    render(<ResourceMonitors />);
    expect(screen.getByText(/Resource Monitors/i)).toBeInTheDocument();
  });

  test('displays all tabs correctly', async () => {
    render(<ResourceMonitors />);
    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('API Usage')).toBeInTheDocument();
    });
  });
});

describe('APIUsagePanel Component', () => {
  test('renders API usage metrics', async () => {
    render(<APIUsagePanel />);
    await waitFor(() => {
      expect(screen.getByText(/Total API Calls/i)).toBeInTheDocument();
    });
  });
});
