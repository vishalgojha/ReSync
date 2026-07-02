import type { ExtractedEntity } from './types.js'

export interface EntityPair {
  sourceIdx: number
  targetIdx: number
  relationship: string
}

const MONEY_KEYWORDS = /\b(?:price|cost|budget|spend|worth|value|rate|amount|fee|charge|rent|deposit|total|pay|paid|payment|salary|income|revenue|profit|lakh|crore)\b/i
const LOCATION_KEYWORDS = /\b(?:in|at|near|located|situated|area|neighbourhood|neighborhood|district|sector|phase|colony)\b/i
const PURCHASE_KEYWORDS = /\b(?:buy|purchase|interested|looking|want|need|require|searching|seeking|deal|offer|property|flat|apartment|house|villa|plot|land|office|shop|space)\b/i
const CONTACT_KEYWORDS = /\b(?:call|contact|reach|whatsapp|text|message|phone|number|email|mail|reachable)\b/i
const TIME_KEYWORDS = /\b(?:when|schedule|timing|available|free|meet|meeting|appointment|visit|inspection|deadline|by|before|after|within)\b/i
const REJECTION_KEYWORDS = /\b(?:no|not|reject|cancel|decline|passed|skip|out of budget|over budget|cannot|can't|won't|unable)\b/i
const INTEREST_KEYWORDS = /\b(?:interested|like|love|perfect|great|nice|good|yes|confirm|book|reserve|shortlist|finalize)\b/i
const COMPARISON_KEYWORDS = /\b(?:versus|vs|compared|cheaper|expensive|better|worse|bigger|smaller|similar|alternative|instead|rather|either|option|choice|prefer)\b/i

type RelationshipRule = (entities: ExtractedEntity[], idx: number, text: string) => EntityPair[]

const RELATIONSHIP_RULES: RelationshipRule[] = [
  // Person → [budget/price] → Money
  (entities, idx, text) => {
    if (entities[idx].type !== 'person') return []
    return entities
      .filter((e, i) => i !== idx && e.type === 'money' && MONEY_KEYWORDS.test(text))
      .map(e => ({ sourceIdx: idx, targetIdx: entities.indexOf(e), relationship: 'has_budget' }))
  },

  // Person → [interested_in] → Location
  (entities, idx, text) => {
    if (entities[idx].type !== 'person') return []
    return entities
      .filter((e, i) => i !== idx && e.type === 'location' && (PURCHASE_KEYWORDS.test(text) || INTEREST_KEYWORDS.test(text)))
      .map(e => ({ sourceIdx: idx, targetIdx: entities.indexOf(e), relationship: 'interested_in' }))
  },

  // Person → [contact] → Phone / Email
  (entities, idx, text) => {
    if (entities[idx].type !== 'person') return []
    return entities
      .filter((e, i) => i !== idx && (e.type === 'phone' || e.type === 'email') && CONTACT_KEYWORDS.test(text))
      .map(e => ({ sourceIdx: idx, targetIdx: entities.indexOf(e), relationship: e.type === 'phone' ? 'has_phone' : 'has_email' }))
  },

  // Location → [valued_at] → Money
  (entities, idx, text) => {
    if (entities[idx].type !== 'location') return []
    return entities
      .filter((e, i) => i !== idx && e.type === 'money' && (MONEY_KEYWORDS.test(text) || PURCHASE_KEYWORDS.test(text)))
      .map(e => ({ sourceIdx: idx, targetIdx: entities.indexOf(e), relationship: 'valued_at' }))
  },

  // Person → [rejected] → Location
  (entities, idx, text) => {
    if (entities[idx].type !== 'person') return []
    return entities
      .filter((e, i) => i !== idx && e.type === 'location' && REJECTION_KEYWORDS.test(text))
      .map(e => ({ sourceIdx: idx, targetIdx: entities.indexOf(e), relationship: 'rejected' }))
  },

  // Person → [works_at] → Company
  (entities, idx, text) => {
    if (entities[idx].type !== 'person') return []
    return entities
      .filter((e, i) => i !== idx && e.type === 'company')
      .map(e => ({ sourceIdx: idx, targetIdx: entities.indexOf(e), relationship: 'works_at' }))
  },

  // Money → [for] → Document / Location
  (entities, idx, text) => {
    if (entities[idx].type !== 'money') return []
    return entities
      .filter((e, i) => i !== idx && (e.type === 'document' || e.type === 'location'))
      .map(e => ({ sourceIdx: idx, targetIdx: entities.indexOf(e), relationship: 'for' }))
  },

  // Person → [mentioned_with] → Date
  (entities, idx, text) => {
    if (entities[idx].type !== 'person') return []
    return entities
      .filter((e, i) => i !== idx && e.type === 'date' && TIME_KEYWORDS.test(text))
      .map(e => ({ sourceIdx: idx, targetIdx: entities.indexOf(e), relationship: 'mentioned_with_date' }))
  },

  // Person → [compared] → Location (when comparison keywords present)
  (entities, idx, text) => {
    if (entities[idx].type !== 'person') return []
    return entities
      .filter((e, i) => i !== idx && e.type === 'location' && COMPARISON_KEYWORDS.test(text))
      .map(e => ({ sourceIdx: idx, targetIdx: entities.indexOf(e), relationship: 'compared' }))
  },
]

export function buildRelationships(entities: ExtractedEntity[], text: string): EntityPair[] {
  const pairs: EntityPair[] = []
  const seen = new Set<string>()

  for (let i = 0; i < entities.length; i++) {
    for (const rule of RELATIONSHIP_RULES) {
      const result = rule(entities, i, text)
      for (const pair of result) {
        const key = `${pair.sourceIdx}-${pair.relationship}-${pair.targetIdx}`
        if (seen.has(key)) continue
        seen.add(key)
        pairs.push(pair)
      }
    }
  }

  // Fallback: co-occurrence edge for any two entities in the same message
  if (entities.length >= 2) {
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const key = `${i}-co_occurs_with-${j}`
        if (seen.has(key)) continue

        // Only add co-occurrence if no specific relationship was already extracted
        const hasRelationship = pairs.some(p => (p.sourceIdx === i && p.targetIdx === j) || (p.sourceIdx === j && p.targetIdx === i))
        if (!hasRelationship) {
          seen.add(key)
          pairs.push({
            sourceIdx: i,
            targetIdx: j,
            relationship: 'co_occurs_with',
          })
        }
      }
    }
  }

  return pairs
}
