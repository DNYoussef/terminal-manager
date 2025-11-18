import { useState, useEffect } from 'react';
import { ChevronRight, Folder, FolderOpen, Home, Terminal } from 'lucide-react';
import toast from 'react-hot-toast';

interface DirectoryItem {
  name: string;
  path: string;
  is_directory: boolean;
  size: number | null;
  modified_at: string;
}

interface DirectoryPickerProps {
  onClose: () => void;
}

export function DirectoryPicker({ onClose }: DirectoryPickerProps) {
  const [currentPath, setCurrentPath] = useState('C:\\Users\\17175');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [items, setItems] = useState<DirectoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [openingTerminal, setOpeningTerminal] = useState(false);

  useEffect(() => {
    browseDirectory(currentPath);
  }, [currentPath]);

  const browseDirectory = async (path: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/projects/browse?path=${encodeURIComponent(path)}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to browse directory');
      }

      const data = await response.json();
      setItems(data.items.filter((item: DirectoryItem) => item.is_directory));
      setParentPath(data.parent_path);
      setCurrentPath(data.current_path);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to browse directory');
      console.error('Error browsing directory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDirectory = (item: DirectoryItem) => {
    if (item.is_directory) {
      setCurrentPath(item.path);
      setSelectedPath(item.path);
    }
  };

  const handleGoToParent = () => {
    if (parentPath) {
      setCurrentPath(parentPath);
    }
  };

  const handleOpenTerminal = async () => {
    if (!selectedPath) {
      toast.error('Please select a directory first');
      return;
    }

    setOpeningTerminal(true);
    try {
      // First create/find project for this path
      const projectResponse = await fetch('/api/v1/projects/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_path: selectedPath.split('\\').slice(0, -1).join('\\'),
          name: selectedPath.split('\\').pop(),
        }),
      });

      // If project already exists (409), fetch it instead
      let projectId: string;
      if (projectResponse.status === 409) {
        // Get project by path
        const projectsResponse = await fetch('/api/v1/projects/');
        const projects = await projectsResponse.json();
        const existingProject = projects.find((p: any) => p.path === selectedPath);
        if (!existingProject) throw new Error('Project not found');
        projectId = existingProject.id;
      } else if (!projectResponse.ok) {
        throw new Error('Failed to create project');
      } else {
        const projectData = await projectResponse.json();
        projectId = projectData.id;
      }

      // Open terminal
      const terminalResponse = await fetch(`/api/v1/projects/${projectId}/open-terminal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'claude' }),
      });

      if (!terminalResponse.ok) throw new Error('Failed to open terminal');

      const terminalData = await terminalResponse.json();
      toast.success('Terminal opened successfully!');
      console.log('Terminal opened:', terminalData);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to open terminal');
      console.error('Error opening terminal:', error);
    } finally {
      setOpeningTerminal(false);
    }
  };

  const pathParts = currentPath.split('\\').filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100">
          Browse Filesystem
        </h3>
        <button
          onClick={handleOpenTerminal}
          disabled={!selectedPath || openingTerminal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          <Terminal className="w-4 h-4" />
          {openingTerminal ? 'Opening...' : 'Open Terminal'}
        </button>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm overflow-x-auto pb-2">
        <button
          onClick={() => setCurrentPath('C:\\')}
          className="flex items-center gap-1 px-2 py-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition-colors"
        >
          <Home className="w-4 h-4" />
        </button>
        {pathParts.map((part, index) => {
          const partPath = pathParts.slice(0, index + 1).join('\\');
          return (
            <div key={index} className="flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-slate-600" />
              <button
                onClick={() => setCurrentPath(`${partPath}`)}
                className="px-2 py-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition-colors whitespace-nowrap"
              >
                {part}
              </button>
            </div>
          );
        })}
      </div>

      {/* Directory List */}
      <div className="bg-slate-700/50 border border-slate-600 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">
            Loading...
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Folder className="w-12 h-12 mx-auto mb-2 text-slate-600" />
            No directories found
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {/* Parent Directory */}
            {parentPath && (
              <button
                onClick={handleGoToParent}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 border-b border-slate-600 transition-colors text-left"
              >
                <Folder className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <span className="text-slate-300 font-medium">..</span>
              </button>
            )}

            {/* Directories */}
            {items.map((item) => (
              <button
                key={item.path}
                onClick={() => handleSelectDirectory(item)}
                onDoubleClick={() => handleSelectDirectory(item)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 border-b border-slate-600 last:border-b-0 transition-colors text-left ${
                  selectedPath === item.path ? 'bg-blue-600/20' : ''
                }`}
              >
                {selectedPath === item.path ? (
                  <FolderOpen className="w-5 h-5 text-blue-500 flex-shrink-0" />
                ) : (
                  <Folder className="w-5 h-5 text-slate-400 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className={`font-medium truncate ${
                    selectedPath === item.path ? 'text-blue-400' : 'text-slate-200'
                  }`}>
                    {item.name}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {item.path}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Path Display */}
      {selectedPath && (
        <div className="p-4 bg-slate-700/50 border border-slate-600 rounded-lg">
          <div className="text-sm text-slate-400 mb-1">Selected Path:</div>
          <div className="text-slate-200 font-mono text-sm">{selectedPath}</div>
        </div>
      )}
    </div>
  );
}
