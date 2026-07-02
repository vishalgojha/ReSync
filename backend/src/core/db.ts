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

    CREATE TABLE IF NOT EXISTS workspace_plugin_settings (
      workspace_id TEXT NOT NULL,
      plugin_id TEXT NOT NULL,
      settings TEXT NOT NULL DEFAULT '{}',
      PRIMARY KEY (workspace_id, plugin_id)
    );

    CREATE TABLE IF NOT EXISTS contacts (
      jid TEXT NOT NULL,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT,
      push_name TEXT,
      phone_number TEXT,
      profile_pic_url TEXT,
      status TEXT,
      PRIMARY KEY (jid, workspace_id)
    );

    CREATE TABLE IF NOT EXISTS chats (
      id TEXT NOT NULL,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT,
      last_message_text TEXT,
      last_message_timestamp INTEGER,
      last_message_from_me INTEGER DEFAULT 0,
      last_message_type TEXT,
      unread_count INTEGER DEFAULT 0,
      archived INTEGER DEFAULT 0,
      pinned INTEGER DEFAULT 0,
      muted INTEGER DEFAULT 0,
      PRIMARY KEY (id, workspace_id)
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
      quoted_text TEXT,
      media_url TEXT,
      media_mime_type TEXT,
      media_size INTEGER,
      media_width INTEGER,
      media_height INTEGER,
      media_sha256 TEXT,
      media_storage_path TEXT,
      media_download_status TEXT DEFAULT 'none',
      status TEXT,
      data_json TEXT NOT NULL,
      PRIMARY KEY (id, workspace_id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_chat
      ON messages(workspace_id, chat_id, timestamp);

    CREATE INDEX IF NOT EXISTS idx_messages_text
      ON messages(text_content);

    CREATE TABLE IF NOT EXISTS media (
      sha256 TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      mime_type TEXT,
      file_size INTEGER,
      storage_path TEXT,
      download_status TEXT DEFAULT 'pending',
      downloaded_at INTEGER,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS message_status (
      message_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      participant_jid TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (message_id, workspace_id, participant_jid)
    );

    CREATE TABLE IF NOT EXISTS conversation_state (
      chat_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      first_message_at INTEGER,
      first_message_text TEXT,
      first_message_from_me INTEGER,
      last_message_at INTEGER,
      last_message_text TEXT,
      last_message_from_me INTEGER,
      last_outgoing_at INTEGER,
      last_incoming_at INTEGER,
      unread_count INTEGER NOT NULL DEFAULT 0,
      message_count INTEGER NOT NULL DEFAULT 0,
      media_count INTEGER NOT NULL DEFAULT 0,
      participant_count INTEGER NOT NULL DEFAULT 0,
      total_response_time_ms INTEGER NOT NULL DEFAULT 0,
      response_count INTEGER NOT NULL DEFAULT 0,
      average_reply_delay REAL NOT NULL DEFAULT 0,
      health_score REAL NOT NULL DEFAULT 0.5,
      last_status TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (chat_id, workspace_id)
    );

    CREATE TABLE IF NOT EXISTS conversation_timeline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      label TEXT NOT NULL,
      description TEXT,
      message_id TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_timeline_chat
      ON conversation_timeline(workspace_id, chat_id, created_at);

    CREATE TABLE IF NOT EXISTS conversation_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      memory_type TEXT NOT NULL,
      key TEXT,
      value TEXT NOT NULL,
      source TEXT,
      confidence REAL NOT NULL DEFAULT 1.0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_memory_chat
      ON conversation_memory(workspace_id, chat_id, memory_type);

    CREATE TABLE IF NOT EXISTS conversation_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      topic TEXT NOT NULL,
      last_mentioned_at INTEGER NOT NULL,
      mention_count INTEGER NOT NULL DEFAULT 1,
      message_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_topics_chat
      ON conversation_topics(workspace_id, chat_id, last_mentioned_at DESC);

    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
      workspace_id UNINDEXED,
      chat_id UNINDEXED,
      text_content,
      content=messages,
      content_rowid=rowid
    );

    CREATE TRIGGER IF NOT EXISTS messages_fts_insert AFTER INSERT ON messages BEGIN
      INSERT INTO messages_fts(rowid, workspace_id, chat_id, text_content)
      VALUES (new.rowid, new.workspace_id, new.chat_id, new.text_content);
    END;

    CREATE TRIGGER IF NOT EXISTS messages_fts_delete AFTER DELETE ON messages BEGIN
      INSERT INTO messages_fts(messages_fts, rowid, workspace_id, chat_id, text_content)
      VALUES ('delete', old.rowid, old.workspace_id, old.chat_id, old.text_content);
    END;

    CREATE TRIGGER IF NOT EXISTS messages_fts_update AFTER UPDATE ON messages BEGIN
      INSERT INTO messages_fts(messages_fts, rowid, workspace_id, chat_id, text_content)
      VALUES ('delete', old.rowid, old.workspace_id, old.chat_id, old.text_content);
      INSERT INTO messages_fts(rowid, workspace_id, chat_id, text_content)
      VALUES (new.rowid, new.workspace_id, new.chat_id, new.text_content);
    END;
  `)

  db.prepare('INSERT OR IGNORE INTO workspaces (id, name) VALUES (?, ?)').run('default', 'Default')

  const ftsCount = (db.prepare('SELECT count(*) as c FROM messages_fts').get() as any).c
  const msgCount = (db.prepare('SELECT count(*) as c FROM messages').get() as any).c
  if (ftsCount < msgCount) {
    const missing = db.prepare(`
      SELECT m.rowid, m.workspace_id, m.chat_id, m.text_content
      FROM messages m
      LEFT JOIN messages_fts f ON f.rowid = m.rowid
      WHERE f.rowid IS NULL
    `).all() as any[]
    const insert = db.prepare('INSERT INTO messages_fts(rowid, workspace_id, chat_id, text_content) VALUES (?, ?, ?, ?)')
    for (const m of missing) {
      insert.run(m.rowid, m.workspace_id, m.chat_id, m.text_content)
    }
  }

  return db
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}
