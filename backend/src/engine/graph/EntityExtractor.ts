import type { ExtractedEntity, EntityType } from './types.js'

const URL_REGEX = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}(?!\d)/g
const MONEY_REGEX = /(?:[$€£₹]\s*\d[\d,.]*(?:\s*(?:crore|lakh|k|million|billion|M|B|K))?)|(?:\d[\d,.]*\s*(?:crore|lakh|lacs|lac|million|billion))\b/gi
const DATE_REGEXES = [
  /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g,
  /\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\b/g,
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/gi,
  /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}\b/gi,
  /\b(?:today|tomorrow|yesterday)\b/gi,
  /\bnext\s+(?:week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
  /\blast\s+(?:week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
  /\bthis\s+(?:week|month|year)\b/gi,
]

const LOCATION_KEYWORDS = [
  'in', 'at', 'near', 'to', 'from', 'around', 'across', 'via',
  'located', 'based', 'situated', 'area', 'neighbourhood', 'neighborhood',
  'district', 'city', 'town', 'village', 'colony', 'sector', 'phase',
  'bandra', 'andheri', 'powai', 'worli', 'juhu', 'malad', 'thane',
  'navi mumbai', 'mumbai', 'delhi', 'bangalore', 'bengaluru', 'pune',
  'hyderabad', 'chennai', 'kolkata', 'ahmedabad', 'gurgaon', 'noida',
]

const COMPANY_SUFFIXES = ['(?:pvt\\.?\\s*)?ltd', 'limited', 'inc', 'corp', 'corporation', 'llc', 'technologies', 'solutions', 'services', 'ventures', 'group', 'enterprises', 'associates', 'consulting', 'studios', 'labs', 'works', 'media', 'digital', 'systems', 'global']

const COMPANY_REGEX = new RegExp(
  `(?:^|\\s)([A-Z][a-zA-Z]+(?:\\s+[A-Z][a-zA-Z]+){0,3})\\s+(?:${COMPANY_SUFFIXES.join('|')})(?:\\.|\\b)`,
  'g',
)

const LOCATION_REGEX = new RegExp(
  `(?:${LOCATION_KEYWORDS.join('|')})\\s+([A-Z][a-zA-Z]+(?:\\s+[A-Z][a-zA-Z]+)?)`,
  'gi',
)

function normalizeMoney(match: string): string {
  const cleaned = match.replace(/[$€£₹,\s]/g, '').toLowerCase()
  let num = parseFloat(cleaned.replace(/[a-z]/g, '')) || 0
  if (cleaned.includes('crore')) num *= 10000000
  else if (cleaned.includes('lakh') || cleaned.includes('lac')) num *= 100000
  else if (cleaned.includes('million') || cleaned.includes('m') && !cleaned.includes('km')) num *= 1000000
  else if (cleaned.includes('billion') || cleaned.includes('b')) num *= 1000000000
  else if (cleaned.endsWith('k')) num *= 1000
  return String(Math.round(num))
}

export function extractEntities(text: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = []
  const seen = new Set<string>()

  function add(type: EntityType, value: string, normalized: string, metadata?: Record<string, any>) {
    const key = `${type}:${normalized.toLowerCase()}`
    if (seen.has(key)) return
    seen.add(key)
    entities.push({ type, value: value.trim(), normalized: normalized.trim(), metadata })
  }

  // Links
  for (const m of text.match(URL_REGEX) || []) {
    add('link', m, m)
  }

  // Emails
  for (const m of text.match(EMAIL_REGEX) || []) {
    add('email', m, m.toLowerCase())
  }

  // Phone numbers
  for (const m of text.match(PHONE_REGEX) || []) {
    const cleaned = m.replace(/[-.\s()]/g, '')
    add('phone', m.trim(), cleaned)
  }

  // Money
  for (const m of text.match(MONEY_REGEX) || []) {
    const normalized = normalizeMoney(m)
    add('money', m.trim(), normalized, { raw: m.trim(), normalized })
  }

  // Dates
  for (const regex of DATE_REGEXES) {
    for (const m of text.match(regex) || []) {
      add('date', m, m.toLowerCase())
    }
  }

  // Companies
  for (const m of text.matchAll(COMPANY_REGEX)) {
    add('company', m[1].trim(), m[1].trim().toLowerCase())
  }

  // Locations
  for (const m of text.matchAll(LOCATION_REGEX)) {
    add('location', m[1].trim(), m[1].trim().toLowerCase())
  }

  // Documents by file extension
  const fileExtRegex = /\b[\w-]+\.(pdf|docx?|xlsx?|pptx?|zip|rar|tar\.gz|json|csv|xml|txt|png|jpg|jpeg|gif|svg|mp4|mp3|mov|avi)\b/gi
  for (const m of text.match(fileExtRegex) || []) {
    add('document', m, m.toLowerCase())
  }

  return entities
}

export function extractPersonFromContact(contactName: string): ExtractedEntity | null {
  if (!contactName || contactName.length < 2) return null
  return {
    type: 'person',
    value: contactName,
    normalized: contactName.toLowerCase(),
  }
}
