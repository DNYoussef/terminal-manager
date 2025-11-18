import React, { useState, useCallback } from 'react';
import CronParser from 'cron-parser';

/**
 * RecurringTaskTemplate Component
 *
 * Allows users to create recurring task templates with cron scheduling.
 * Generates next 12 occurrences as individual tasks.
 * Shows recurring indicator (🔁) in calendar.
 *
 * WCAG 2.1 AA Compliant:
 * - Keyboard navigation support
 * - ARIA labels and roles
 * - Error announcements
 * - Focus management
 */

interface RecurringTaskTemplateProps {
  onCreateTemplate: (template: RecurringTemplate) => Promise<void>;
  projects: Array<{ id: string; name: string }>;
  skills: Array<{ id: string; name: string }>;
}

interface RecurringTemplate {
  name: string;
  description: string;
  cronSchedule: string;
  projectId: string;
  skillId: string;
  duration: number;
  occurrences: TaskOccurrence[];
}

interface TaskOccurrence {
  startTime: Date;
  endTime: Date;
}

const CRON_PRESETS = [
  { label: 'Every Monday 9 AM', value: '0 9 * * 1', description: 'Weekly on Monday morning' },
  { label: 'Every Weekday 9 AM', value: '0 9 * * 1-5', description: 'Monday through Friday' },
  { label: 'Daily 9 AM', value: '0 9 * * *', description: 'Every day at 9 AM' },
  { label: 'First of month 9 AM', value: '0 9 1 * *', description: 'Monthly on the 1st' },
  { label: 'Every 2 weeks Monday 9 AM', value: '0 9 * * 1/2', description: 'Bi-weekly on Monday' },
];

export const RecurringTaskTemplate: React.FC<RecurringTaskTemplateProps> = ({
  onCreateTemplate,
  projects,
  skills,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cronSchedule, setCronSchedule] = useState('0 9 * * 1');
  const [customCron, setCustomCron] = useState('');
  const [useCustomCron, setUseCustomCron] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [skillId, setSkillId] = useState('');
  const [duration, setDuration] = useState(60);
  const [cronError, setCronError] = useState('');
  const [preview, setPreview] = useState<Date[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate and preview cron schedule
  const validateAndPreview = useCallback((cron: string) => {
    try {
      setCronError('');
      const expression = CronParser.parse(cron, {
        currentDate: new Date(),
      });

      const previewDates: Date[] = [];
      for (let i = 0; i < 12; i++) {
        if (!expression.hasNext()) break;
        const next = expression.next();
        previewDates.push(next.toDate());
      }

      setPreview(previewDates);
      return true;
    } catch (error) {
      setCronError(error instanceof Error ? error.message : 'Invalid cron expression');
      setPreview([]);
      return false;
    }
  }, []);

  // Handle cron schedule change
  const handleCronChange = useCallback((value: string, isCustom: boolean) => {
    if (isCustom) {
      setCustomCron(value);
      setCronSchedule(value);
    } else {
      setCronSchedule(value);
    }
    validateAndPreview(value);
  }, [validateAndPreview]);

  // Generate task occurrences from cron schedule
  const generateOccurrences = useCallback((cron: string, durationMinutes: number): TaskOccurrence[] => {
    try {
      const expression = CronParser.parse(cron, {
        currentDate: new Date(),
      });

      const occurrences: TaskOccurrence[] = [];
      for (let i = 0; i < 12; i++) {
        if (!expression.hasNext()) break;

        const next = expression.next();
        const startTime = next.toDate();
        const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

        occurrences.push({ startTime, endTime });
      }

      return occurrences;
    } catch (error) {
      return [];
    }
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    const activeCron = useCustomCron ? customCron : cronSchedule;

    if (!validateAndPreview(activeCron)) {
      return;
    }

    if (!name || !projectId || !skillId) {
      setCronError('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const occurrences = generateOccurrences(activeCron, duration);

      const template: RecurringTemplate = {
        name,
        description,
        cronSchedule: activeCron,
        projectId,
        skillId,
        duration,
        occurrences,
      };

      await onCreateTemplate(template);

      // Reset form
      setName('');
      setDescription('');
      setCronSchedule('0 9 * * 1');
      setCustomCron('');
      setUseCustomCron(false);
      setProjectId('');
      setSkillId('');
      setDuration(60);
      setPreview([]);
    } catch (error) {
      setCronError(error instanceof Error ? error.message : 'Failed to create template');
    } finally {
      setIsSubmitting(false);
    }
  }, [name, description, cronSchedule, customCron, useCustomCron, projectId, skillId, duration, validateAndPreview, generateOccurrences, onCreateTemplate]);

  return (
    <div className="recurring-task-template" role="region" aria-labelledby="template-heading">
      <h2 id="template-heading" className="text-2xl font-bold mb-4">
        Create Recurring Task Template
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <div>
            <label htmlFor="template-name" className="block text-sm font-medium mb-2">
              Template Name <span className="text-red-600" aria-label="required">*</span>
            </label>
            <input
              id="template-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Weekly Team Standup"
              required
              aria-required="true"
            />
          </div>

          <div>
            <label htmlFor="template-description" className="block text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="Describe the recurring task..."
            />
          </div>
        </div>

        {/* Schedule Selection */}
        <div className="space-y-4">
          <fieldset>
            <legend className="block text-sm font-medium mb-2">
              Schedule <span className="text-red-600" aria-label="required">*</span>
            </legend>

            <div className="space-y-2">
              <div>
                <input
                  type="radio"
                  id="preset-schedule"
                  name="schedule-type"
                  checked={!useCustomCron}
                  onChange={() => setUseCustomCron(false)}
                  className="mr-2"
                />
                <label htmlFor="preset-schedule">Use preset schedule</label>
              </div>

              {!useCustomCron && (
                <select
                  id="cron-preset"
                  value={cronSchedule}
                  onChange={(e) => handleCronChange(e.target.value, false)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  aria-label="Select preset schedule"
                >
                  {CRON_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label} - {preset.description}
                    </option>
                  ))}
                </select>
              )}

              <div>
                <input
                  type="radio"
                  id="custom-schedule"
                  name="schedule-type"
                  checked={useCustomCron}
                  onChange={() => setUseCustomCron(true)}
                  className="mr-2"
                />
                <label htmlFor="custom-schedule">Use custom cron expression</label>
              </div>

              {useCustomCron && (
                <div>
                  <input
                    id="custom-cron"
                    type="text"
                    value={customCron}
                    onChange={(e) => handleCronChange(e.target.value, true)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 0 9 * * 1 (Every Monday at 9 AM)"
                    aria-label="Custom cron expression"
                    aria-describedby="cron-help"
                  />
                  <p id="cron-help" className="text-sm text-gray-600 mt-1">
                    Format: minute hour day month weekday (e.g., 0 9 * * 1)
                  </p>
                </div>
              )}
            </div>
          </fieldset>

          {cronError && (
            <div role="alert" className="text-red-600 text-sm">
              {cronError}
            </div>
          )}
        </div>

        {/* Project and Skill Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="template-project" className="block text-sm font-medium mb-2">
              Project <span className="text-red-600" aria-label="required">*</span>
            </label>
            <select
              id="template-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              aria-required="true"
            >
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="template-skill" className="block text-sm font-medium mb-2">
              Skill <span className="text-red-600" aria-label="required">*</span>
            </label>
            <select
              id="template-skill"
              value={skillId}
              onChange={(e) => setSkillId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              aria-required="true"
            >
              <option value="">Select a skill</option>
              {skills.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Duration */}
        <div>
          <label htmlFor="template-duration" className="block text-sm font-medium mb-2">
            Duration (minutes)
          </label>
          <input
            id="template-duration"
            type="number"
            min="15"
            step="15"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value, 10))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Preview */}
        {preview.length > 0 && (
          <div className="bg-gray-50 p-4 rounded-md">
            <h3 className="text-sm font-medium mb-2">Next 12 Occurrences:</h3>
            <ul className="space-y-1 text-sm" aria-label="Upcoming task occurrences">
              {preview.map((date, index) => (
                <li key={index}>
                  🔁 {date.toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !!cronError}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Creating Template...' : 'Create Recurring Template'}
        </button>
      </form>
    </div>
  );
};

export default RecurringTaskTemplate;
