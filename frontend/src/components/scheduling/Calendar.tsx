import React, { useState, useCallback, useMemo } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Button } from '../design-system/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../design-system/Card';
import { Input } from '../design-system/Input';
import { Badge } from '../design-system/Badge';

import { enUS } from 'date-fns/locale';

const locales = {
  'en-US': enUS
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export interface ScheduledTask {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  type: 'prompt' | 'task' | 'reminder';
  status: 'pending' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  tags?: string[];
}

interface CalendarProps {
  tasks?: ScheduledTask[];
  onCreateTask?: (task: Omit<ScheduledTask, 'id'>) => void;
  onUpdateTask?: (id: string, task: Partial<ScheduledTask>) => void;
  onDeleteTask?: (id: string) => void;
}

export const Calendar: React.FC<CalendarProps> = ({
  tasks = [],
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
}) => {
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<ScheduledTask | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTask, setNewTask] = useState<Partial<ScheduledTask>>({
    title: '',
    description: '',
    type: 'task',
    priority: 'medium',
    status: 'pending',
  });

  // Event style getter for calendar
  const eventStyleGetter = useCallback((event: ScheduledTask) => {
    const colors = {
      prompt: { bg: 'var(--color-accent-primary)', text: 'var(--color-text-inverse)' },
      task: { bg: 'var(--color-status-info)', text: 'var(--color-text-inverse)' },
      reminder: { bg: 'var(--color-status-warning)', text: 'var(--color-text-inverse)' },
    };

    const priorityBorder = {
      low: '2px solid var(--color-status-success)',
      medium: '2px solid var(--color-status-warning)',
      high: '2px solid var(--color-status-error)',
    };

    const style = colors[event.type] || colors.task;

    return {
      style: {
        backgroundColor: style.bg,
        color: style.text,
        border: priorityBorder[event.priority],
        borderRadius: 'var(--radius-sm)',
        opacity: event.status === 'completed' ? 0.5 : 1,
        textDecoration: event.status === 'completed' ? 'line-through' : 'none',
      },
    };
  }, []);

  const handleSelectSlot = useCallback(({ start, end }: { start: Date; end: Date }) => {
    setNewTask((prev) => ({
      ...prev,
      start,
      end,
    }));
    setShowCreateForm(true);
  }, []);

  const handleSelectEvent = useCallback((event: ScheduledTask) => {
    setSelectedEvent(event);
  }, []);

  const handleCreateTask = useCallback(() => {
    if (newTask.title && newTask.start && newTask.end && onCreateTask) {
      onCreateTask({
        title: newTask.title,
        description: newTask.description,
        start: newTask.start,
        end: newTask.end,
        type: newTask.type as 'prompt' | 'task' | 'reminder',
        status: newTask.status as 'pending' | 'completed' | 'cancelled',
        priority: newTask.priority as 'low' | 'medium' | 'high',
        tags: newTask.tags,
      });
      setShowCreateForm(false);
      setNewTask({
        title: '',
        description: '',
        type: 'task',
        priority: 'medium',
        status: 'pending',
      });
    }
  }, [newTask, onCreateTask]);

  const handleUpdateStatus = useCallback(
    (id: string, status: 'pending' | 'completed' | 'cancelled') => {
      if (onUpdateTask) {
        onUpdateTask(id, { status });
      }
      setSelectedEvent(null);
    },
    [onUpdateTask]
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (onDeleteTask) {
        onDeleteTask(id);
      }
      setSelectedEvent(null);
    },
    [onDeleteTask]
  );

  const calendarEvents = useMemo(() => tasks, [tasks]);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header with controls */}
      <Card padding="sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setDate(new Date())}
            >
              Today
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const newDate = new Date(date);
                newDate.setMonth(date.getMonth() - 1);
                setDate(newDate);
              }}
            >
              &lt;
            </Button>
            <span className="text-text-primary font-semibold min-w-[200px] text-center">
              {format(date, 'MMMM yyyy')}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const newDate = new Date(date);
                newDate.setMonth(date.getMonth() + 1);
                setDate(newDate);
              }}
            >
              &gt;
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={view === 'month' ? 'primary' : 'secondary'}
              onClick={() => setView('month')}
            >
              Month
            </Button>
            <Button
              size="sm"
              variant={view === 'week' ? 'primary' : 'secondary'}
              onClick={() => setView('week')}
            >
              Week
            </Button>
            <Button
              size="sm"
              variant={view === 'day' ? 'primary' : 'secondary'}
              onClick={() => setView('day')}
            >
              Day
            </Button>
            <Button
              size="sm"
              variant={view === 'agenda' ? 'primary' : 'secondary'}
              onClick={() => setView('agenda')}
            >
              Agenda
            </Button>
            <Button size="sm" onClick={() => setShowCreateForm(true)}>
              + New Task
            </Button>
          </div>
        </div>
      </Card>

      {/* Calendar */}
      <Card padding="md" className="flex-1 min-h-0">
        <div className="h-full calendar-container">
          <BigCalendar
            localizer={localizer}
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            view={view}
            onView={setView}
            date={date}
            onNavigate={setDate}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            eventPropGetter={eventStyleGetter}
            selectable
            className="h-full"
            style={{ height: '100%' }}
          />
        </div>
      </Card>

      {/* Create Task Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card padding="lg" className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Create New Task</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-text-secondary mb-1 block">Title</label>
                  <Input
                    value={newTask.title || ''}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    placeholder="Task title"
                  />
                </div>
                <div>
                  <label className="text-sm text-text-secondary mb-1 block">Description</label>
                  <Input
                    value={newTask.description || ''}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    placeholder="Task description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-text-secondary mb-1 block">Type</label>
                    <select
                      className="w-full h-10 rounded-md border border-border bg-surface px-3 py-2 text-sm"
                      value={newTask.type}
                      onChange={(e) => setNewTask({ ...newTask, type: e.target.value as any })}
                    >
                      <option value="task">Task</option>
                      <option value="prompt">Prompt</option>
                      <option value="reminder">Reminder</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-text-secondary mb-1 block">Priority</label>
                    <select
                      className="w-full h-10 rounded-md border border-border bg-surface px-3 py-2 text-sm"
                      value={newTask.priority}
                      onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as any })}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-4">
                  <Button variant="secondary" onClick={() => setShowCreateForm(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateTask}>Create</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card padding="lg" className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle>{selectedEvent.title}</CardTitle>
                <div className="flex gap-1">
                  <Badge variant={selectedEvent.type === 'prompt' ? 'default' : selectedEvent.type === 'task' ? 'info' : 'warning'}>
                    {selectedEvent.type}
                  </Badge>
                  <Badge
                    variant={
                      selectedEvent.priority === 'high' ? 'error' : selectedEvent.priority === 'medium' ? 'warning' : 'success'
                    }
                  >
                    {selectedEvent.priority}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {selectedEvent.description && (
                  <div>
                    <p className="text-sm text-text-secondary">{selectedEvent.description}</p>
                  </div>
                )}
                <div className="text-sm text-text-secondary">
                  <p>Start: {format(selectedEvent.start, 'PPpp')}</p>
                  <p>End: {format(selectedEvent.end, 'PPpp')}</p>
                </div>
                <div className="flex gap-2 justify-end pt-4">
                  <Button variant="secondary" onClick={() => setSelectedEvent(null)}>
                    Close
                  </Button>
                  {selectedEvent.status !== 'completed' && (
                    <Button variant="success" onClick={() => handleUpdateStatus(selectedEvent.id, 'completed')}>
                      Mark Complete
                    </Button>
                  )}
                  {selectedEvent.status !== 'cancelled' && (
                    <Button variant="secondary" onClick={() => handleUpdateStatus(selectedEvent.id, 'cancelled')}>
                      Cancel
                    </Button>
                  )}
                  <Button variant="danger" onClick={() => handleDelete(selectedEvent.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <style>{`
        .calendar-container {
          min-height: 500px;
        }

        .rbc-calendar {
          font-family: var(--font-sans);
          color: var(--color-text-primary);
          background: var(--color-bg-secondary);
        }

        .rbc-header {
          padding: 8px 4px;
          background: var(--color-surface);
          border-bottom: 1px solid var(--color-border);
          color: var(--color-text-secondary);
          font-weight: 600;
        }

        .rbc-month-view,
        .rbc-time-view {
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
        }

        .rbc-day-bg {
          border-left: 1px solid var(--color-border);
        }

        .rbc-today {
          background-color: rgba(78, 201, 176, 0.1);
        }

        .rbc-off-range-bg {
          background: var(--color-bg-secondary);
        }

        .rbc-event {
          padding: 2px 5px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
        }

        .rbc-event:hover {
          filter: brightness(1.1);
        }

        .rbc-toolbar {
          display: none;
        }

        .rbc-time-slot {
          border-top: 1px solid var(--color-border);
        }

        .rbc-current-time-indicator {
          background-color: var(--color-accent-primary);
        }
      `}</style>
    </div>
  );
};
