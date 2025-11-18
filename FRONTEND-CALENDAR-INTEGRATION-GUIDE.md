# Frontend Calendar Integration Guide

**Status**: Backend Complete, Frontend Integration Pending
**Date**: 2025-11-18

---

## Overview

The calendar Claude Code scheduler backend is **100% complete**. This guide shows you how to connect the existing calendar UI to the new API endpoints.

---

## Backend API Endpoints (Ready to Use)

### Base URL
```
http://localhost:8000/api/v1/scheduled-claude-tasks/
```

### Available Endpoints

#### 1. Create Scheduled Task
```typescript
POST /api/v1/scheduled-claude-tasks/

Request Body:
{
  title: string,                    // "Daily Code Review"
  description?: string,             // Optional description
  prompt: string,                   // Claude Code prompt
  scheduled_time: string,           // ISO datetime "2025-11-19T09:00:00Z"
  recurrence: string,               // "once" | "daily" | "weekly" | "monthly"
  yolo_mode_enabled: boolean,       // true for autonomous execution
  agent_type?: string,              // "reviewer", "coder", "researcher", etc.
  max_execution_time?: number,      // Timeout in seconds (default: 3600)
  playbook?: string,                // Optional playbook name
  skills?: string[],                // Optional skills array
  project_id?: string,              // Optional project UUID
  terminal_id?: string              // Optional terminal UUID
}

Response:
{
  id: string,                       // Task UUID
  title: string,
  scheduled_time: string,
  recurrence: string,
  status: string,                   // "pending"
  next_execution_time: string,
  execution_count: number,
  created_at: string,
  updated_at: string
}
```

#### 2. List All Tasks
```typescript
GET /api/v1/scheduled-claude-tasks/

Response: Task[]
```

#### 3. Get Single Task
```typescript
GET /api/v1/scheduled-claude-tasks/{task_id}

Response: Task
```

#### 4. Delete Task
```typescript
DELETE /api/v1/scheduled-claude-tasks/{task_id}

Response: 200 OK
```

#### 5. Manually Trigger Task
```typescript
POST /api/v1/scheduled-claude-tasks/{task_id}/trigger

Response:
{
  message: "Task triggered successfully",
  task_id: string
}
```

#### 6. Get Execution Reports
```typescript
GET /api/v1/scheduled-claude-tasks/{task_id}/reports

Response: ExecutionReport[]

ExecutionReport {
  id: string,
  scheduled_task_id: string,
  execution_start_time: string,
  execution_end_time: string,
  duration_seconds: number,
  status: string,                   // "success" | "failed" | "timeout"
  exit_code: number,
  summary: string,                  // AI-generated summary
  files_created: string[],
  files_modified: string[],
  commands_executed: number,
  success: boolean,
  errors: string[]
}
```

#### 7. Get Full Logs
```typescript
GET /api/v1/scheduled-claude-tasks/{task_id}/reports/{report_id}/logs

Response:
{
  report_id: string,
  full_log_path: string,
  log_content: string
}
```

---

## Frontend Integration Steps

### Step 1: Create API Service

**File**: `frontend/src/services/scheduledTasksApi.ts`

```typescript
import axios from 'axios';

const API_BASE = 'http://localhost:8000/api/v1/scheduled-claude-tasks';

export interface ScheduledTaskCreate {
  title: string;
  description?: string;
  prompt: string;
  scheduled_time: string;
  recurrence: string;
  yolo_mode_enabled: boolean;
  agent_type?: string;
  max_execution_time?: number;
  playbook?: string;
  skills?: string[];
  project_id?: string;
  terminal_id?: string;
}

export interface ScheduledTask {
  id: string;
  title: string;
  description?: string;
  scheduled_time: string;
  recurrence: string;
  status: string;
  next_execution_time?: string;
  execution_count: number;
  created_at: string;
  updated_at: string;
}

export interface ExecutionReport {
  id: string;
  scheduled_task_id: string;
  execution_start_time: string;
  execution_end_time?: string;
  duration_seconds?: number;
  status: string;
  summary?: string;
  files_created?: string[];
  files_modified?: string[];
  commands_executed?: number;
  success: boolean;
  errors?: string[];
}

export const scheduledTasksApi = {
  // Create new scheduled task
  create: async (task: ScheduledTaskCreate): Promise<ScheduledTask> => {
    const response = await axios.post(`${API_BASE}/`, task);
    return response.data;
  },

  // List all tasks
  list: async (): Promise<ScheduledTask[]> => {
    const response = await axios.get(`${API_BASE}/`);
    return response.data;
  },

  // Get single task
  get: async (taskId: string): Promise<ScheduledTask> => {
    const response = await axios.get(`${API_BASE}/${taskId}`);
    return response.data;
  },

  // Delete task
  delete: async (taskId: string): Promise<void> => {
    await axios.delete(`${API_BASE}/${taskId}`);
  },

  // Manually trigger task
  trigger: async (taskId: string): Promise<{ message: string; task_id: string }> => {
    const response = await axios.post(`${API_BASE}/${taskId}/trigger`);
    return response.data;
  },

  // Get execution reports
  getReports: async (taskId: string): Promise<ExecutionReport[]> => {
    const response = await axios.get(`${API_BASE}/${taskId}/reports`);
    return response.data;
  },

  // Get full logs
  getLogs: async (taskId: string, reportId: string): Promise<{ log_content: string }> => {
    const response = await axios.get(`${API_BASE}/${taskId}/reports/${reportId}/logs`);
    return response.data;
  }
};
```

---

### Step 2: Create Schedule Dialog Component

**File**: `frontend/src/components/ScheduleClaudeTaskDialog.tsx`

```typescript
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { scheduledTasksApi } from '@/services/scheduledTasksApi';

interface Props {
  open: boolean;
  onClose: () => void;
  onTaskCreated?: () => void;
  initialDate?: Date;
}

export function ScheduleClaudeTaskDialog({ open, onClose, onTaskCreated, initialDate }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [prompt, setPrompt] = useState('');
  const [scheduledDate, setScheduledDate] = useState(
    initialDate ? initialDate.toISOString().slice(0, 16) : ''
  );
  const [recurrence, setRecurrence] = useState('once');
  const [yoloMode, setYoloMode] = useState(true);
  const [agentType, setAgentType] = useState('general-purpose');
  const [maxTime, setMaxTime] = useState('1800');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const task = {
        title,
        description,
        prompt,
        scheduled_time: new Date(scheduledDate).toISOString(),
        recurrence,
        yolo_mode_enabled: yoloMode,
        agent_type: agentType,
        max_execution_time: parseInt(maxTime),
      };

      await scheduledTasksApi.create(task);

      // Reset form
      setTitle('');
      setDescription('');
      setPrompt('');
      setScheduledDate('');
      setRecurrence('once');
      setAgentType('general-purpose');

      if (onTaskCreated) onTaskCreated();
      onClose();
    } catch (error) {
      console.error('Failed to create scheduled task:', error);
      alert('Failed to create scheduled task. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Claude Code Task</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <Label htmlFor="title">Task Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Daily code review"
              required
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>

          {/* Prompt */}
          <div>
            <Label htmlFor="prompt">Claude Code Prompt *</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Review all Python files and suggest improvements..."
              rows={4}
              required
            />
          </div>

          {/* Scheduled Time */}
          <div>
            <Label htmlFor="scheduled_time">Scheduled Time *</Label>
            <Input
              id="scheduled_time"
              type="datetime-local"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              required
            />
          </div>

          {/* Recurrence */}
          <div>
            <Label htmlFor="recurrence">Recurrence</Label>
            <Select value={recurrence} onValueChange={setRecurrence}>
              <SelectTrigger>
                <SelectValue placeholder="Select recurrence" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="once">Once</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Agent Type */}
          <div>
            <Label htmlFor="agent_type">Agent Type</Label>
            <Select value={agentType} onValueChange={setAgentType}>
              <SelectTrigger>
                <SelectValue placeholder="Select agent type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general-purpose">General Purpose</SelectItem>
                <SelectItem value="coder">Coder</SelectItem>
                <SelectItem value="reviewer">Reviewer</SelectItem>
                <SelectItem value="researcher">Researcher</SelectItem>
                <SelectItem value="tester">Tester</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* YOLO Mode */}
          <div className="flex items-center space-x-2">
            <Switch
              id="yolo_mode"
              checked={yoloMode}
              onCheckedChange={setYoloMode}
            />
            <Label htmlFor="yolo_mode">
              YOLO Mode (Autonomous Execution)
            </Label>
          </div>

          {/* Max Execution Time */}
          <div>
            <Label htmlFor="max_time">Max Execution Time (seconds)</Label>
            <Input
              id="max_time"
              type="number"
              value={maxTime}
              onChange={(e) => setMaxTime(e.target.value)}
              min="60"
              max="7200"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Schedule Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

### Step 3: Integrate with Calendar Page

**File**: `frontend/src/pages/Schedule.tsx` (update existing file)

```typescript
import React, { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { ScheduleClaudeTaskDialog } from '@/components/ScheduleClaudeTaskDialog';
import { scheduledTasksApi, ScheduledTask } from '@/services/scheduledTasksApi';
import { Plus } from 'lucide-react';

export function Schedule() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(false);

  // Load scheduled tasks
  const loadTasks = async () => {
    setLoading(true);
    try {
      const fetchedTasks = await scheduledTasksApi.list();
      setTasks(fetchedTasks);
    } catch (error) {
      console.error('Failed to load scheduled tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  // Filter tasks for selected date
  const tasksForSelectedDate = selectedDate
    ? tasks.filter(task => {
        const taskDate = new Date(task.scheduled_time);
        return (
          taskDate.getDate() === selectedDate.getDate() &&
          taskDate.getMonth() === selectedDate.getMonth() &&
          taskDate.getFullYear() === selectedDate.getFullYear()
        );
      })
    : [];

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Schedule</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Schedule Claude Task
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar */}
        <div className="border rounded-lg p-4">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="rounded-md border"
          />

          {/* Task markers on calendar */}
          <div className="mt-4">
            <h3 className="font-semibold mb-2">Scheduled Tasks:</h3>
            {loading ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : tasks.length === 0 ? (
              <p className="text-sm text-gray-500">No scheduled tasks</p>
            ) : (
              <div className="text-sm">
                {tasks.map(task => (
                  <div key={task.id} className="py-1">
                    <span className="font-medium">{new Date(task.scheduled_time).toLocaleDateString()}</span>
                    {' - '}
                    <span>{task.title}</span>
                    {' '}
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {task.recurrence}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tasks for selected date */}
        <div className="border rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">
            {selectedDate ? selectedDate.toLocaleDateString() : 'Select a date'}
          </h2>

          {tasksForSelectedDate.length === 0 ? (
            <p className="text-gray-500">No tasks scheduled for this date</p>
          ) : (
            <div className="space-y-3">
              {tasksForSelectedDate.map(task => (
                <div key={task.id} className="border rounded p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{task.title}</h3>
                      <p className="text-sm text-gray-600">
                        {new Date(task.scheduled_time).toLocaleTimeString()}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Status: {task.status} | Executions: {task.execution_count}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await scheduledTasksApi.trigger(task.id);
                          alert('Task triggered successfully!');
                        } catch (error) {
                          alert('Failed to trigger task');
                        }
                      }}
                    >
                      Trigger Now
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Schedule Dialog */}
      <ScheduleClaudeTaskDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onTaskCreated={loadTasks}
        initialDate={selectedDate}
      />
    </div>
  );
}
```

---

## Testing the Integration

### 1. Start Backend
```bash
cd C:\Users\17175\terminal-manager\backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Test API Directly
```bash
# Create a test task
curl -X POST http://localhost:8000/api/v1/scheduled-claude-tasks/ \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Task",
    "prompt": "echo Hello World",
    "scheduled_time": "2025-11-19T10:00:00Z",
    "recurrence": "once",
    "yolo_mode_enabled": true
  }'

# List tasks
curl http://localhost:8000/api/v1/scheduled-claude-tasks/

# Get execution reports (after task runs)
curl http://localhost:8000/api/v1/scheduled-claude-tasks/{task-id}/reports
```

### 3. Test Frontend
1. Open `http://localhost:3002/schedule`
2. Click "Schedule Claude Task"
3. Fill in the form and submit
4. Verify task appears in calendar
5. Click "Trigger Now" to test manual execution
6. Check execution reports after completion

---

## Next Steps

1. **Backend Restart Required**: Manually restart the backend to load the scheduler
2. **Frontend Implementation**: Create the files above in your frontend project
3. **Styling**: Adjust UI components to match your design system
4. **Error Handling**: Add toast notifications for success/error messages
5. **Real-time Updates**: Consider WebSocket integration for live execution status

---

## Troubleshooting

### Backend Not Starting
- Check logs in terminal for import errors
- Verify .env file has correct DATABASE_URL
- Ensure APScheduler is installed: `pip install APScheduler==3.10.4`

### 404 Not Found on API Calls
- Backend may not have reloaded - manually restart it
- Check backend logs for router registration errors
- Verify URL: `http://localhost:8000/api/v1/scheduled-claude-tasks/`

### Tasks Not Executing
- Check scheduler logs in backend terminal
- Verify Claude Code CLI is in PATH
- Check `logs/scheduled-claude-tasks/` directory for execution logs

---

## Summary

**Backend**: ✅ 100% Complete
**Frontend**: ⏳ Integration code provided above
**API Docs**: Available at `http://localhost:8000/docs`

All backend infrastructure is ready. Just restart the backend and implement the frontend components above!
