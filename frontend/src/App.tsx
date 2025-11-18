import { useState } from 'react';
import { FolderOpen, Terminal, Layers, Boxes, CalendarDays, Database } from 'lucide-react';
import { ThemeProvider } from './contexts/ThemeContext';
import { ThemeToggle } from './components/ThemeToggle';
import { ProjectSelectorModal } from './components/ProjectSelectorModal';
import { SessionsList } from './components/sessions/SessionsList';
import { TerminalMonitor } from './components/terminals/TerminalMonitor';
import { MCPToolsPanel } from './components/mcp/MCPToolsPanel';
import { Calendar } from './components/scheduling/Calendar';
import { ClaudeScheduler } from './pages/ClaudeScheduler';
import { MemoryVault } from './components/memory/MemoryVault';
import { useTerminalsStore } from './store/searchStore';
import './App.css';

type TabType = 'projects' | 'sessions' | 'terminals' | 'mcp' | 'schedule' | 'memory';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('sessions');
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const { terminals } = useTerminalsStore();

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-slate-900">
        {/* Navigation Bar */}
        <nav className="h-16 bg-slate-800 border-b border-slate-700 flex items-center px-6">
          <div className="flex items-center gap-2">
            <Terminal className="w-6 h-6 text-blue-500" />
            <span className="text-xl font-semibold text-slate-100">Terminal Manager</span>
          </div>

          <div className="ml-auto flex items-center gap-4">
            <ThemeToggle />
            <button
              id="open-project-btn"
              onClick={() => setIsProjectModalOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Open Project
            </button>
          </div>
        </nav>

      {/* Tabs */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            <button
              id="tab-sessions"
              onClick={() => setActiveTab('sessions')}
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                activeTab === 'sessions'
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <Layers className="w-4 h-4" />
              Sessions
            </button>
            <button
              id="tab-projects"
              onClick={() => setActiveTab('projects')}
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                activeTab === 'projects'
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              Projects
            </button>
            <button
              id="tab-terminals"
              onClick={() => setActiveTab('terminals')}
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                activeTab === 'terminals'
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <Terminal className="w-4 h-4" />
              Terminals
            </button>
            <button
              id="tab-mcp"
              onClick={() => setActiveTab('mcp')}
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                activeTab === 'mcp'
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <Boxes className="w-4 h-4" />
              MCP Tools
            </button>
            <button
              id="tab-schedule"
              onClick={() => setActiveTab('schedule')}
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                activeTab === 'schedule'
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              Schedule
            </button>
            <button
              id="tab-memory"
              onClick={() => setActiveTab('memory')}
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                activeTab === 'memory'
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <Database className="w-4 h-4" />
              Memory Vault
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="h-[calc(100vh-8rem)]">
        {activeTab === 'sessions' && (
          <SessionsList
            onTerminalAttached={(terminalId) => {
              console.log('Terminal attached:', terminalId);
              setActiveTab('terminals');
            }}
          />
        )}

        {activeTab === 'projects' && (
          <div className="p-6">
            <div className="max-w-7xl mx-auto">
              <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
                <FolderOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h2 className="text-2xl font-semibold text-slate-100 mb-2">
                  No Project Selected
                </h2>
                <p className="text-slate-400 mb-6">
                  Select an existing project or create a new one to get started
                </p>
                <button
                  onClick={() => setIsProjectModalOpen(true)}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Open Project
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'terminals' && (
          <>
            {terminals.length === 0 ? (
              <div className="p-6">
                <div className="max-w-7xl mx-auto">
                  <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
                    <Terminal className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h2 className="text-2xl font-semibold text-slate-100 mb-2">
                      No Active Terminals
                    </h2>
                    <p className="text-slate-400 mb-6">
                      Open a project or attach to a session to view terminals
                    </p>
                    <button
                      onClick={() => setActiveTab('sessions')}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                    >
                      Browse Sessions
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <TerminalMonitor />
            )}
          </>
        )}

        {activeTab === 'mcp' && <MCPToolsPanel />}

        {activeTab === 'schedule' && <ClaudeScheduler />}

        {activeTab === 'memory' && <MemoryVault />}
      </main>

        {/* Project Selector Modal */}
        <ProjectSelectorModal
          open={isProjectModalOpen}
          onClose={() => setIsProjectModalOpen(false)}
        />
      </div>
    </ThemeProvider>
  );
}

export default App;
