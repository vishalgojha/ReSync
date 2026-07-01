# ReSync

WhatsApp to Browser — lightweight self-hosted relay.

## Quick start

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (another terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:3000, click **Connect WhatsApp**, scan the QR code.

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | /connect | Start WhatsApp connection |
| POST | /disconnect | Disconnect |
| GET | /chats | List chats |
| GET | /messages/:chatId | Get messages |

### Socket.IO events

- `qr.updated` — QR code string for pairing
- `connection.state` — connection status changes
- `chats.update` — new/updated chats
- `message.new` — new messages

## Stack

React · Vite · Tailwind · Express · Baileys · SQLite

## License

MIT
