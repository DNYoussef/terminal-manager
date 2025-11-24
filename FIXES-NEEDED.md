# Terminal Manager - Fixes Needed

**Date**: 2025-11-18
**Status**: 2/3 Complete

---

## 1. Memory MCP Startup ✅ COMPLETE

**Status**: Fixed
**Location**: `C:\Users\17175\scripts\startup\terminal-manager-startup.ps1`

**What was done**:
- Added `Start-MemoryMCP` function (lines 280-323)
- Integrated as Step 0.5 in main execution (lines 363-368)
- Auto-detects if Memory MCP already running
- Starts triple-layer Memory MCP server on bootup

**Test**: Run `START-TERMINAL-MANAGER.bat` and verify Memory MCP starts

---

## 2. Project Creation/Opening Broken ❌ NEEDS FIX

**Problem**: Cannot create new projects or open existing folders in the UI

**Root Cause**: Frontend button logic disabling buttons

### Backend Status: ✅ WORKING
- API endpoints exist and functional:
  - `POST /api/v1/projects/create` - Create new project
  - `POST /api/v1/projects/attach-session` - Open existing folder
  - `GET /api/v1/projects/browse` - Browse filesystem
- All security validations in place
- Database operations working

### Frontend Status: ❌ BROKEN
**Files to fix**:
- `terminal-manager/frontend/src/components/ProjectDialog.tsx` (likely)
- `terminal-manager/frontend/src/components/ProjectSelector.tsx` (likely)

**What needs to happen**:
1. **"Create Project & Open Terminal" button**:
   - Currently: Always disabled
   - Should be: Enabled when project name input has value
   - Logic needed: `disabled={!projectName || projectName.trim() === ''}`

2. **"Open Terminal" button** (in filesystem browser):
   - Currently: Always disabled
   - Should be: Enabled when a folder is selected
   - Logic needed: `disabled={!selectedPath || !isDirectory}`

### Quick Fix (Frontend)

```tsx
// In ProjectDialog.tsx or similar

// For "Create Project" button
<Button
  disabled={!projectName || projectName.trim() === ''}
  onClick={handleCreateProject}
>
  Create Project & Open Terminal
</Button>

// For "Open Terminal" button
<Button
  disabled={!selectedPath || !isDirectory(selectedPath)}
  onClick={handleOpenTerminal}
>
  Open Terminal
</Button>
```

---

## 3. Post-Task Hook Agent Activity Tracking ❌ NEEDS IMPLEMENTATION (Partially Complete)

**Problem**: Agent activity (from post-task hooks) not being saved to database for UI transparency

**Status**: Database schema and API code provided in this document (lines 86-242). Backend implementation pending.

**Requirements**:
- Track: Agent name, summary of actions, timestamp, reason/intent, associated terminal_id, associated project_id
- Store in database for UI display
- UI should show "Agent Activity Feed" with this information

### Database Schema Needed

```sql
-- Create agent_activity table
CREATE TABLE IF NOT EXISTS agent_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name VARCHAR(255) NOT NULL,
    summary TEXT NOT NULL,
    reason VARCHAR(500),
    terminal_id UUID REFERENCES terminals(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for performance
CREATE INDEX idx_agent_activity_terminal ON agent_activity(terminal_id);
CREATE INDEX idx_agent_activity_project ON agent_activity(project_id);
CREATE INDEX idx_agent_activity_created_at ON agent_activity(created_at DESC);
CREATE INDEX idx_agent_activity_agent_name ON agent_activity(agent_name);
```

### Backend Model Needed

**File**: `terminal-manager/backend/app/models/agent_activity.py`

```python
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

from app.db_setup import Base


class AgentActivity(Base):
    __tablename__ = "agent_activity"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_name = Column(String(255), nullable=False, index=True)
    summary = Column(Text, nullable=False)
    reason = Column(String(500))
    terminal_id = Column(UUID(as_uuid=True), ForeignKey('terminals.id', ondelete='CASCADE'))
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id', ondelete='CASCADE'))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    metadata = Column(JSON, default=dict)

    # Relationships
    terminal = relationship("Terminal", back_populates="agent_activities")
    project = relationship("Project", back_populates="agent_activities")
```

### Backend Router Needed

**File**: `terminal-manager/backend/app/routers/agent_activity.py`

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid

from app.db_setup import get_db
from app.models.agent_activity import AgentActivity

router = APIRouter(prefix="/agent-activity", tags=["agent-activity"])


class AgentActivityCreate(BaseModel):
    agent_name: str
    summary: str
    reason: Optional[str] = None
    terminal_id: Optional[str] = None
    project_id: Optional[str] = None
    metadata: Optional[dict] = {}


class AgentActivityResponse(BaseModel):
    id: str
    agent_name: str
    summary: str
    reason: Optional[str]
    terminal_id: Optional[str]
    project_id: Optional[str]
    created_at: datetime
    metadata: dict


@router.post("/", response_model=AgentActivityResponse)
async def create_activity(
    activity: AgentActivityCreate,
    db: Session = Depends(get_db)
):
    """Create new agent activity record"""
    record = AgentActivity(
        id=str(uuid.uuid4()),
        agent_name=activity.agent_name,
        summary=activity.summary,
        reason=activity.reason,
        terminal_id=activity.terminal_id,
        project_id=activity.project_id,
        metadata=activity.metadata or {}
    )

    db.add(record)
    db.commit()
    db.refresh(record)

    return AgentActivityResponse(
        id=str(record.id),
        agent_name=record.agent_name,
        summary=record.summary,
        reason=record.reason,
        terminal_id=str(record.terminal_id) if record.terminal_id else None,
        project_id=str(record.project_id) if record.project_id else None,
        created_at=record.created_at,
        metadata=record.metadata
    )


@router.get("/", response_model=List[AgentActivityResponse])
async def list_activities(
    limit: int = Query(default=50, le=200),
    project_id: Optional[str] = None,
    terminal_id: Optional[str] = None,
    agent_name: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List agent activities with optional filters"""
    query = db.query(AgentActivity).order_by(AgentActivity.created_at.desc())

    if project_id:
        query = query.filter(AgentActivity.project_id == project_id)
    if terminal_id:
        query = query.filter(AgentActivity.terminal_id == terminal_id)
    if agent_name:
        query = query.filter(AgentActivity.agent_name == agent_name)

    activities = query.limit(limit).all()

    return [
        AgentActivityResponse(
            id=str(a.id),
            agent_name=a.agent_name,
            summary=a.summary,
            reason=a.reason,
            terminal_id=str(a.terminal_id) if a.terminal_id else None,
            project_id=str(a.project_id) if a.project_id else None,
            created_at=a.created_at,
            metadata=a.metadata
        )
        for a in activities
    ]
```

### Post-Task Hook Integration

**File**: `terminal-manager/hooks/12fa/post-task.hook.js` (or create new enhanced version)

```javascript
const axios = require('axios');

async function saveAgentActivity(agentName, summary, reason, metadata = {}) {
    try {
        // Get current project/terminal context
        const projectId = process.env.CLAUDE_PROJECT_ID || null;
        const terminalId = process.env.CLAUDE_TERMINAL_ID || null;

        // Call backend API
        await axios.post('http://localhost:8000/api/v1/agent-activity/', {
            agent_name: agentName,
            summary: summary,
            reason: reason,
            terminal_id: terminalId,
            project_id: projectId,
            metadata: {
                ...metadata,
                timestamp: new Date().toISOString(),
                cwd: process.cwd()
            }
        });

        console.log(`[Agent Activity] Logged: ${agentName} - ${summary}`);
    } catch (error) {
        console.error(`[Agent Activity] Failed to log activity: ${error.message}`);
        // Don't fail the hook if logging fails
    }
}

// Export for use in post-task hooks
module.exports = { saveAgentActivity };
```

**Usage in post-task hook**:

```javascript
const { saveAgentActivity } = require('./agent-activity-logger');

// In your post-task hook
async function onPostTask(taskData) {
    const agentName = taskData.agent || 'unknown';
    const summary = taskData.description || 'Completed task';
    const reason = taskData.intent || 'User requested';

    // Save to database for UI transparency
    await saveAgentActivity(agentName, summary, reason, {
        task_id: taskData.id,
        duration: taskData.duration,
        files_modified: taskData.files_modified || []
    });
}
```

---

## Implementation Steps

### Step 1: Create Agent Activity Tracking (Backend)

```bash
# 1. Create migration
cd C:\Users\17175\terminal-manager\backend
python -c "from app.db_setup import engine; from app.models.agent_activity import AgentActivity; AgentActivity.metadata.create_all(engine)"

# 2. Add router to main.py
# Edit app/main.py and add:
# from app.routers import agent_activity
# app.include_router(agent_activity.router, prefix="/api/v1", tags=["agent-activity"])

# 3. Test API
curl http://localhost:8000/api/v1/agent-activity/
```

### Step 2: Fix Project Creation (Frontend)

```bash
cd C:\Users\17175\terminal-manager\frontend

# Find the ProjectDialog component
# Update button disabled logic:
# - Create button: disabled={!projectName?.trim()}
# - Open Terminal button: disabled={!selectedPath || !isDirectory}
```

### Step 3: Test End-to-End

```bash
# 1. Restart backend
cd C:\Users\17175\terminal-manager\backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 2. Test project creation
# Open http://localhost:3002
# Click "Open Project"
# Type project name -> button should enable
# Select folder -> "Open Terminal" should enable

# 3. Test agent activity logging
curl -X POST http://localhost:8000/api/v1/agent-activity/ \
  -H "Content-Type: application/json" \
  -d '{"agent_name":"test-agent","summary":"Test activity","reason":"testing"}'

curl http://localhost:8000/api/v1/agent-activity/
```

---

## 4. Calendar Claude Code Integration ✅ ARCHITECTURE COMPLETE / ⏳ IMPLEMENTATION PENDING

**Problem**: Calendar should trigger Claude Code instances in YOLO mode with automated reporting

**Status**: ✅ Architecture & API complete, ⏳ Full scheduler implementation pending

### What's Complete:

1. **Database Schema** ✅:
   - `scheduled_claude_tasks` table
   - `task_execution_reports` table
   - SQL migration: `create_scheduled_tasks_tables.sql`

2. **Backend Models** ✅:
   - `ScheduledClaudeTask` model (`app/models/scheduled_claude_task.py`)
   - `TaskExecutionReport` model
   - Complete relationships with Project and Terminal

3. **API Endpoints** ✅ (6 endpoints):
   - `POST /api/v1/scheduled-tasks/` - Create task
   - `GET /api/v1/scheduled-tasks/` - List tasks
   - `GET /api/v1/scheduled-tasks/{task_id}` - Get details
   - `DELETE /api/v1/scheduled-tasks/{task_id}` - Delete task
   - `POST /api/v1/scheduled-tasks/{task_id}/trigger` - Manual trigger
   - `GET /api/v1/scheduled-tasks/{task_id}/reports` - Execution history

4. **Scheduler Service** ⏳ (Stub created):
   - `app/services/claude_scheduler.py` (stub for API functionality)
   - Full implementation: See `CALENDAR-IMPLEMENTATION-GUIDE.md`

5. **Documentation** ✅:
   - Complete architecture: `docs/CALENDAR-CLAUDE-INTEGRATION-ARCHITECTURE.md`
   - Implementation guide: `CALENDAR-IMPLEMENTATION-GUIDE.md`

### Quick Start (15 minutes):

```bash
# 1. Install APScheduler
cd C:\Users\17175\terminal-manager\backend
pip install APScheduler==3.10.4

# 2. Run database migration
psql -U postgres -d terminal_db -f create_scheduled_tasks_tables.sql

# 3. Update main.py (see CALENDAR-IMPLEMENTATION-GUIDE.md line 145)

# 4. Test API
curl -X POST http://localhost:8000/api/v1/scheduled-tasks/ \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","prompt":"echo hello","scheduled_time":"2025-11-18T17:00:00Z"}'
```

### Next Steps:
1. Run database migration (2 minutes)
2. Update `main.py` to add router (3 minutes)
3. Implement full scheduler service (2-3 hours) - See architecture doc
4. Create frontend components (1-2 hours)

**All code ready**: See `CALENDAR-IMPLEMENTATION-GUIDE.md` for complete instructions.

---

## Priority

1. **HIGH**: Fix project creation buttons (frontend) - Users can't use the app
2. **MEDIUM**: Implement agent activity tracking - Transparency feature
3. **MEDIUM**: Complete calendar scheduler implementation - Backend scheduler service + frontend components
4. **DONE**: Memory MCP startup - Completed
5. **DONE**: Calendar architecture & API - Complete, ready for implementation

---

## Next Actions

**For Project Creation Fix**:
1. Locate `frontend/src/components/ProjectDialog.tsx` (or similar)
2. Find the button components
3. Update `disabled` props with proper logic
4. Test in UI

**For Agent Activity Tracking**:
1. Create `backend/app/models/agent_activity.py`
2. Create `backend/app/routers/agent_activity.py`
3. Add router to `backend/app/main.py`
4. Run database migration
5. Update post-task hook to call API
6. Create UI component to display activity feed

---

**Files Created**:
- Startup script updated: `scripts/startup/terminal-manager-startup.ps1`
- Test report: `terminal-manager/UI-COMPREHENSIVE-TEST-REPORT.md`
- This document: `terminal-manager/FIXES-NEEDED.md`
