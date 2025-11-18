import React, { useState, useEffect } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { Button } from '../components/design-system/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/design-system/Card';
import { Badge } from '../components/design-system/Badge';
import { ScheduleClaudeTaskDialog } from '../components/scheduling/ScheduleClaudeTaskDialog';
import { claudeSchedulerApi, type ScheduledClaudeTask } from '../services/claudeSchedulerApi';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: ScheduledClaudeTask;
}

export const ClaudeScheduler: React.FC = () => {
  const [tasks, setTasks] = useState<ScheduledClaudeTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTask, setSelectedTask] = useState<ScheduledClaudeTask | null>(null);

  // Load tasks
  const loadTasks = async () => {
    setLoading(true);
    try {
      const fetchedTasks = await claudeSchedulerApi.list();
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

  // Convert tasks to calendar events
  const calendarEvents: CalendarEvent[] = tasks.map(task => ({
    id: task.id,
    title: task.title,
    start: new Date(task.scheduled_time),
    end: new Date(new Date(task.scheduled_time).getTime() + 60 * 60 * 1000), // +1 hour
    resource: task,
  }));

  // Handle task trigger
  const handleTriggerTask = async (taskId: string) => {
    try {
      await claudeSchedulerApi.trigger(taskId);
      alert('Task triggered successfully! Check execution reports shortly.');
    } catch (error) {
      alert(`Failed to trigger task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle task deletion
  const handleDeleteTask = async (taskId: string) => {
    if (confirm('Are you sure you want to delete this task?')) {
      try {
        await claudeSchedulerApi.delete(taskId);
        await loadTasks();
        setSelectedTask(null);
      } catch (error) {
        alert(`Failed to delete task: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  // Event style based on status
  const eventStyleGetter = (event: CalendarEvent) => {
    const task = event.resource;
    const colors = {
      pending: { bg: '#3b82f6', text: '#ffffff' },
      active: { bg: '#f59e0b', text: '#ffffff' },
      completed: { bg: '#22c55e', text: '#ffffff' },
      failed: { bg: '#ef4444', text: '#ffffff' },
      cancelled: { bg: '#6b7280', text: '#ffffff' },
    };

    const style = colors[task.status as keyof typeof colors] || colors.pending;

    return {
      style: {
        backgroundColor: style.bg,
        color: style.text,
        borderRadius: '4px',
        opacity: task.status === 'completed' ? 0.7 : 1,
        border: 'none',
      },
    };
  };

  return (
    <div className="flex flex-col gap-6 p-6 h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Claude Code Scheduler</h1>
          <p className="text-gray-600 mt-1">
            Schedule autonomous Claude Code instances with YOLO mode
          </p>
        </div>
        <Button onClick={() => { setSelectedDate(new Date()); setDialogOpen(true); }}>
          <span className="mr-2">+</span> Schedule Task
        </Button>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
        {/* Calendar */}
        <Card className="lg:col-span-2 overflow-hidden flex flex-col">
          <CardHeader>
            <CardTitle>Calendar View</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Loading tasks...</p>
              </div>
            ) : (
              <div style={{ height: '600px' }}>
                <BigCalendar
                  localizer={localizer}
                  events={calendarEvents}
                  startAccessor="start"
                  endAccessor="end"
                  style={{ height: '100%' }}
                  eventPropGetter={eventStyleGetter}
                  onSelectEvent={(event) => setSelectedTask(event.resource)}
                  onSelectSlot={(slotInfo) => {
                    setSelectedDate(slotInfo.start);
                    setDialogOpen(true);
                  }}
                  selectable
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Task Details / List */}
        <Card className="overflow-hidden flex flex-col">
          <CardHeader>
            <CardTitle>
              {selectedTask ? 'Task Details' : 'Upcoming Tasks'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {selectedTask ? (
              /* Task Details */
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{selectedTask.title}</h3>
                  {selectedTask.description && (
                    <p className="text-sm text-gray-600 mt-1">{selectedTask.description}</p>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <Badge>{selectedTask.status}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Scheduled:</span>
                    <span>{new Date(selectedTask.scheduled_time).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Recurrence:</span>
                    <Badge>{selectedTask.recurrence}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Agent:</span>
                    <span>{selectedTask.agent_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">YOLO Mode:</span>
                    <Badge variant={selectedTask.yolo_mode_enabled ? 'success' : 'warning'}>
                      {selectedTask.yolo_mode_enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Executions:</span>
                    <span>{selectedTask.execution_count}</span>
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded">
                  <h4 className="text-sm font-semibold mb-2">Prompt:</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedTask.prompt}</p>
                </div>

                <div className="flex flex-col gap-2 pt-4">
                  <Button
                    onClick={() => handleTriggerTask(selectedTask.id)}
                    variant="primary"
                  >
                    Trigger Now
                  </Button>
                  <Button
                    onClick={() => handleDeleteTask(selectedTask.id)}
                    variant="danger"
                  >
                    Delete Task
                  </Button>
                  <Button
                    onClick={() => setSelectedTask(null)}
                    variant="secondary"
                  >
                    Close
                  </Button>
                </div>
              </div>
            ) : (
              /* Task List */
              <div className="space-y-3">
                {tasks.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No scheduled tasks. Click "Schedule Task" to create one!
                  </p>
                ) : (
                  tasks
                    .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())
                    .slice(0, 10)
                    .map((task) => (
                      <div
                        key={task.id}
                        className="border rounded p-3 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedTask(task)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-semibold">{task.title}</h4>
                            <p className="text-xs text-gray-600 mt-1">
                              {new Date(task.scheduled_time).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge>{task.status}</Badge>
                            <span className="text-xs text-gray-500">{task.recurrence}</span>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
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
};
