export type EntityType =
  | 'person'
  | 'phone'
  | 'email'
  | 'company'
  | 'location'
  | 'date'
  | 'money'
  | 'document'
  | 'link'
  | 'unknown'

export interface GraphNode {
  id: string
  workspace_id: string
  chat_id: string | null
  entity_type: EntityType
  value: string
  normalized_value: string
  metadata: string | null
  first_seen_at: number | null
  last_seen_at: number | null
  mention_count: number
}

export interface GraphEdge {
  id: number
  workspace_id: string
  chat_id: string | null
  source_node_id: string
  target_node_id: string
  relationship: string
  strength: number
  first_seen_at: number | null
  last_seen_at: number | null
  message_id: string | null
}

export interface ExtractedEntity {
  type: EntityType
  value: string
  normalized: string
  metadata?: Record<string, any>
}

export interface RelatedEntity {
  node: GraphNode
  edge: GraphEdge
  direction: 'outgoing' | 'incoming'
}
