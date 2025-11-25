import React, { useState, useEffect, useRef } from 'react';
import { Search, Terminal, RefreshCw, Moon, Sun, Trash2, Plus } from 'lucide-react';
import { useTerminalsStore } from '../../store/searchStore';
import { useTheme } from '../../contexts/ThemeContext';

interface Command {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { terminals, selectTerminal } = useTerminalsStore();
  const { theme, setTheme } = useTheme();

  // Define commands
  const commands: Command[] = [
    {
      id: 'new-terminal',
      label: 'Create New Terminal',
      icon: <Plus className="w-4 h-4" />,
      shortcut: 'Ctrl+Shift+`',
      action: () => {
        // Placeholder for create terminal logic - normally requires project ID
        console.log('Create terminal triggered');
        // In a real app, this would open a dialog or prompt
      }
    },
    {
      id: 'toggle-theme',
      label: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`,
      icon: theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />,
      action: () => setTheme(theme === 'dark' ? 'light' : 'dark')
    },
    ...terminals.map(t => ({
      id: `switch-${t.id}`,
      label: `Switch to ${t.project_id} (${t.id.slice(0, 6)})`,
      icon: <Terminal className="w-4 h-4" />,
      action: () => selectTerminal(t.id)
    }))
  ];

  const filteredCommands = commands.filter(cmd => 
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      } else if (isOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(i => (i + 1) % filteredCommands.length);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(i => (i - 1 + filteredCommands.length) % filteredCommands.length);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            setIsOpen(false);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setSearchQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-[20vh]">
      <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
            placeholder="Type a command or search..."
            value={query}
            onChange={e => {
              setSearchQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <div className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
            Esc to close
          </div>
        </div>
        
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
              No commands found
            </div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <button
                key={cmd.id}
                className={`w-full px-4 py-3 flex items-center justify-between text-left text-sm transition-colors
                  ${index === selectedIndex 
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                `}
                onClick={() => {
                  cmd.action();
                  setIsOpen(false);
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="flex items-center gap-3">
                  {cmd.icon}
                  <span>{cmd.label}</span>
                </div>
                {cmd.shortcut && (
                  <span className="text-xs text-gray-400">{cmd.shortcut}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
