# Terminal Manager Frontend

React + TypeScript + Vite frontend for the secure terminal management system.

## Features

- Project selection and creation
- Filesystem browsing with security validation
- Terminal spawning and monitoring
- Modern dark theme UI with Radix UI components

## Prerequisites

- Node.js 18+
- Backend API running on http://localhost:8000

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Frontend will be available at http://localhost:3000 with API proxy to http://localhost:8000

## Build

```bash
npm run build
```

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **Radix UI** - Accessible components
- **Zustand** - State management
- **xterm.js** - Terminal emulator (for future phases)
- **React Hot Toast** - Notifications

## Project Structure

```
src/
  components/
    ProjectSelectorModal.tsx  - Main modal with tabs
    DirectoryPicker.tsx        - Filesystem browser
    CreateProjectForm.tsx      - New project form
    ExistingProjectsList.tsx   - Project list
  App.tsx                      - Main app component
  main.tsx                     - Entry point
  index.css                    - Global styles
```

## API Integration

Connects to backend endpoints:
- `GET /api/v1/projects/` - List projects
- `GET /api/v1/projects/browse` - Browse filesystem
- `POST /api/v1/projects/create` - Create project
- `POST /api/v1/projects/{id}/open-terminal` - Open terminal

## Security

- Path validation enforced by backend
- CORS configured for localhost:3000
- No sensitive data in frontend

## Next Steps

See `backend/docs/API-DOCUMENTATION.md` for complete API reference.
