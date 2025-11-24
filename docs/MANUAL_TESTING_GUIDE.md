# Manual Testing Guide - Material UI to Tailwind Migration

**Date**: 2025-11-20
**Purpose**: Verify all migrated components work correctly
**Estimated Time**: 2-4 hours

---

## Pre-Testing Setup

### 1. Start the Development Server
```bash
cd C:\Users\17175\terminal-manager\frontend
npm run dev
```

### 2. Open in Multiple Browsers
- Chrome (primary)
- Firefox (cross-browser check)
- Edge (optional)

### 3. Test on Different Screen Sizes
- Desktop: 1920x1080
- Tablet: 768x1024
- Mobile: 375x667

---

## Component A: AgentQualityTable

**Location**: Navigate to page showing AgentQualityTable component
**File**: `frontend/src/components/agents/AgentQualityTable.tsx`

### Test 1: Table Rendering
- [ ] Table displays with proper borders and styling
- [ ] Header row has correct background color
- [ ] Data rows have hover effect (background changes on mouse over)
- [ ] Summary statistics display at bottom
- [ ] All columns visible: Name, Role, Score, Grade, Violations, Trend, Last Updated

**Expected**: Clean table layout, dark theme styling, clear borders

### Test 2: Sorting Functionality
- [ ] Click "Agent Name" header - sorts alphabetically A→Z
- [ ] Click "Agent Name" again - reverses sort to Z→A
- [ ] Chevron icon appears next to "Agent Name" column
- [ ] Chevron points up (ascending) or down (descending)
- [ ] Click "Quality Score" - sorts by number (lowest to highest)
- [ ] Click "Quality Score" again - reverses to highest to lowest
- [ ] Test all 6 sortable columns:
  - [ ] Agent Name (alphabetical)
  - [ ] Role (alphabetical)
  - [ ] Quality Score (numerical)
  - [ ] Grade (alphabetical A-F)
  - [ ] Violations (numerical)
  - [ ] Trend (up/down/neutral)

**Expected**: Smooth sorting, correct order, visual indicator (chevron) on active column

### Test 3: Search Feature
- [ ] Search icon visible in search box (magnifying glass)
- [ ] Type agent name (e.g., "coder") - table filters to matching results
- [ ] Type role (e.g., "backend") - filters results
- [ ] Clear search input - all results return
- [ ] Search with no matches - shows "No agents match your search" message
- [ ] Search is case-insensitive (e.g., "CODER" finds "coder")

**Expected**: Instant filtering, clear empty state message

### Test 4: Visual Elements
- [ ] Quality scores color-coded:
  - [ ] 90-100: Green text
  - [ ] 60-89: Yellow/orange text
  - [ ] 0-59: Red text
- [ ] Grade badges use correct colors:
  - [ ] A: Green badge
  - [ ] B: Blue/cyan badge
  - [ ] C: Yellow badge
  - [ ] D: Orange badge
  - [ ] F: Red badge
- [ ] Violation badges use traffic light colors:
  - [ ] 0-5: Green
  - [ ] 6-10: Yellow
  - [ ] 11+: Red
- [ ] Trend icons display correctly:
  - [ ] Trending up: Green upward arrow
  - [ ] Trending down: Red downward arrow
  - [ ] Neutral: Gray minus/dash icon
- [ ] Timestamps show relative time (e.g., "2h ago", "1d ago")

**Expected**: Clear visual hierarchy, intuitive color coding

### Test 5: Responsive Design
- [ ] Desktop (1920px): All columns fit comfortably
- [ ] Tablet (768px): Table scrolls horizontally if needed
- [ ] Mobile (375px): Horizontal scroll enabled, search bar adapts
- [ ] Summary stats stack vertically on mobile (3 cols → 1 col)

**Expected**: Usable on all screen sizes

---

## Component B: QualityMetrics

**Location**: Navigate to QualityMetrics dashboard
**File**: `frontend/src/components/agents/QualityMetrics.tsx`

### Test 6: Loading State
- [ ] Spinner displays centered while loading
- [ ] Spinner size is xl (large, ~48px)
- [ ] No content flashes during load (loading state prevents layout shift)
- [ ] Loading completes within reasonable time (<3 seconds)

**Expected**: Smooth loading experience, no flicker

### Test 7: Error State
- [ ] Simulate error (disconnect backend) - error alert displays
- [ ] Alert has red/error variant styling
- [ ] Error message is readable and informative
- [ ] Alert has proper ARIA role="alert"
- [ ] Error doesn't crash the entire page

**Expected**: Graceful error handling, clear messaging

### Test 8: Overall Quality Dashboard
- [ ] Radial progress ring displays correctly (SVG circle)
- [ ] Ring color matches grade:
  - [ ] A: Green ring
  - [ ] B: Blue ring
  - [ ] C: Yellow ring
  - [ ] D: Orange ring
  - [ ] F: Red ring
- [ ] Percentage value centered in ring (large, bold font)
- [ ] Grade letter displayed below percentage
- [ ] Trend icon shows correctly:
  - [ ] Up arrow (green) for improving quality
  - [ ] Down arrow (red) for declining quality
  - [ ] Neutral icon (gray) for stable quality
- [ ] Trend text shows change from previous period (e.g., "+5% from last week")

**Expected**: Clear visual representation of overall quality

### Test 9: Quality Distribution
- [ ] Progress bars for each grade (A, B, C, D, F)
- [ ] Bar width matches percentage (visual proportion)
- [ ] Colors match grade:
  - [ ] A: Green bar
  - [ ] B: Blue bar
  - [ ] C: Yellow bar
  - [ ] D: Orange bar
  - [ ] F: Red bar
- [ ] Agent counts display correctly next to each bar
- [ ] Total adds up to 100% (or close due to rounding)

**Expected**: Clear distribution visualization

### Test 10: Tabs Functionality
- [ ] All 4 tabs visible:
  - [ ] Violations
  - [ ] Quality Trends
  - [ ] Agents (shows AgentQualityTable)
  - [ ] Quality Gates
- [ ] Active tab highlighted with accent color
- [ ] Click "Quality Trends" - content changes to trends view
- [ ] Click "Agents" - AgentQualityTable displays
- [ ] Click "Quality Gates" - gates list displays
- [ ] Tab switching is smooth (no flash of old content)

**Expected**: Smooth tab navigation, correct content per tab

### Test 11: Quality Gates Tab
- [ ] Passed events show:
  - [ ] Green border
  - [ ] CheckCircle icon (green)
  - [ ] "Passed" badge
- [ ] Failed events show:
  - [ ] Red border
  - [ ] AlertCircle icon (red)
  - [ ] "Failed" badge
- [ ] Score and threshold display (e.g., "Score: 85 / Threshold: 90")
- [ ] Violations list shows for failures (comma-separated)
- [ ] Timestamps display correctly (relative time)
- [ ] Events sorted by most recent first

**Expected**: Clear pass/fail visual distinction

### Test 12: Real-Time Updates (if WebSocket connected)
- [ ] Trigger quality update - score updates live without page refresh
- [ ] New quality gate event appears automatically
- [ ] Violation counts increment in real-time
- [ ] No page flickering during updates

**Expected**: Smooth real-time updates (if backend running)

---

## Component C: Dashboard (Feedback Loops)

**Location**: Navigate to Feedback Loops Dashboard
**File**: `frontend/src/components/FeedbackLoops/Dashboard.tsx`

### Test 13: Header
- [ ] Title displays "Feedback Loops Dashboard"
- [ ] Refresh button visible with icon (circular arrows)
- [ ] Click refresh - loading state shows, then data re-fetches
- [ ] Refresh completes within reasonable time

**Expected**: Clear header, functional refresh

### Test 14: Error Handling
- [ ] Simulate API failure - error alert displays at top
- [ ] Alert has red/error styling
- [ ] Close button (X) dismisses error
- [ ] Error doesn't block UI (can still interact with page)
- [ ] Error message is informative

**Expected**: Non-blocking error display

### Test 15: Statistics Cards
- [ ] 3 cards display:
  - [ ] Prompt Refinement (TrendingUp icon)
  - [ ] Tool Tuning (Settings icon)
  - [ ] Workflow Optimizer (Gauge icon)
- [ ] Icons display correctly (lucide-react icons)
- [ ] Total runs count displays (number)
- [ ] Last run timestamp displays (relative time)
- [ ] Metric-specific stats display:
  - [ ] Prompt Refinement: Average improvement %
  - [ ] Tool Tuning: Tools optimized count
  - [ ] Workflow Optimizer: Time saved

**Expected**: Clear stats overview, readable numbers

### Test 16: Pending Approvals Section
- [ ] Count shows in header (e.g., "3 pending approvals")
- [ ] 4 tabs visible:
  - [ ] All
  - [ ] Prompt Refinement
  - [ ] Tool Tuning
  - [ ] Workflow Optimization
- [ ] Tab filtering works:
  - [ ] Click "Prompt Refinement" - only shows prompt items
  - [ ] Click "All" - shows all items
- [ ] Empty state shows "No pending approvals" when list is empty
- [ ] Empty state has friendly message

**Expected**: Functional tab filtering, clear empty state

### Test 17: Recommendation Items
- [ ] Title displays correctly for each type:
  - [ ] Prompt Refinement: Shows prompt changes
  - [ ] Tool Tuning: Shows tool names
  - [ ] Workflow Optimization: Shows workflow name
- [ ] Secondary info shows:
  - [ ] Prompt Refinement: Improvement % (e.g., "+15% improvement")
  - [ ] Tool Tuning: Tool counts (e.g., "3 tools to remove")
  - [ ] Workflow Optimization: Time savings (e.g., "Save 2.5 hours")
- [ ] Timestamp displays (relative time, e.g., "2h ago")
- [ ] Hover effect on items (background changes)
- [ ] Info button (i icon) visible on each item

**Expected**: Clear item layout, readable info

### Test 18: Approval Dialog
- [ ] Click info button on any item - dialog opens
- [ ] Dialog displays over page with modal overlay (background dimmed)
- [ ] Dialog title shows "Review Recommendation"
- [ ] Badge shows recommendation type (colored badge)
- [ ] Dialog scrolls if content is long
- [ ] Click outside dialog - dialog closes
- [ ] Press Escape key - dialog closes

**Expected**: Proper modal behavior, accessible

### Test 19: Dialog Content (by type)

#### Prompt Refinement Dialog:
- [ ] "Changes" section displays
- [ ] Before/after prompt text shown
- [ ] A/B test results show:
  - [ ] Version A percentage
  - [ ] Version B percentage
  - [ ] Winner highlighted
- [ ] P-value displays (statistical significance)
- [ ] Improvement highlighted in green

#### Tool Tuning Dialog:
- [ ] "Tools to Remove" section (if applicable)
  - [ ] Tool names listed
  - [ ] Reason for removal shown
- [ ] "Tools to Allow" section (if applicable)
  - [ ] Tool names listed
  - [ ] Justification shown
- [ ] "Successful Patterns" section (if applicable)
  - [ ] Pattern description
  - [ ] Success rate

#### Workflow Optimization Dialog:
- [ ] Simulation results display
- [ ] Time improvement highlighted (e.g., "-30% execution time")
- [ ] Cost improvements highlighted (e.g., "-20% API costs")
- [ ] "Bottlenecks" section (if applicable)
  - [ ] Bottleneck descriptions
- [ ] Parallelization opportunities count
- [ ] Redundant steps count

**Expected**: Type-specific details clearly displayed

### Test 20: Approval Actions
- [ ] "Approval notes" textarea displays at bottom of dialog
- [ ] Can type in textarea (no character limit warning)
- [ ] Reject button shows with X icon
- [ ] Reject button has red/danger styling
- [ ] Approve button shows with CheckCircle icon
- [ ] Approve button has green/success styling
- [ ] Click Reject:
  - [ ] Loading spinner shows on button
  - [ ] Dialog closes after action completes
  - [ ] Item removed from list
- [ ] Click Approve:
  - [ ] Loading spinner shows on button
  - [ ] Dialog closes after action completes
  - [ ] Item removed from list
- [ ] List refreshes after approval/rejection

**Expected**: Functional approval workflow, smooth UX

### Test 21: Responsive Design
- [ ] Desktop (1920px):
  - [ ] Stats cards in 3-column grid
  - [ ] Dialog centered, max-width 600px
- [ ] Tablet (768px):
  - [ ] Stats cards in 2-column grid
  - [ ] Dialog adapts to screen width
- [ ] Mobile (375px):
  - [ ] Stats cards stack vertically (1 column)
  - [ ] Dialog full-width with padding
  - [ ] Dialog scrolls on small screens
  - [ ] Tabs scroll horizontally if needed

**Expected**: Usable on all screen sizes

---

## Component D: ScheduleClaudeTaskDialog

**Location**: Find trigger to open ScheduleClaudeTaskDialog
**File**: `frontend/src/components/scheduling/ScheduleClaudeTaskDialog.tsx`

### Test 22: Dialog Behavior
- [ ] Dialog opens when triggered (button click or other trigger)
- [ ] Dialog displays over page with modal overlay
- [ ] Click outside dialog - dialog closes (onOpenChange triggered)
- [ ] Click Cancel button - dialog closes
- [ ] Press Escape key - dialog closes
- [ ] Dialog has proper overlay (background dimmed)

**Expected**: Standard modal behavior

### Test 23: Form Fields
- [ ] **Title** input:
  - [ ] Label: "Task Title"
  - [ ] Input type: text
  - [ ] Required indicator (*)
  - [ ] Can type text
- [ ] **Description** input:
  - [ ] Label: "Description"
  - [ ] Input type: text
  - [ ] Optional (no *)
  - [ ] Can type text
- [ ] **Prompt** textarea:
  - [ ] Label: "Claude Prompt"
  - [ ] 4 rows visible
  - [ ] Required indicator (*)
  - [ ] Can type multi-line text
- [ ] **Scheduled Time** input:
  - [ ] Label: "Scheduled Time"
  - [ ] Input type: datetime-local
  - [ ] Date/time picker opens
  - [ ] Can select future date/time
- [ ] **Recurrence** select:
  - [ ] Label: "Recurrence"
  - [ ] Native select dropdown
  - [ ] 4 options visible:
    - [ ] Once
    - [ ] Daily
    - [ ] Weekly
    - [ ] Monthly
  - [ ] Can change selection
- [ ] **Agent Type** select:
  - [ ] Label: "Agent Type"
  - [ ] Native select dropdown
  - [ ] 5 options visible:
    - [ ] coder
    - [ ] researcher
    - [ ] tester
    - [ ] reviewer
    - [ ] analyst
  - [ ] Can change selection
- [ ] **YOLO Mode** checkbox:
  - [ ] Label: "YOLO Mode"
  - [ ] Checkbox toggles on/off
  - [ ] Checked state visible
- [ ] **Max Execution Time** input:
  - [ ] Label: "Max Execution Time (seconds)"
  - [ ] Input type: number
  - [ ] Range: 60-7200 (1 min - 2 hours)
  - [ ] Can type number

**Expected**: All form fields functional, clear labels

### Test 24: Form Validation
- [ ] Submit without title:
  - [ ] Validation error displays
  - [ ] Error message: "Title is required"
  - [ ] Input highlighted with red border
- [ ] Submit without prompt:
  - [ ] Validation error displays
  - [ ] Error message: "Prompt is required"
  - [ ] Textarea highlighted with red border
- [ ] Submit without scheduled time:
  - [ ] Validation error displays
  - [ ] Error message: "Scheduled time is required"
- [ ] Submit with all required fields:
  - [ ] No validation errors
  - [ ] Form submits successfully

**Expected**: Proper client-side validation

### Test 25: Form Submission
- [ ] Fill all required fields:
  - [ ] Title: "Test Task"
  - [ ] Prompt: "Analyze code quality"
  - [ ] Scheduled Time: Future date/time
- [ ] Click "Schedule Task" button:
  - [ ] Button shows loading state (spinner)
  - [ ] Button disabled during submission
- [ ] On success:
  - [ ] Form resets (all fields cleared)
  - [ ] Dialog closes
  - [ ] Success message/toast (if implemented)
- [ ] On error:
  - [ ] Error message displays in red alert
  - [ ] Error persists until next submit attempt
  - [ ] Form fields retain values

**Expected**: Smooth submission flow, clear feedback

### Test 26: Visual Consistency
- [ ] Dialog uses same styling as other dialogs (Dashboard)
- [ ] Buttons styled consistently (primary/secondary)
- [ ] Focus states on inputs:
  - [ ] Blue ring appears on focus
  - [ ] Clear visual indicator
- [ ] Spacing looks correct (not cramped)
- [ ] Labels aligned properly
- [ ] Input heights consistent

**Expected**: Consistent design system usage

---

## Cross-Component Tests

### Test 27: Navigation Between Components
- [ ] Navigate from QualityMetrics to AgentQualityTable (via Agents tab)
- [ ] Navigate from Dashboard to other sections
- [ ] No state loss when switching components
- [ ] No console errors during navigation

### Test 28: Theme Consistency
- [ ] All components use dark theme
- [ ] Text colors consistent (primary/secondary/accent)
- [ ] Background colors consistent
- [ ] Border colors consistent
- [ ] Hover states consistent across all interactive elements

### Test 29: Performance
- [ ] Page load time < 3 seconds
- [ ] Tab switching < 500ms
- [ ] Search filtering instant (<100ms)
- [ ] No visible lag when sorting
- [ ] Smooth animations (progress bars, spinners)

---

## Browser Compatibility

### Test 30: Chrome
- [ ] All tests above pass in Chrome
- [ ] No console errors
- [ ] No layout issues

### Test 31: Firefox
- [ ] All tests above pass in Firefox
- [ ] Native select dropdowns work
- [ ] Dialog modals work
- [ ] No console errors

### Test 32: Edge (Optional)
- [ ] Critical flows work in Edge
- [ ] No major layout issues

---

## Accessibility

### Test 33: Keyboard Navigation
- [ ] Tab key navigates through all interactive elements
- [ ] Enter key activates buttons
- [ ] Escape key closes dialogs
- [ ] Arrow keys work in select dropdowns
- [ ] Focus visible (blue ring around focused element)

### Test 34: Screen Reader (Optional)
- [ ] Use NVDA or Windows Narrator
- [ ] Table headers announced
- [ ] Button labels announced
- [ ] Form labels announced
- [ ] Error messages announced
- [ ] ARIA roles recognized

---

## Bug Tracking Template

Use this template to document any issues found:

```markdown
## Bug #[Number]

**Component**: [AgentQualityTable | QualityMetrics | Dashboard | ScheduleClaudeTaskDialog]
**Test**: [Test number and name]
**Severity**: [Critical | High | Medium | Low]
**Browser**: [Chrome | Firefox | Edge]
**Screen Size**: [Desktop | Tablet | Mobile]

**Steps to Reproduce**:
1.
2.
3.

**Expected Behavior**:
[What should happen]

**Actual Behavior**:
[What actually happens]

**Screenshots**:
[Attach screenshots]

**Console Errors**:
[Copy any console errors]

**Additional Notes**:
[Any other relevant information]
```

---

## Testing Completion Checklist

- [ ] All 34 tests executed
- [ ] All bugs documented using template above
- [ ] Screenshots captured for visual issues
- [ ] Console errors logged
- [ ] Cross-browser testing complete
- [ ] Responsive testing complete
- [ ] Accessibility testing complete
- [ ] Final report created with results

---

## Next Steps After Testing

1. **If bugs found**: Create GitHub issues or fix immediately
2. **If all tests pass**: Proceed to production deployment
3. **Document results**: Update MIGRATION_VERIFICATION_COMPLETE.md with manual test results
4. **Create comparison**: Before/after screenshots if needed

---

**End of Manual Testing Guide**

**Estimated Time**: 2-4 hours
**Recommended Approach**: Test one component at a time, document issues immediately
