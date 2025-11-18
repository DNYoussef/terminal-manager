import { useState } from 'react';
import { FolderPlus } from 'lucide-react';
import toast from 'react-hot-toast';

interface CreateProjectFormProps {
  onClose: () => void;
}

export function CreateProjectForm({ onClose }: CreateProjectFormProps) {
  const [projectName, setProjectName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/v1/projects/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_path: 'C:\\Users\\17175',
          name: projectName.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create project');
      }

      const data = await response.json();
      toast.success(`Project "${projectName}" created successfully!`);
      console.log('Project created:', data);

      // Open terminal for the new project
      const terminalResponse = await fetch(`/api/v1/projects/${data.id}/open-terminal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'claude' }),
      });

      if (terminalResponse.ok) {
        toast.success('Terminal opened');
      }

      setProjectName('');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create project');
      console.error('Error creating project:', error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <form onSubmit={handleCreateProject} className="space-y-4">
      <div>
        <label htmlFor="projectName" className="block text-sm font-medium text-slate-300 mb-2">
          Project Name
        </label>
        <input
          id="projectName"
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="my-awesome-project"
          className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="mt-2 text-xs text-slate-500">
          Project will be created in C:\Users\17175\{projectName || 'project-name'}
        </p>
      </div>

      <button
        type="submit"
        disabled={creating || !projectName.trim()}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
      >
        <FolderPlus className="w-5 h-5" />
        {creating ? 'Creating Project...' : 'Create Project & Open Terminal'}
      </button>
    </form>
  );
}
