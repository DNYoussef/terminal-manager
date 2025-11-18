import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Archive, Search, RefreshCw, ExternalLink } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../design-system/Card';
import { Button } from '../design-system/Button';
import { Input } from '../design-system/Input';
import { Badge } from '../design-system/Badge';

interface MemoryLayer {
  name: 'short-term' | 'mid-term' | 'long-term';
  icon: React.ElementType;
  description: string;
  duration: string;
  decay: string;
  color: string;
}

const MEMORY_LAYERS: MemoryLayer[] = [
  {
    name: 'short-term',
    icon: Clock,
    description: '24-hour full content retention',
    duration: '24h',
    decay: 'No decay',
    color: 'bg-blue-500'
  },
  {
    name: 'mid-term',
    icon: Calendar,
    description: '7-day full content with linear decay',
    duration: '7d',
    decay: 'Linear decay',
    color: 'bg-purple-500'
  },
  {
    name: 'long-term',
    icon: Archive,
    description: '30+ day compressed storage',
    duration: '30d+',
    decay: 'e^(-days/30)',
    color: 'bg-green-500'
  }
];

interface MemoryEntry {
  id: string;
  layer: 'short-term' | 'mid-term' | 'long-term';
  task_id: string;
  task_title: string;
  content: string;
  metadata: Record<string, any>;
  created_at: string;
  retention_days?: number;
}

interface SearchMode {
  name: 'execution' | 'planning' | 'brainstorming';
  description: string;
  limit: number;
  threshold: number;
}

const SEARCH_MODES: SearchMode[] = [
  {
    name: 'execution',
    description: 'Precise, actionable results',
    limit: 5,
    threshold: 0.85
  },
  {
    name: 'planning',
    description: 'Broader exploration',
    limit: 20,
    threshold: 0.65
  },
  {
    name: 'brainstorming',
    description: 'Wide ideation',
    limit: 30,
    threshold: 0.50
  }
];

export const MemoryVault: React.FC = () => {
  const [selectedLayer, setSelectedLayer] = useState<'short-term' | 'mid-term' | 'long-term' | null>(null);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'execution' | 'planning' | 'brainstorming'>('execution');
  const [loading, setLoading] = useState(false);
  const [obsidianPath, setObsidianPath] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  const fetchMemories = async (layer?: 'short-term' | 'mid-term' | 'long-term') => {
    setLoading(true);
    try {
      const url = layer
        ? `http://localhost:8000/api/v1/memory/layers/${layer}`
        : 'http://localhost:8000/api/v1/memory/search?query=all';

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setMemories(data);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch memories:', error);
      setLoading(false);
    }
  };

  const syncToObsidian = async () => {
    setSyncStatus('syncing');
    try {
      // Call backend Obsidian sync endpoint
      const response = await fetch('http://localhost:8000/api/v1/memory/sync-obsidian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vault_path: obsidianPath })
      });

      if (response.ok) {
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus('idle'), 3000);
      } else {
        setSyncStatus('error');
      }
    } catch (error) {
      console.error('Obsidian sync failed:', error);
      setSyncStatus('error');
    }
  };

  const openInObsidian = (memory: MemoryEntry) => {
    // Open Obsidian URI
    const capitalizedLayer = memory.layer.charAt(0).toUpperCase() + memory.layer.slice(1);
    const obsidianUri = `obsidian://open?vault=Tasks&file=Memory/${capitalizedLayer}/${memory.task_id}.md`;
    window.open(obsidianUri, '_blank');
  };

  useEffect(() => {
    if (selectedLayer) {
      fetchMemories(selectedLayer);
    }
  }, [selectedLayer]);

  return (
    <div className="flex flex-col h-full gap-4 p-6">
      {/* Header */}
      <Card padding="sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Memory Vault</h1>
            <p className="text-sm text-text-secondary mt-1">
              Browse Memory MCP Time-Based Retention System
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => fetchMemories(selectedLayer || undefined)}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Obsidian Sync */}
      <Card padding="md">
        <CardHeader>
          <CardTitle>Obsidian Integration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-text-secondary mb-1 block">
                Obsidian Vault Path
              </label>
              <Input
                value={obsidianPath}
                onChange={(e) => setObsidianPath(e.target.value)}
                placeholder="C:\Users\username\ObsidianVault"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={syncToObsidian}
                disabled={!obsidianPath || syncStatus === 'syncing'}
                loading={syncStatus === 'syncing'}
              >
                Sync to Obsidian
              </Button>
              {syncStatus === 'synced' && (
                <Badge variant="success">Synced</Badge>
              )}
              {syncStatus === 'error' && (
                <Badge variant="error">Sync Failed</Badge>
              )}
            </div>
            <p className="text-xs text-text-tertiary">
              Tasks will be synced to: {obsidianPath || 'Not configured'}/Tasks/
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Memory Layers */}
      <div className="grid grid-cols-3 gap-4">
        {MEMORY_LAYERS.map((layer) => (
          <Card
            key={layer.name}
            padding="md"
            hover={true}
            className={`cursor-pointer transition-all ${
              selectedLayer === layer.name
                ? 'ring-2 ring-accent-primary bg-surface-hover'
                : ''
            }`}
            onClick={() => setSelectedLayer(layer.name)}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${layer.color} bg-opacity-20`}>
                <layer.icon className={`w-5 h-5 ${layer.color.replace('bg-', 'text-')}`} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-text-primary capitalize">
                  {layer.name.replace('-', ' ')}
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  {layer.description}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="default" className="text-xs">
                    {layer.duration}
                  </Badge>
                  <span className="text-xs text-text-tertiary">
                    {layer.decay}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Search */}
      {selectedLayer && (
        <Card padding="sm">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-text-tertiary" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${selectedLayer} layer...`}
              className="flex-1"
            />
          </div>
        </Card>
      )}

      {/* Memory Entries */}
      {selectedLayer && (
        <div className="flex-1 overflow-auto">
          {loading ? (
            <Card padding="lg">
              <div className="text-center text-text-secondary">
                Loading memories...
              </div>
            </Card>
          ) : memories.length === 0 ? (
            <Card padding="lg">
              <div className="text-center text-text-secondary">
                No memories in {selectedLayer} layer
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {memories.map((memory) => (
                <Card key={memory.id} padding="md" hover={true}>
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-text-primary">
                          {memory.task_title}
                        </h4>
                        <p className="text-xs text-text-tertiary">
                          Task ID: {memory.task_id}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="default">{memory.layer}</Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openInObsidian(memory)}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="bg-bg-secondary p-3 rounded-md">
                      <pre className="text-xs text-text-secondary overflow-x-auto">
                        {memory.content}
                      </pre>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {Object.entries(memory.metadata).slice(0, 3).map(([key, value]) => (
                        <span key={key} className="text-xs text-text-tertiary">
                          <span className="font-medium">{key}:</span> {String(value)}
                        </span>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
