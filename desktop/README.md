# AgentsToolkit Desktop

Cross-platform GUI for managing AI agent configurations.

## Development

```bash
cd desktop
npm install
npm run tauri:dev
```

## Building

```bash
npm run tauri:build
```

For platform-specific builds:

```bash
npm run tauri:build:mac
npm run tauri:build:windows
npm run tauri:build:linux
```

## Architecture

- **Frontend:** React + TypeScript + Vite
- **Backend:** Rust + Tauri 2.x
- **State:** Zustand + React Query
- **UI:** shadcn/ui + Tailwind CSS

## Project Structure

```
desktop/
├── src/                    # React/TypeScript frontend
│   ├── components/         # UI components
│   ├── views/              # Main application views
│   ├── lib/                # Utilities and API wrappers
│   └── styles/             # Global styles
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs         # Tauri entry point
│   │   ├── ipc.rs          # IPC command handlers
│   │   ├── fs_manager.rs   # File system operations
│   │   └── symlink.rs      # Cross-platform symlink logic
│   └── Cargo.toml          # Rust dependencies
└── package.json            # Frontend dependencies
```

## Features

- Agent configuration management
- Rule pack browser and management
- Cross-platform symlink deployment
- Real-time validation
- Settings and diagnostics
