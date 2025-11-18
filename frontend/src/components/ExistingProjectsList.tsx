import { useEffect, useState } from 'react';
import { FolderOpen, Terminal, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

interface Project {
  id: string;
  name: string;
  path: string;
  created_at: string;
  last_opened_at: string | null;
}

interface ExistingProjectsListProps {
  onClose: () => void;
}

export function ExistingProjectsList({ onClose }: ExistingProjectsListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingProject, setOpeningProject] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/v1/projects/');
      if (!response.ok) throw new Error('Failed to fetch projects');
      const data = await response.json();
      setProjects(data);
    } catch (error) {
      toast.error('Failed to load projects');
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenProject = async (project: Project) => {
    setOpeningProject(project.id);
    try {
      const response = await fetch(`/api/v1/projects/${project.id}/open-terminal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'claude' }),
      });

      if (!response.ok) throw new Error('Failed to open terminal');

      const data = await response.json();
      toast.success(`Terminal opened for ${project.name}`);
      console.log('Terminal opened:', data);
      onClose();
    } catch (error) {
      toast.error('Failed to open terminal');
      console.error('Error opening terminal:', error);
    } finally {
      setOpeningProject(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading projects...</div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <FolderOpen className="w-16 h-16 text-slate-600 mb-4" />
        <h3 className="text-lg font-semibold text-slate-300 mb-2">No Projects Yet</h3>
        <p className="text-slate-400">Create a new project to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
      {projects.map((project) => (
        <div
          key={project.id}
          className="bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-lg p-4 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-slate-100 mb-1">
                {project.name}
              </h3>
              <p className="text-sm text-slate-400 font-mono truncate mb-2">
                {project.path}
              </p>
              {project.last_opened_at && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="w-3 h-3" />
                  Last opened: {new Date(project.last_opened_at).toLocaleString()}
                </div>
              )}
            </div>

            <button
              onClick={() => handleOpenProject(project)}
              disabled={openingProject === project.id}
              className="ml-4 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors whitespace-nowrap"
            >
              <Terminal className="w-4 h-4" />
              {openingProject === project.id ? 'Opening...' : 'Open Terminal'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
