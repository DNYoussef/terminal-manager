/**
 * Zustand Store Slice for MCP (Model Context Protocol)
 * Manages MCP servers, tools, and call history
 */

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  server: string;
}

export interface MCPServer {
  name: string;
  type: string;
  description: string;
  enabled: boolean;
  running: boolean;
  pid: number | null;
  tools_count: number;
}

export interface MCPToolCall {
  id: string;
  tool_name: string;
  arguments: Record<string, any>;
  result: Record<string, any> | null;
  error: string | null;
  timestamp: string;
  success: boolean;
}

export interface MCPSlice {
  // State
  servers: Record<string, MCPServer>;
  tools: MCPTool[];
  toolCalls: MCPToolCall[];
  selectedServer: string | null;
  selectedTool: string | null;
  loading: boolean;
  error: string | null;

  // Actions - Servers
  setServers: (servers: Record<string, MCPServer>) => void;
  selectServer: (serverName: string | null) => void;

  // Actions - Tools
  setTools: (tools: MCPTool[]) => void;
  selectTool: (toolName: string | null) => void;

  // Actions - Tool Calls
  addToolCall: (call: MCPToolCall) => void;
  clearToolCalls: () => void;

  // Actions - Loading/Error
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Getters
  getServerTools: (serverName: string) => MCPTool[];
  getToolByName: (toolName: string) => MCPTool | undefined;
}

export const createMCPSlice = (set: any, get: any, _api?: any): MCPSlice => ({
  // Initial state
  servers: {},
  tools: [],
  toolCalls: [],
  selectedServer: null,
  selectedTool: null,
  loading: false,
  error: null,

  // Server actions
  setServers: (servers) => set({ servers, error: null }),

  selectServer: (serverName) => set({ selectedServer: serverName }),

  // Tool actions
  setTools: (tools) => set({ tools, error: null }),

  selectTool: (toolName) => set({ selectedTool: toolName }),

  // Tool call actions
  addToolCall: (call) =>
    set((state: MCPSlice) => ({
      toolCalls: [call, ...state.toolCalls].slice(0, 100), // Keep last 100
    })),

  clearToolCalls: () => set({ toolCalls: [] }),

  // Loading/Error actions
  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error, loading: false }),

  // Getters
  getServerTools: (serverName: string) => {
    const { tools } = get();
    return tools.filter((tool: MCPTool) => tool.server === serverName);
  },

  getToolByName: (toolName: string) => {
    const { tools } = get();
    return tools.find((tool: MCPTool) => tool.name === toolName);
  },
});
