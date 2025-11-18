# Calendar Claude Code Integration - Implementation Guide

**Status**: Architecture Complete, Backend In Progress
**Date**: 2025-11-18

---

## What's Been Completed

### ✅ Documentation
- [x] Complete architecture documentation (`docs/CALENDAR-CLAUDE-INTEGRATION-ARCHITECTURE.md`)
- [x] System design with database schema, API design, scheduler architecture
- [x] Security considerations and monitoring strategy

### ✅ Backend - Database
- [x] Database models created (`app/models/scheduled_claude_task.py`)
  - `ScheduledClaudeTask` model
  - `TaskExecutionReport` model
  - Complete with relationships and indexes
- [x] SQL migration script (`create_scheduled_tasks_tables.sql`)

### ✅ Backend - API
- [x] API router created (`app/routers/scheduled_claude_tasks.py`)
  - `POST /api/v1/scheduled-tasks/` - Create scheduled task
  - `GET /api/v1/scheduled-tasks/` - List all tasks
  - `GET /api/v1/scheduled-tasks/{task_id}` - Get task details
  - `DELETE /api/v1/scheduled-tasks/{task_id}` - Delete task
  - `POST /api/v1/scheduled-tasks/{task_id}/trigger` - Manually trigger task
  - `GET /api/v1/scheduled-tasks/{task_id}/reports` - Get execution history
  - `GET /api/v1/scheduled-tasks/{task_id}/reports/{report_id}/logs` - Get full logs

---

## What Still Needs to Be Done

### 🔨 CRITICAL - Backend Scheduler Service

**File**: `backend/app/services/claude_scheduler.py`

**Status**: NOT YET CREATED (stub needed for imports)

**What it does**:
- APScheduler background service that monitors database
- Triggers Claude Code execution at scheduled times
- Parses execution logs and creates reports
- Handles recurrence (daily, weekly, monthly)

**Quick Start** (if you need it working NOW):

```python
# Create a minimal stub for now:
# File: backend/app/services/claude_scheduler.py

def schedule_task(task_id: str, scheduled_time, recurrence: str):
    """TODO: Implement APScheduler task registration"""
    print(f"[STUB] Would schedule task {task_id} at {scheduled_time}")

def cancel_scheduled_task(task_id: str):
    """TODO: Implement task cancellation"""
    print(f"[STUB] Would cancel task {task_id}")

def trigger_task_now(task_id: str):
    """TODO: Implement immediate task execution"""
    print(f"[STUB] Would trigger task {task_id} now")

def init_scheduler():
    """TODO: Initialize APScheduler"""
    print("[STUB] Scheduler would initialize here")

def shutdown_scheduler():
    """TODO: Shutdown scheduler"""
    print("[STUB] Scheduler would shutdown here")
```

**Full Implementation** (see architecture doc lines 600-900 for complete code):
- APScheduler setup with BackgroundScheduler
- Claude Code CLI launcher with YOLO mode
- Log parsing and metric extraction
- Recurrence calculation

---

### 🔨 Backend Integration

#### 1. Install Dependencies

```bash
cd C:\Users\17175\terminal-manager\backend
pip install APScheduler==3.10.4
```

#### 2. Run Database Migration

```powershell
# Option A: Using psql
"C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -d terminal_db -f create_scheduled_tasks_tables.sql

# Option B: Using Python SQLAlchemy
python -c "from app.db_setup import engine; from app.models.scheduled_claude_task import Base; Base.metadata.create_all(engine)"
```

#### 3. Update `app/main.py`

Add these lines:

```python
from app.routers import scheduled_claude_tasks
from app.services.claude_scheduler import init_scheduler, shutdown_scheduler

# Register router
app.include_router(scheduled_claude_tasks.router, prefix="/api/v1", tags=["scheduled-claude-tasks"])

# Scheduler lifecycle (add to existing lifecycle hooks)
@app.on_event("startup")
async def startup_event():
    init_scheduler()
    logger.info("Claude Code Scheduler started")

@app.on_event("shutdown")
async def shutdown_event():
    shutdown_scheduler()
    logger.info("Claude Code Scheduler stopped")
```

#### 4. Update Model Relationships

**File**: `app/models/projects.py`

Add to `Project` class:

```python
scheduled_claude_tasks = relationship("ScheduledClaudeTask", back_populates="project")
```

**File**: `app/models/terminals.py`

Add to `Terminal` class:

```python
scheduled_claude_tasks = relationship("ScheduledClaudeTask", back_populates="terminal")
```

---

### 🔨 Frontend Integration

#### 1. Create Schedule Dialog Component

**File**: `frontend/src/components/ScheduleClaudeTaskDialog.tsx`

See architecture doc lines 1000-1150 for complete component code.

**Key features**:
- Title and prompt input
- Date/time picker
- Recurrence selector (once, daily, weekly, monthly)
- Agent type selector
- YOLO mode toggle

#### 2. Integrate with Calendar Page

**File**: `frontend/src/pages/Schedule.tsx`

Add button to open schedule dialog:

```typescript
import { ScheduleClaudeTaskDialog } from '@/components/ScheduleClaudeTaskDialog';

const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
const [selectedDate, setSelectedDate] = useState<Date | undefined>();

// Add button near calendar
<Button onClick={() => setScheduleDialogOpen(true)}>
  Schedule Claude Task
</Button>

// Add dialog
<ScheduleClaudeTaskDialog
  open={scheduleDialogOpen}
  onClose={() => setScheduleDialogOpen(false)}
  selectedDate={selectedDate}
/>
```

#### 3. Display Scheduled Tasks on Calendar

Fetch and display tasks on calendar:

```typescript
useEffect(() => {
  fetch('http://localhost:8000/api/v1/scheduled-tasks/')
    .then(res => res.json())
    .then(tasks => {
      // Map tasks to calendar events
      const events = tasks.map(task => ({
        id: task.id,
        title: task.title,
        start: new Date(task.scheduled_time),
        end: new Date(task.scheduled_time),
        backgroundColor: task.status === 'completed' ? '#22c55e' : '#3b82f6'
      }));

      setCalendarEvents(events);
    });
}, []);
```

#### 4. Create Execution Reports Page

**File**: `frontend/src/pages/ScheduledTaskReports.tsx`

- List all scheduled tasks
- Show execution history per task
- Display success/failure status
- Show summary and metrics
- Link to full logs

---

### 🔨 Testing Checklist

#### Backend API Tests

```bash
# 1. Create test scheduled task
curl -X POST http://localhost:8000/api/v1/scheduled-tasks/ \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Claude Task",
    "prompt": "Create a hello world Python script in /tmp/hello.py",
    "scheduled_time": "2025-11-18T17:00:00Z",
    "recurrence": "once",
    "yolo_mode_enabled": true,
    "agent_type": "coder",
    "max_execution_time": 300
  }'

# 2. List scheduled tasks
curl http://localhost:8000/api/v1/scheduled-tasks/

# 3. Get task details
curl http://localhost:8000/api/v1/scheduled-tasks/{task-id}

# 4. Manually trigger task (test execution)
curl -X POST http://localhost:8000/api/v1/scheduled-tasks/{task-id}/trigger

# 5. View execution reports
curl http://localhost:8000/api/v1/scheduled-tasks/{task-id}/reports

# 6. Delete task
curl -X DELETE http://localhost:8000/api/v1/scheduled-tasks/{task-id}
```

#### End-to-End Test

1. Open calendar UI: `http://localhost:3002/schedule`
2. Click "Schedule Claude Task"
3. Fill in:
   - Title: "Daily code review"
   - Prompt: "Review all files in src/ and suggest improvements"
   - Time: Tomorrow at 9:00 AM
   - Recurrence: Daily
   - Agent: reviewer
   - YOLO mode: Enabled
4. Click "Schedule Task"
5. Verify task appears in database: `SELECT * FROM scheduled_claude_tasks;`
6. Wait for scheduled time OR manually trigger
7. Check execution reports: `SELECT * FROM task_execution_reports;`
8. View logs in `logs/scheduled-claude-tasks/`

---

## Quick Start (Minimum Viable Implementation)

If you need this working TODAY, here's the fastest path:

### 1. Create Stub Scheduler (5 minutes)

```bash
cd backend/app/services
# Create claude_scheduler.py with stub functions (see above)
```

### 2. Install Dependencies (2 minutes)

```bash
pip install APScheduler==3.10.4
```

### 3. Run Migration (2 minutes)

```bash
psql -U postgres -d terminal_db -f create_scheduled_tasks_tables.sql
```

### 4. Update main.py (3 minutes)

Add router and lifecycle hooks (see above)

### 5. Test API (2 minutes)

```bash
curl -X POST http://localhost:8000/api/v1/scheduled-tasks/ \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","prompt":"echo hello","scheduled_time":"2025-11-18T17:00:00Z"}'
```

**Result**: API will work, tasks will be created in database. Scheduler won't execute yet (stub), but foundation is ready.

---

## Full Implementation (Complete Scheduler)

See `docs/CALENDAR-CLAUDE-INTEGRATION-ARCHITECTURE.md` lines 600-900 for:
- Complete `claude_scheduler.py` with APScheduler
- Claude Code CLI integration
- Log parsing
- Report generation
- Recurrence handling

---

## File Locations Summary

### Created Files (Ready)
- `backend/app/models/scheduled_claude_task.py` - ✅ Done
- `backend/app/routers/scheduled_claude_tasks.py` - ✅ Done
- `backend/create_scheduled_tasks_tables.sql` - ✅ Done
- `docs/CALENDAR-CLAUDE-INTEGRATION-ARCHITECTURE.md` - ✅ Done
- `CALENDAR-IMPLEMENTATION-GUIDE.md` (this file) - ✅ Done

### Needs Implementation
- `backend/app/services/claude_scheduler.py` - ⏳ Needs full implementation (stub available above)
- `frontend/src/components/ScheduleClaudeTaskDialog.tsx` - ⏳ React component
- `frontend/src/pages/ScheduledTaskReports.tsx` - ⏳ Reports page

### Needs Updates
- `backend/app/main.py` - Add router + lifecycle (3 lines)
- `backend/app/models/projects.py` - Add relationship (1 line)
- `backend/app/models/terminals.py` - Add relationship (1 line)
- `frontend/src/pages/Schedule.tsx` - Add dialog + events (20 lines)

---

## Priority Order

**If time is limited, do in this order**:

1. **[CRITICAL]** Create stub `claude_scheduler.py` (5 min) - Makes API work
2. **[HIGH]** Run database migration (2 min) - Creates tables
3. **[HIGH]** Update `main.py` with router (3 min) - Exposes API
4. **[MEDIUM]** Create frontend dialog component (30 min) - UI for scheduling
5. **[MEDIUM]** Integrate with Calendar page (15 min) - Show scheduled tasks
6. **[LOW]** Implement full scheduler service (2-3 hours) - Actual execution
7. **[LOW]** Create reports page (1 hour) - View execution history

---

## Next Steps

**Recommended**:
1. Run database migration NOW
2. Create stub scheduler NOW
3. Test API endpoints
4. Then implement full scheduler when you have time

**Questions?**
- Architecture: See `docs/CALENDAR-CLAUDE-INTEGRATION-ARCHITECTURE.md`
- Hooks: See `hooks/hooks.json` and `hooks/12fa/post-task.hook.js`
- Full code examples: See architecture doc lines 300-1200
