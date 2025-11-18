/**
 * Scheduled Tasks API Service
 * Connects Calendar UI to Memory MCP-backed backend
 */

import type { ScheduledTask } from '../components/scheduling/Calendar';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export interface CreateTaskRequest {
  title: string;
  description?: string;
  start: Date;
  end: Date;
  type: 'prompt' | 'task' | 'reminder';
  status?: 'pending' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  start?: Date;
  end?: Date;
  type?: 'prompt' | 'task' | 'reminder';
  status?: 'pending' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
}

export interface TaskFilters {
  status?: 'pending' | 'completed' | 'cancelled';
  type?: 'prompt' | 'task' | 'reminder';
  priority?: 'low' | 'medium' | 'high';
}

class ScheduledTasksApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/scheduled-tasks`;
  }

  /**
   * Fetch all scheduled tasks with optional filtering
   */
  async getTasks(filters?: TaskFilters): Promise<ScheduledTask[]> {
    const params = new URLSearchParams();

    if (filters?.status) params.append('status', filters.status);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.priority) params.append('priority', filters.priority);

    const url = `${this.baseUrl}${params.toString() ? `?${params.toString()}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch tasks: ${response.statusText}`);
    }

    const tasks = await response.json();

    // Convert ISO date strings to Date objects
    return tasks.map((task: any) => ({
      ...task,
      start: new Date(task.start),
      end: new Date(task.end),
      created_at: new Date(task.created_at),
      updated_at: new Date(task.updated_at),
    }));
  }

  /**
   * Get a specific task by ID
   */
  async getTask(taskId: string): Promise<ScheduledTask> {
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

    const task = await response.json();

    return {
      ...task,
      start: new Date(task.start),
      end: new Date(task.end),
      created_at: new Date(task.created_at),
      updated_at: new Date(task.updated_at),
    };
  }

  /**
   * Create a new scheduled task
   * Stores in Memory MCP Triple Layer System
   */
  async createTask(taskData: CreateTaskRequest): Promise<ScheduledTask> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...taskData,
        start: taskData.start.toISOString(),
        end: taskData.end.toISOString(),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create task');
    }

    const task = await response.json();

    return {
      ...task,
      start: new Date(task.start),
      end: new Date(task.end),
      created_at: new Date(task.created_at),
      updated_at: new Date(task.updated_at),
    };
  }

  /**
   * Update an existing task
   */
  async updateTask(taskId: string, updates: UpdateTaskRequest): Promise<ScheduledTask> {
    const response = await fetch(`${this.baseUrl}/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...updates,
        start: updates.start?.toISOString(),
        end: updates.end?.toISOString(),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to update task');
    }

    const task = await response.json();

    return {
      ...task,
      start: new Date(task.start),
      end: new Date(task.end),
      created_at: new Date(task.created_at),
      updated_at: new Date(task.updated_at),
    };
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${taskId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to delete task');
    }
  }

  /**
   * Mark task as completed
   * Updates procedural layer in Memory MCP
   */
  async completeTask(taskId: string): Promise<ScheduledTask> {
    const response = await fetch(`${this.baseUrl}/${taskId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to complete task');
    }

    const task = await response.json();

    return {
      ...task,
      start: new Date(task.start),
      end: new Date(task.end),
      created_at: new Date(task.created_at),
      updated_at: new Date(task.updated_at),
    };
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<ScheduledTask> {
    const response = await fetch(`${this.baseUrl}/${taskId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to cancel task');
    }

    const task = await response.json();

    return {
      ...task,
      start: new Date(task.start),
      end: new Date(task.end),
      created_at: new Date(task.created_at),
      updated_at: new Date(task.updated_at),
    };
  }

  /**
   * Search tasks using semantic search (Memory MCP Layer 3)
   */
  async searchTasks(query: string, filters?: TaskFilters): Promise<ScheduledTask[]> {
    const params = new URLSearchParams({ q: query });

    if (filters?.status) params.append('status', filters.status);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.priority) params.append('priority', filters.priority);

    const response = await fetch(`${this.baseUrl}/search?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to search tasks: ${response.statusText}`);
    }

    const tasks = await response.json();

    return tasks.map((task: any) => ({
      ...task,
      start: new Date(task.start),
      end: new Date(task.end),
      created_at: new Date(task.created_at),
      updated_at: new Date(task.updated_at),
    }));
  }
}

// Export singleton instance
export const scheduledTasksApi = new ScheduledTasksApiService();
