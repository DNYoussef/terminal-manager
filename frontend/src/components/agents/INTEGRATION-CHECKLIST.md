# Resource Monitors Integration Checklist

## Prerequisites

### 1. Install Dependencies
```bash
cd /c/Users/17175/frontend
npm install recharts lucide-react
npm install --save-dev @testing-library/react @testing-library/jest-dom
```

### 2. Verify Backend APIs
Ensure these endpoints are running:
- [ ] `GET /api/v1/metrics/aggregate`
- [ ] `GET /api/v1/agents/stats/summary`
- [ ] `GET /api/v1/agents`
- [ ] `GET /api/v1/agents/alerts`
- [ ] `WS /api/v1/agents/activity/stream`

### 3. Configure Tailwind CSS
Ensure `tailwind.config.js` includes:
```javascript
content: [
  "./src/components/**/*.{js,ts,jsx,tsx}",
],
theme: {
  extend: {
    animation: {
      slideIn: 'slideIn 0.3s ease-out',
      fadeIn: 'fadeIn 0.5s ease-out',
    },
  },
},
```

## Component Integration

### 4. Import in Main App
```tsx
// src/App.tsx or src/pages/Dashboard.tsx
import ResourceMonitors from './components/agents/ResourceMonitors';

function Dashboard() {
  return (
    <div className="container mx-auto p-6">
      <ResourceMonitors />
    </div>
  );
}
```

### 5. Add Routes (if using React Router)
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ResourceMonitors from './components/agents/ResourceMonitors';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/monitors" element={<ResourceMonitors />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### 6. Import CSS Animations
```tsx
// src/App.tsx or src/index.tsx
import './components/agents/animations.css';
```

## Testing

### 7. Run Unit Tests
```bash
npm test src/components/agents/ResourceMonitors.test.tsx
```

Expected results:
- [ ] All tests pass
- [ ] No console errors
- [ ] Coverage >80%

### 8. Manual Testing

#### API Usage Panel
- [ ] Metrics load correctly
- [ ] Numbers formatted properly (2.4M, 45K)
- [ ] Rate limit progress bar displays
- [ ] Auto-refresh works (30s)
- [ ] Refresh button updates data

#### Cost Dashboard
- [ ] Total spend displays
- [ ] Budget overview shows correctly
- [ ] Agent budget bars render
- [ ] Budget status colors correct (green/yellow/orange/red)
- [ ] Sort dropdown works
- [ ] Budget remaining calculates properly

#### Budget Alerts
- [ ] Alerts load and display
- [ ] Alert counts show correctly
- [ ] Severity filtering works
- [ ] Dismiss button removes alerts
- [ ] Notification toggle works
- [ ] WebSocket connection establishes

#### Charts
- [ ] Usage time series chart renders
- [ ] Token usage chart displays
- [ ] Cost breakdown pie chart shows
- [ ] Top agents bar chart renders
- [ ] Budget burn rate chart displays
- [ ] Chart tooltips work

#### Export Features
- [ ] CSV export downloads file
- [ ] Report generation works
- [ ] Email alert sends successfully

## Performance Validation

### 9. Load Time Checks
Run in browser DevTools Performance tab:
- [ ] Initial load <200ms
- [ ] Chart rendering <100ms
- [ ] Tab switching <50ms

### 10. Network Optimization
- [ ] API calls batched when possible
- [ ] WebSocket connection reuses single instance
- [ ] Data refresh intervals appropriate (30-60s)

## Production Readiness

### 11. Environment Variables
Create `.env` file:
```env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000
```

### 12. Error Handling
Verify error states:
- [ ] Network errors display user-friendly messages
- [ ] Loading states show spinners
- [ ] Empty states have helpful text
- [ ] Failed WebSocket shows fallback

### 13. Browser Compatibility
Test in:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### 14. Accessibility
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Color contrast meets WCAG AA
- [ ] Focus indicators visible

### 15. Security
- [ ] No sensitive data in console logs
- [ ] WebSocket uses secure connection (wss://) in production
- [ ] API endpoints require authentication
- [ ] CORS configured correctly

## Deployment

### 16. Build for Production
```bash
npm run build
```

Verify:
- [ ] No build errors
- [ ] Bundle size acceptable (<500KB)
- [ ] Source maps generated

### 17. Serve Static Files
```bash
npm install -g serve
serve -s build
```

Test:
- [ ] All routes work
- [ ] Assets load correctly
- [ ] No 404 errors

## Post-Deployment Validation

### 18. Smoke Tests
- [ ] Dashboard loads
- [ ] Data populates
- [ ] Real-time updates work
- [ ] Export features functional
- [ ] No console errors

### 19. Monitoring
Set up:
- [ ] Error tracking (Sentry, Bugsnag)
- [ ] Performance monitoring
- [ ] User analytics
- [ ] Uptime monitoring

### 20. Documentation
- [ ] README.md complete
- [ ] API integration documented
- [ ] Troubleshooting guide available
- [ ] User guide created

## Success Criteria

All items checked off:
- [ ] Dependencies installed
- [ ] Backend APIs verified
- [ ] Component integrated
- [ ] Tests passing
- [ ] Manual testing complete
- [ ] Performance validated
- [ ] Production ready
- [ ] Deployed successfully
- [ ] Post-deployment verified
- [ ] Documentation complete

## Rollback Plan

If issues occur:
1. Revert to previous commit
2. Remove component imports
3. Clear browser cache
4. Restart backend services
5. Check logs for errors

## Support

For issues, check:
- README.md troubleshooting section
- Browser console for errors
- Network tab for failed requests
- Backend logs for API errors

Contact: [Your support channel]
