import { getDb } from '../../core/db.js'
import type { GraphNode, GraphEdge, EntityType, RelatedEntity } from './types.js'
import crypto from 'crypto'

export const ENTITY_TYPES = [
  'person', 'phone', 'email', 'company', 'location',
  'date', 'money', 'document', 'link', 'unknown',
] as const

export function initGraphTables(): void {
  const db = getDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS graph_nodes (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      chat_id TEXT,
      entity_type TEXT NOT NULL,
      value TEXT NOT NULL,
      normalized_value TEXT NOT NULL,
      metadata TEXT,
      first_seen_at INTEGER,
      last_seen_at INTEGER,
      mention_count INTEGER DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_graph_nodes_type
      ON graph_nodes(workspace_id, entity_type);

    CREATE INDEX IF NOT EXISTS idx_graph_nodes_chat
      ON graph_nodes(workspace_id, chat_id);

    CREATE INDEX IF NOT EXISTS idx_graph_nodes_value
      ON graph_nodes(workspace_id, normalized_value);

    CREATE TABLE IF NOT EXISTS graph_edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id TEXT NOT NULL,
      chat_id TEXT,
      source_node_id TEXT NOT NULL REFERENCES graph_nodes(id),
      target_node_id TEXT NOT NULL REFERENCES graph_nodes(id),
      relationship TEXT NOT NULL,
      strength REAL DEFAULT 1.0,
      first_seen_at INTEGER,
      last_seen_at INTEGER,
      message_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_graph_edges_source
      ON graph_edges(workspace_id, source_node_id);

    CREATE INDEX IF NOT EXISTS idx_graph_edges_target
      ON graph_edges(workspace_id, target_node_id);

    CREATE INDEX IF NOT EXISTS idx_graph_edges_chat
      ON graph_edges(workspace_id, chat_id);
  `)
}

function nodeId(workspaceId: string, type: EntityType, normalized: string): string {
  const hash = crypto.createHash('sha256').update(`${workspaceId}:${type}:${normalized.toLowerCase()}`).digest('hex').slice(0, 16)
  return `${type}_${hash}`
}

export function upsertNode(
  workspaceId: string,
  chatId: string | null,
  type: EntityType,
  value: string,
  normalized: string,
  metadata?: Record<string, any>,
): string {
  const db = getDb()
  const id = nodeId(workspaceId, type, normalized)
  const now = Math.floor(Date.now() / 1000)

  const existing = db.prepare('SELECT * FROM graph_nodes WHERE id = ? AND workspace_id = ?').get(id, workspaceId) as GraphNode | undefined

  if (existing) {
    db.prepare(`
      UPDATE graph_nodes SET
        value = ?,
        metadata = COALESCE(?, metadata),
        last_seen_at = ?,
        mention_count = mention_count + 1,
        chat_id = COALESCE(?, chat_id)
      WHERE id = ? AND workspace_id = ?
    `).run(
      value,
      metadata ? JSON.stringify(metadata) : null,
      now,
      chatId,
      id, workspaceId,
    )
  } else {
    db.prepare(`
      INSERT INTO graph_nodes (id, workspace_id, chat_id, entity_type, value, normalized_value, metadata, first_seen_at, last_seen_at, mention_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(id, workspaceId, chatId, type, value, normalized, metadata ? JSON.stringify(metadata) : null, now, now)
  }

  return id
}

export function upsertEdge(
  workspaceId: string,
  chatId: string | null,
  sourceId: string,
  targetId: string,
  relationship: string,
  messageId?: string,
): void {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)

  const existing = db.prepare(`
    SELECT * FROM graph_edges
    WHERE workspace_id = ? AND source_node_id = ? AND target_node_id = ? AND relationship = ?
  `).get(workspaceId, sourceId, targetId, relationship) as GraphEdge | undefined

  if (existing) {
    db.prepare(`
      UPDATE graph_edges SET
        strength = MIN(5.0, strength + 0.5),
        last_seen_at = ?,
        message_id = COALESCE(?, message_id),
        chat_id = COALESCE(?, chat_id)
      WHERE id = ?
    `).run(now, messageId || null, chatId, existing.id)
  } else {
    db.prepare(`
      INSERT INTO graph_edges (workspace_id, chat_id, source_node_id, target_node_id, relationship, strength, first_seen_at, last_seen_at, message_id)
      VALUES (?, ?, ?, ?, ?, 1.0, ?, ?, ?)
    `).run(workspaceId, chatId, sourceId, targetId, relationship, now, now, messageId || null)
  }
}

export function getNode(workspaceId: string, nodeId: string): GraphNode | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM graph_nodes WHERE id = ? AND workspace_id = ?').get(nodeId, workspaceId) as GraphNode | undefined
}

export function findNodesByValue(workspaceId: string, query: string): GraphNode[] {
  const db = getDb()
  const like = `%${query.toLowerCase()}%`
  return db.prepare(`
    SELECT * FROM graph_nodes
    WHERE workspace_id = ? AND (normalized_value LIKE ? OR value LIKE ?)
    ORDER BY mention_count DESC, last_seen_at DESC
    LIMIT 30
  `).all(workspaceId, like, like) as GraphNode[]
}

export function findNodesByType(workspaceId: string, type: EntityType): GraphNode[] {
  const db = getDb()
  return db.prepare(`
    SELECT * FROM graph_nodes
    WHERE workspace_id = ? AND entity_type = ?
    ORDER BY mention_count DESC, last_seen_at DESC
    LIMIT 50
  `).all(workspaceId, type) as GraphNode[]
}

export function getChatNodes(workspaceId: string, chatId: string): GraphNode[] {
  const db = getDb()
  return db.prepare(`
    SELECT * FROM graph_nodes
    WHERE workspace_id = ? AND chat_id = ?
    ORDER BY mention_count DESC, last_seen_at DESC
  `).all(workspaceId, chatId) as GraphNode[]
}

export function getRelatedEntities(workspaceId: string, nodeId: string): RelatedEntity[] {
  const db = getDb()
  const outgoing = db.prepare(`
    SELECT e.*, n.*, e.id AS edge_id, n.id AS node_id
    FROM graph_edges e
    JOIN graph_nodes n ON n.id = e.target_node_id AND n.workspace_id = e.workspace_id
    WHERE e.workspace_id = ? AND e.source_node_id = ?
  `).all(workspaceId, nodeId) as any[]

  const incoming = db.prepare(`
    SELECT e.*, n.*, e.id AS edge_id, n.id AS node_id
    FROM graph_edges e
    JOIN graph_nodes n ON n.id = e.source_node_id AND n.workspace_id = e.workspace_id
    WHERE e.workspace_id = ? AND e.target_node_id = ?
  `).all(workspaceId, nodeId) as any[]

  const mapRow = (row: any, direction: 'outgoing' | 'incoming'): RelatedEntity => ({
    node: {
      id: row.node_id,
      workspace_id: row.workspace_id,
      chat_id: row.chat_id,
      entity_type: row.entity_type,
      value: row.value,
      normalized_value: row.normalized_value,
      metadata: row.metadata,
      first_seen_at: row.first_seen_at,
      last_seen_at: row.last_seen_at,
      mention_count: row.mention_count,
    },
    edge: {
      id: row.edge_id,
      workspace_id: row.workspace_id,
      chat_id: row.chat_id_1,
      source_node_id: row.source_node_id,
      target_node_id: row.target_node_id,
      relationship: row.relationship,
      strength: row.strength,
      first_seen_at: row.first_seen_at_1,
      last_seen_at: row.last_seen_at_1,
      message_id: row.message_id,
    },
    direction,
  })

  return [...outgoing.map((r: any) => mapRow(r, 'outgoing')), ...incoming.map((r: any) => mapRow(r, 'incoming'))]
}

export function getChatGraph(workspaceId: string, chatId: string): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const db = getDb()
  const nodes = db.prepare(`
    SELECT * FROM graph_nodes
    WHERE workspace_id = ? AND chat_id = ?
    ORDER BY mention_count DESC
  `).all(workspaceId, chatId) as GraphNode[]

  const edges = db.prepare(`
    SELECT e.* FROM graph_edges e
    WHERE e.workspace_id = ? AND e.chat_id = ?
    ORDER BY e.strength DESC
  `).all(workspaceId, chatId) as GraphEdge[]

  return { nodes, edges }
}

export function getAllEntityTypes(workspaceId: string): { type: string; count: number }[] {
  const db = getDb()
  return db.prepare(`
    SELECT entity_type as type, COUNT(*) as count
    FROM graph_nodes
    WHERE workspace_id = ?
    GROUP BY entity_type
    ORDER BY count DESC
  `).all(workspaceId) as { type: string; count: number }[]
}
