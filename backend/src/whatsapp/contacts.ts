import { Server } from 'socket.io'
import { getDb } from './db.js'

export function handleContactsUpsert(workspaceId: string, contacts: any[], io: Server) {
  const db = getDb()

  const stmt = db.prepare(`
    INSERT INTO contacts (jid, workspace_id, name, push_name, phone_number)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(jid, workspace_id) DO UPDATE SET
      name = COALESCE(excluded.name, contacts.name),
      push_name = COALESCE(excluded.push_name, contacts.push_name),
      phone_number = COALESCE(excluded.phone_number, contacts.phone_number)
  `)

  const formatted: any[] = []
  for (const c of contacts) {
    const jid = c.id || c.jid
    if (!jid) continue
    const name = c.name || null
    const pushName = c.notify || c.pushName || null
    const phone = jid.split('@')[0] || null

    stmt.run(jid, workspaceId, name, pushName, phone)
    formatted.push({ jid, name, pushName, phone })
  }

  io.emit('contacts.upsert', { workspaceId, contacts: formatted })
}

export function handleContactsUpdate(workspaceId: string, contacts: any[], io: Server) {
  const db = getDb()

  const stmt = db.prepare(`
    UPDATE contacts SET name = ?, push_name = ?
    WHERE jid = ? AND workspace_id = ?
  `)

  const formatted: any[] = []
  for (const c of contacts) {
    const jid = c.id || c.jid
    if (!jid) continue
    const name = c.name ?? undefined
    const pushName = c.notify ?? c.pushName ?? undefined

    stmt.run(name || null, pushName || null, jid, workspaceId)
    formatted.push({ jid, name: name || null, pushName: pushName || null })
  }

  io.emit('contacts.update', { workspaceId, contacts: formatted })
}
