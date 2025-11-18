# Terminal Manager

Full-stack terminal management system with FastAPI backend, React frontend, and Claude Code hooks integration.

## Architecture

```
terminal-manager/
├── backend/          # FastAPI REST API (Python)
│   ├── app/
│   │   ├── main.py
│   │   ├── routers/
│   │   └── models/
│   └── requirements.txt
├── frontend/         # Vite + React UI (TypeScript)
│   ├── src/
│   │   ├── components/
│   │   └── App.tsx
│   └── package.json
├── hooks/            # Claude Code hooks
│   ├── hooks.json
│   └── 12fa/
│       └── visibility-pipeline.js
├── package.json      # Root orchestration
└── README.md
```

## Quick Start

### 1. Install Dependencies

```bash
# Install all dependencies (backend + frontend)
npm run install:all
```

### 2. Start Everything

```bash
# Start both backend and frontend concurrently
npm start
```

This runs:
- **Backend**: http://localhost:8000 (FastAPI)
- **Frontend**: http://localhost:3002 (Vite dev server)

### 3. Verify Health

```bash
npm run health
```

## Ecosystem Integration

Terminal Manager is part of a comprehensive AI-assisted development ecosystem built on **Model Context Protocol (MCP)**. This section explains how it integrates with two critical companion projects.

### Architecture Overview

```
+--------------------------------------------------+
|  Terminal Manager (This Project)                |
|  FastAPI + React + Hooks Pipeline                |
|                                                  |
|  - UI for managing workflows                     |
|  - Task scheduling & calendar                    |
|  - Real-time visibility dashboard                |
|  - Event logging from hooks                      |
+--------------------------------------------------+
        |                             |
        | (hooks)                     | (API queries)
        v                             v
+------------------------+   +------------------------+
|  ruv-SPARC Plugin      |   |  Memory MCP Triple     |
|  Three-Loop System     |   |  Layer System          |
|                        |   |                        |
|  - 86+ specialized     |   |  - Triple-layer        |
|    agents              |   |    retention (24h/7d/  |
|  - SPARC methodology   |   |    30d)                |
|  - Research -> Impl    |   |  - Semantic vector     |
|    -> Recovery loops   |   |    search (ChromaDB)   |
|  - Memory MCP access   |   |  - Mode-aware context  |
|  - Auto tagging: WHO/  |   |    (Execution/Planning/|
|    WHEN/PROJECT/WHY    |   |    Brainstorming)      |
+------------------------+   +------------------------+
        |                             ^
        +-----------------------------+
         (All agents store/retrieve via Memory MCP)
```

### 1. Memory MCP Triple-Layer System

**GitHub**: https://github.com/DNYoussef/memory-mcp-triple-system

**What It Is**:
A production-ready MCP server providing intelligent, multi-layered memory management for AI assistants with 100% test coverage and NASA Rule 10 compliance.

**Key Capabilities**:
- **Triple-layer memory architecture** with automatic retention policies:
  - Short-term: 24 hours (recent context)
  - Mid-term: 7 days (project continuity)
  - Long-term: 30+ days (historical patterns)
- **Semantic vector search** using ChromaDB:
  - 384-dimensional embeddings (all-MiniLM-L6-v2 model)
  - HNSW indexing for fast similarity search (<150ms latency)
  - Semantic chunking (128-512 tokens per chunk)
- **Mode-aware context adaptation** with 29 regex patterns (85%+ accuracy):
  - Execution mode: Precise, actionable (5 core results, 5K tokens, <200ms)
  - Planning mode: Balanced exploration (10+5 results, 10K tokens, <500ms)
  - Brainstorming mode: Wide ideation (15+10 results, 20K tokens, <800ms)
- **Self-referential memory**: Can retrieve information about its own capabilities
- **Production-ready**: 100% test coverage, NASA Rule 10 compliant, zero theater detection

**Integration with Terminal Manager**:
- Frontend queries Memory MCP for session restoration
- Backend logs events tagged with WHO/WHEN/PROJECT/WHY metadata
- Calendar UI surfaces scheduled prompts from long-term memory
- Semantic search across all task history

**Setup**:
```bash
# Install Memory MCP server
pip install memory-mcp

# Configure in Claude Desktop
# Edit: ~/.claude/claude_desktop_config.json
{
  "mcpServers": {
    "memory-triple-layer": {
      "command": "npx",
      "args": ["-y", "memory-triple-system-mcp"],
      "env": {
        "STORAGE_PATH": "~/.claude/memory-triple-storage",
        "VECTOR_DB_PATH": "~/.claude/vector-db"
      }
    }
  }
}

# Restart Claude Desktop for changes to take effect
```

### 2. 12-Factor Agents (ruv-SPARC Three-Loop System)

**GitHub**: https://github.com/DNYoussef/ruv-sparc-three-loop-system

**What It Is**:
Production-grade AI development system achieving 100% 12-Factor compliance, 0 vulnerabilities, and 2.5-4x speedup (up to 8.3x with swarm optimization). Built on [Claude Flow](https://github.com/ruvnet/claude-flow) with extensive enhancements.

**Multi-Level Architecture** (Command → Agent → Skill → Playbook):
- **224 Commands**: Complete MECE taxonomy across 10 domains (development, quality, performance, memory, monitoring, integration, research, automation)
- **203 Agents**: Specialized agents across 13 categories (ALL have Memory MCP access):
  - Core Development (8), Testing & Validation (9), Frontend (6), Database & Data (7)
  - Documentation (6), Swarm Coordination (15), Performance (5), GitHub (9)
  - SPARC Methodology (6), Specialized Development (14), Deep Research SOP (4)
  - Infrastructure & Cloud (12), Security & Compliance (8)
- **122 Skills**: Organized into Development Lifecycle (15), Code Quality (12), Research (9), Infrastructure (8), and 78 specialized skills
- **29 Playbooks**: Systematic workflows across Delivery (5), Operations (4), Research (4), Security (3), Quality (3), Platform (3), GitHub (3), Specialist (4)

**Key Capabilities**:
- **Intelligent auto-routing**: 5-phase workflow (intent → prompt → plan → route → execute) with automatic skill selection
- **SPARC methodology** for structured development:
  - **S**pecification → **P**seudocode → **A**rchitecture → **R**efinement → **C**ode
- **Three-Loop Architecture** for complex workflows:
  - **Loop 1**: Research-Driven Planning (5x pre-mortem cycles, >97% accuracy)
  - **Loop 2**: Parallel Swarm Implementation (6-10 agents concurrently, 6.75x-8.3x speedup, theater detection via Byzantine consensus)
  - **Loop 3**: CI/CD Intelligent Recovery (automated testing, 100% recovery rate, root cause analysis)
- **Swarm coordination**: 4 topologies (Hierarchical 6.3x, Mesh 8.3x, Adaptive 7.2x, Ring 4.5x) with Byzantine fault tolerance
- **Automatic tagging protocol**: All agents tag memory with WHO/WHEN/PROJECT/WHY metadata
- **Production-certified**: 271 Graphviz diagrams (101% coverage), 100% 12-Factor compliance, 0 vulnerabilities

**Integration with Terminal Manager**:
- Hooks pipeline (`hooks/12fa/visibility-pipeline.js`) logs task completion events to backend
- Frontend displays agent activity dashboard
- Backend `/api/v1/events` endpoint receives hook events
- Calendar UI schedules SPARC workflow phases

**Setup**:
```bash
# Clone the plugin
git clone https://github.com/DNYoussef/ruv-sparc-three-loop-system.git ~/.claude/plugins/ruv-sparc

# Configure Claude Code to load plugin (already done in CLAUDE.md)
# Plugin auto-loads from ~/.claude/plugins/ directory

# Verify available agents
npx claude-flow agents list

# Available categories:
# - delivery/      (18 agents: architecture, backend, frontend)
# - foundry/       (19 agents: agent creation, templates)
# - operations/    (28 agents: DevOps, infrastructure)
# - orchestration/ (21 agents: swarm coordinators)
# - platforms/     (44 agents: AI/ML, data services)
# - quality/       (18 agents: analysis, testing)
# - research/      (11 agents: research cores)
# - security/      (5 agents: compliance, pentest)
# - specialists/   (15 agents: business, industry)
# - tooling/       (24 agents: docs, GitHub, productivity)
```

### 3. How It All Works Together

**Developer Workflow Example**:

1. **User requests a feature**: "Build a REST API for user authentication"

2. **Claude Code triggers ruv-SPARC**:
   - `planner` agent analyzes requirements
   - `backend-dev` agent implements API endpoints
   - `tester` agent writes comprehensive tests

3. **Agents store progress in Memory MCP**:
   ```javascript
   taggedMemoryStore('backend-dev', 'Implemented JWT middleware', {
     project: 'terminal-manager',
     intent: 'implementation',
     task_id: 'AUTH-123'
   });
   ```

4. **Hooks pipeline fires**:
   - Post-task hook executes `visibility-pipeline.js`
   - Event logged to Terminal Manager backend: `POST /api/v1/events`

5. **Terminal Manager displays progress**:
   - Dashboard shows agent activity in real-time
   - Calendar schedules next phase (testing)
   - Memory search retrieves similar past implementations

6. **Memory MCP enables continuity**:
   - Next day, user asks: "Continue with auth feature"
   - Memory MCP retrieves JWT middleware context from yesterday
   - Agent resumes without re-explaining

**Key Synergies**:
- **ruv-SPARC agents** use **Memory MCP** for cross-session persistence
- **Terminal Manager** provides visibility into agent workflows via hooks
- **Memory tagging protocol** ensures all data is searchable (WHO/WHEN/PROJECT/WHY)
- **Mode-aware context** adapts retrieval to workflow phase (Execution vs Planning)

### 4. Configuration Summary

**Required for Full Ecosystem**:

1. **Terminal Manager** (this project):
   ```bash
   cd terminal-manager
   npm install
   npm start
   ```

2. **Memory MCP** (MCP server):
   ```bash
   # Edit ~/.claude/claude_desktop_config.json
   # Add memory-triple-layer server (see above)
   # Restart Claude Desktop
   ```

3. **ruv-SPARC Plugin** (Claude Code plugin):
   ```bash
   # Clone to ~/.claude/plugins/
   # Plugin auto-loads on Claude Code start
   ```

**Verification**:
```bash
# Check Memory MCP
claude mcp list | grep memory

# Check ruv-SPARC agents
npx claude-flow agents list

# Check Terminal Manager health
curl http://localhost:8000/api/v1/health
curl http://localhost:3002
```

**Troubleshooting**:
- **Memory MCP not found**: Restart Claude Desktop after editing config
- **Agents not available**: Verify plugin cloned to `~/.claude/plugins/`
- **Hooks not firing**: Check backend running (hooks log to backend)
- **Missing tagging metadata**: Verify using `memory-mcp-tagging-protocol.js`

### 5. Learn More

- **Memory MCP Docs**: https://github.com/DNYoussef/memory-mcp-triple-system#readme
- **ruv-SPARC Docs**: https://github.com/DNYoussef/ruv-sparc-three-loop-system#readme
- **Claude Code**: https://code.claude.com/docs
- **Model Context Protocol**: https://modelcontextprotocol.io/

---

## Manual Start (Alternative)

### Backend Only
```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Frontend Only
```bash
cd frontend
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Backend
DATABASE_URL=postgresql://user:pass@localhost:5432/terminal_manager
REDIS_URL=redis://localhost:6379
SECRET_KEY=your-secret-key-here

# Frontend (auto-loaded by Vite)
VITE_API_URL=http://localhost:8000
```

## API Documentation

Once backend is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Features

### Backend
- FastAPI REST API with async support
- PostgreSQL database with SQLAlchemy ORM
- Redis caching (5-minute TTL)
- WebSocket support for real-time updates
- Event logging for visibility pipeline
- Health checks and monitoring

### Frontend
- React 18 with TypeScript
- Vite for fast development
- Tailwind CSS + Radix UI components
- Calendar scheduling (react-big-calendar)
- Terminal emulation (xterm.js)
- Real-time updates via Socket.IO

### Hooks Integration
- Post-task visibility logging to backend
- Memory MCP coordination
- Connascence quality checks
- Session management

## Development

### Backend Development
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run with auto-reload
python -m uvicorn app.main:app --reload

# Run tests
pytest
```

### Frontend Development
```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev

# Run E2E tests
npm run test:e2e

# Build for production
npm run build
```

## Deployment

### Production Build
```bash
# Build frontend
npm run build

# Frontend assets will be in: frontend/dist/
```

### Docker (Optional)
```bash
# Build and run with Docker Compose
docker-compose up -d
```

## Windows Boot Integration

To auto-start this project on Windows boot, use the provided boot script:

```powershell
# From your system startup directory
powershell -File scripts/boot-terminal-manager.ps1
```

The boot script will:
1. Navigate to this project directory
2. Run `npm start`
3. Verify health checks
4. Open browser to http://localhost:3002

## Hooks Configuration

Hooks are configured in `hooks/hooks.json`:

```json
{
  "PostToolUse": [
    {
      "name": "post-task-visibility",
      "enabled": true,
      "command": "node",
      "args": ["hooks/12fa/visibility-pipeline.js", ...]
    }
  ]
}
```

The visibility pipeline logs task events to the backend API at `POST /api/v1/events`.

## Memory MCP Integration

Memory MCP configuration is external to this project (in `~/.claude/claude_desktop_config.json`).

The frontend queries Memory MCP for:
- Session restoration
- Semantic search across tasks
- Cross-session persistence

## Troubleshooting

### Backend won't start
- Check Python version: `python --version` (needs 3.11+)
- Install dependencies: `pip install -r backend/requirements.txt`
- Check port 8000 is available: `netstat -ano | findstr :8000`

### Frontend won't start
- Check Node version: `node --version` (needs v18+)
- Install dependencies: `cd frontend && npm install`
- Check port 3002 is available

### Hooks not firing
- Verify `hooks/hooks.json` has `"enabled": true`
- Check backend is running (hooks log to backend)
- Check fallback logs: `logs/visibility-*.log`

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature/your-feature`
5. Open a Pull Request

## License

MIT

## Support

- **Issues**: https://github.com/yourusername/terminal-manager/issues
- **Docs**: See `/docs` directory

---

**Quick Commands**:
- `npm start` - Start everything
- `npm run health` - Health check
- `npm test` - Run tests
- `npm run build` - Production build
