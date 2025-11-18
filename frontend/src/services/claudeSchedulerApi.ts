/**
 * Claude Code Scheduler API Service
 * Connects to calendar-triggered Claude Code instances with YOLO mode
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export interface ScheduledClaudeTaskCreate {
  title: string;
  description?: string;
  prompt: string;
  scheduled_time: string; // ISO datetime
  recurrence: 'once' | 'daily' | 'weekly' | 'monthly';
  yolo_mode_enabled: boolean;
  agent_type?: string;
  max_execution_time?: number;
  playbook?: string;
  skills?: string[];
  project_id?: string;
  terminal_id?: string;
}

export interface ScheduledClaudeTask {
  id: string;
  title: string;
  description?: string;
  scheduled_time: string;
  recurrence: string;
  prompt: string;
  yolo_mode_enabled: boolean;
  agent_type: string;
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

class ClaudeSchedulerApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/scheduled-claude-tasks`;
  }

  /**
   * Create new scheduled Claude Code task
   */
  async create(task: ScheduledClaudeTaskCreate): Promise<ScheduledClaudeTask> {
    const response = await fetch(`${this.baseUrl}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(task),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || 'Failed to create scheduled task');
    }

    return await response.json();
  }

  /**
   * List all scheduled tasks
   */
  async list(): Promise<ScheduledClaudeTask[]> {
    const response = await fetch(`${this.baseUrl}/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch tasks: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get single task details
   */
  async get(taskId: string): Promise<ScheduledClaudeTask> {
    const response = await fetch(`${this.baseUrl}/${taskId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Task ${taskId} not found`);
      }
      throw new Error(`Failed to fetch task: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Delete scheduled task
   */
  async delete(taskId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${taskId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || 'Failed to delete task');
    }
  }

  /**
   * Manually trigger task execution immediately
   */
  async trigger(taskId: string): Promise<{ message: string; task_id: string }> {
    const response = await fetch(`${this.baseUrl}/${taskId}/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || 'Failed to trigger task');
    }

    return await response.json();
  }

  /**
   * Get execution reports for a task
   */
  async getReports(taskId: string): Promise<ExecutionReport[]> {
    const response = await fetch(`${this.baseUrl}/${taskId}/reports`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch reports: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get full logs for a specific execution
   */
  async getLogs(taskId: string, reportId: string): Promise<{ log_content: string }> {
    const response = await fetch(`${this.baseUrl}/${taskId}/reports/${reportId}/logs`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch logs: ${response.statusText}`);
    }

    return await response.json();
  }
}

// Export singleton instance
export const claudeSchedulerApi = new ClaudeSchedulerApiService();
