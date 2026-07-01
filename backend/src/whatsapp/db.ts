import Database from 'better-sqlite3'
import path from 'path'

const __dirname = path.dirname(new URL(import.meta.url).pathname)

let db: Database.Database | null = null

export function initDb(): Database.Database {
  if (db) return db

  db = new Database(path.join(__dirname, '../../data.db'))
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS workspace_settings (
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value TEXT,
      PRIMARY KEY (workspace_id, key)
    );

    CREATE TABLE IF NOT EXISTS chats (
      id TEXT NOT NULL,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT,
      last_message_text TEXT,
      last_message_timestamp INTEGER,
      unread_count INTEGER DEFAULT 0,
      PRIMARY KEY (id, workspace_id)
    );

    CREATE TABLE IF NOT EXISTS contacts (
      jid TEXT NOT NULL,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT,
      push_name TEXT,
      phone_number TEXT,
      PRIMARY KEY (jid, workspace_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      from_me INTEGER NOT NULL DEFAULT 0,
      sender TEXT,
      timestamp INTEGER,
      message_type TEXT,
      text_content TEXT,
      quoted_message_id TEXT,
      media_url TEXT,
      media_mime_type TEXT,
      media_size INTEGER,
      media_width INTEGER,
      media_height INTEGER,
      status TEXT,
      data_json TEXT,
      PRIMARY KEY (id, workspace_id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_chat
      ON messages(workspace_id, chat_id, timestamp);
  `)

  db.prepare('INSERT OR IGNORE INTO workspaces (id, name) VALUES (?, ?)').run('default', 'Default')

  return db
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}
