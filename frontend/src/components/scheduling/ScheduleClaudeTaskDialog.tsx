import React, { useState } from 'react';
import { Dialog } from '../design-system/Dialog';
import { Button } from '../design-system/Button';
import { Input } from '../design-system/Input';
import { Select } from '../design-system/Select';
import { claudeSchedulerApi, type ScheduledClaudeTaskCreate } from '../../services/claudeSchedulerApi';

interface Props {
  open: boolean;
  onClose: () => void;
  onTaskCreated?: () => void;
  initialDate?: Date;
}

export const ScheduleClaudeTaskDialog: React.FC<Props> = ({
  open,
  onClose,
  onTaskCreated,
  initialDate,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [prompt, setPrompt] = useState('');
  const [scheduledDate, setScheduledDate] = useState(
    initialDate ? initialDate.toISOString().slice(0, 16) : ''
  );
  const [recurrence, setRecurrence] = useState<'once' | 'daily' | 'weekly' | 'monthly'>('once');
  const [yoloMode, setYoloMode] = useState(true);
  const [agentType, setAgentType] = useState('general-purpose');
  const [maxTime, setMaxTime] = useState('1800');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const task: ScheduledClaudeTaskCreate = {
        title,
        description,
        prompt,
        scheduled_time: new Date(scheduledDate).toISOString(),
        recurrence,
        yolo_mode_enabled: yoloMode,
        agent_type: agentType,
        max_execution_time: parseInt(maxTime),
      };

      await claudeSchedulerApi.create(task);

      // Reset form
      setTitle('');
      setDescription('');
      setPrompt('');
      setScheduledDate('');
      setRecurrence('once');
      setAgentType('general-purpose');

      if (onTaskCreated) onTaskCreated();
      onClose();
    } catch (err) {
      console.error('Failed to create scheduled task:', err);
      setError(err instanceof Error ? err.message : 'Failed to create scheduled task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <div className="p-6 max-w-2xl">
        <h2 className="text-2xl font-bold mb-4">Schedule Claude Code Task</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-1">
              Task Title <span className="text-red-500">*</span>
            </label>
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
            <label htmlFor="description" className="block text-sm font-medium mb-1">
              Description
            </label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>

          {/* Prompt */}
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium mb-1">
              Claude Code Prompt <span className="text-red-500">*</span>
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Review all Python files and suggest improvements..."
              rows={4}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Scheduled Time */}
          <div>
            <label htmlFor="scheduled_time" className="block text-sm font-medium mb-1">
              Scheduled Time <span className="text-red-500">*</span>
            </label>
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
            <label htmlFor="recurrence" className="block text-sm font-medium mb-1">
              Recurrence
            </label>
            <Select
              value={recurrence}
              onValueChange={(value) => setRecurrence(value as any)}
            >
              <option value="once">Once</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </Select>
          </div>

          {/* Agent Type */}
          <div>
            <label htmlFor="agent_type" className="block text-sm font-medium mb-1">
              Agent Type
            </label>
            <Select
              value={agentType}
              onValueChange={(value) => setAgentType(value)}
            >
              <option value="general-purpose">General Purpose</option>
              <option value="coder">Coder</option>
              <option value="reviewer">Reviewer</option>
              <option value="researcher">Researcher</option>
              <option value="tester">Tester</option>
            </Select>
          </div>

          {/* YOLO Mode */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="yolo_mode"
              checked={yoloMode}
              onChange={(e) => setYoloMode(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="yolo_mode" className="text-sm font-medium">
              YOLO Mode (Autonomous Execution)
            </label>
          </div>

          {/* Max Execution Time */}
          <div>
            <label htmlFor="max_time" className="block text-sm font-medium mb-1">
              Max Execution Time (seconds)
            </label>
            <Input
              id="max_time"
              type="number"
              value={maxTime}
              onChange={(e) => setMaxTime(e.target.value)}
              min="60"
              max="7200"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Schedule Task'}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
};
