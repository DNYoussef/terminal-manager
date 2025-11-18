import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import { X, FolderPlus, FolderOpen } from 'lucide-react';
import { useState } from 'react';
import { DirectoryPicker } from './DirectoryPicker';
import { CreateProjectForm } from './CreateProjectForm';
import { ExistingProjectsList } from './ExistingProjectsList';

interface ProjectSelectorModalProps {
  open: boolean;
  onClose: () => void;
}

export function ProjectSelectorModal({ open, onClose }: ProjectSelectorModalProps) {
  const [activeTab, setActiveTab] = useState<'existing' | 'new'>('existing');

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-4xl max-h-[90vh] overflow-hidden">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <Dialog.Title className="text-2xl font-semibold text-slate-100">
                Select Project
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </Dialog.Close>
            </div>

            {/* Tabs */}
            <Tabs.Root value={activeTab} onValueChange={(val) => setActiveTab(val as 'existing' | 'new')}>
              <Tabs.List className="flex border-b border-slate-700 px-6">
                <Tabs.Trigger
                  value="existing"
                  className="flex items-center gap-2 px-4 py-3 text-slate-400 border-b-2 border-transparent hover:text-slate-200 data-[state=active]:text-blue-500 data-[state=active]:border-blue-500 transition-colors"
                >
                  <FolderOpen className="w-4 h-4" />
                  Existing Projects
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="new"
                  className="flex items-center gap-2 px-4 py-3 text-slate-400 border-b-2 border-transparent hover:text-slate-200 data-[state=active]:text-blue-500 data-[state=active]:border-blue-500 transition-colors"
                >
                  <FolderPlus className="w-4 h-4" />
                  Create New
                </Tabs.Trigger>
              </Tabs.List>

              {/* Existing Projects Tab */}
              <Tabs.Content value="existing" className="p-6">
                <ExistingProjectsList onClose={onClose} />
              </Tabs.Content>

              {/* Create New Tab */}
              <Tabs.Content value="new" className="p-6">
                <div className="space-y-6">
                  <CreateProjectForm onClose={onClose} />
                  <DirectoryPicker onClose={onClose} />
                </div>
              </Tabs.Content>
            </Tabs.Root>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
