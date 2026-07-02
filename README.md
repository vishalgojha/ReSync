# ReSync

WhatsApp to Browser — self-hosted WhatsApp Web client with a three-panel desktop UI, automations, AI agents, and a unified production server.

## Quick start

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Development (two terminals)
cd backend && npm run dev
cd ../frontend && npm run dev
```

Open http://localhost:5173, click **Connect WhatsApp**, scan the QR code.

### Production (single process)

```bash
# Build frontend
cd frontend && npm run build

# Start backend (serves both API + frontend)
cd ../backend && npm start
```

Open http://localhost:4000.

### Docker

```bash
docker compose up
```

Open http://localhost:4000.

### Launcher (cross-platform)

```bash
cd launcher
npm install               # first run
npx tsx src/index.ts start
```

The launcher finds a free port, builds the frontend if needed, starts the backend, opens the browser, and auto-restarts on crash. Platform scripts:

- **Linux**: `launcher/linux/start-resync.sh` (and `stop` / `restart`)
- **Windows**: `launcher/windows/start-resync.bat` (hidden terminal via `launch-resync.vbs`)
- **macOS**: `launcher/mac/start-resync.sh`

## Architecture

```
backend/           Express API + Socket.IO + WhatsApp client (Baileys)
  src/
    index.ts       Production server: serves API + frontend/dist + Socket.IO
    whatsapp/      Baileys session, messages, chats
    core/          Plugin engine, context manager
    automation/    Automation execution engine
    agents/        AI agent framework
    plugins/       Built-in plugins

frontend/          React + TypeScript + Tailwind v4
  src/
    components/
      ui/          Button, Badge, Avatar, Input, Dialog, Tooltip, etc.
      layout/      Sidebar, ChatList, ChatView, Inspector, CommandPalette
    pages/         MainPage, Settings, Automations, Agents
    hooks/         useSocket, useKeyboardShortcuts
    lib/           App context, types, utils

launcher/          Cross-platform startup manager (separate, no business logic)
```

### Key decisions

- **Single production process**: Express serves API + Socket.IO + static frontend from `frontend/dist/`. No nginx, no separate frontend container.
- **Three-panel layout**: Sidebar (220px) | Conversation List (320–420px) | Conversation View + optional Inspector (320px).
- **React Context over prop drilling**: `useApp()` hook provides connection state, chats, and controls to all components.
- **Router-driven**: React Router with routes for `/`, `/chat/:chatId`, `/settings`, `/automations`, `/agents`.
- **Launcher is separate**: Lives in `launcher/` with no business logic. Can be wrapped by Homebrew, Docker, .deb, .rpm.

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Ctrl+K` | Command Palette |
| `Ctrl+1` | Messages |
| `Ctrl+2` | Automations |
| `Ctrl+3` | Agents |
| `Ctrl+4` | Settings |
| `Ctrl+/` | Focus Chat Search |
| `Ctrl+I` | Toggle Inspector |
| `Esc` | Close panel/dialog |
| `?` | Keyboard Shortcuts help |

## API

| Method | Path | Description |
|---|---|---|
| GET | /health | Health check (`{ running, workspace, connected, version, uptime }`) |
| POST | /connect | Start WhatsApp connection |
| POST | /disconnect | Disconnect |
| GET | /chats | List chats |
| GET | /messages/:chatId | Get messages |
| GET | /conversation/:chatId | Conversation data for Inspector |

### Socket.IO events

- `connection.state` — connection status changes (`disconnected` / `qr` / `syncing` / `connected`)
- `chats.set` — full chat list replacement
- `chat.created` / `chat.updated` — individual chat mutations
- `message.created` / `message.updated` — live message events
- `sync.completed` — initial sync finished

## Stack

React 19 · TypeScript · Tailwind v4 · Vite · Express · Socket.IO · Baileys v7 · SQLite (better-sqlite3)

## License

MIT
