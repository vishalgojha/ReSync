import { getDb } from '../core/db.js'
import type { EventDispatcher, DispatchContext } from '../core/dispatcher.js'

function persistUpsert(ctx: DispatchContext, contacts: any[]) {
  const db = getDb()

  const stmt = db.prepare(`
    INSERT INTO contacts (jid, workspace_id, name, push_name, phone_number, profile_pic_url)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(jid, workspace_id) DO UPDATE SET
      name = COALESCE(excluded.name, contacts.name),
      push_name = COALESCE(excluded.push_name, contacts.push_name),
      phone_number = COALESCE(excluded.phone_number, contacts.phone_number),
      profile_pic_url = COALESCE(excluded.profile_pic_url, contacts.profile_pic_url)
  `)

  const formatted: any[] = []
  db.transaction(() => {
    for (const c of contacts) {
      const jid = c.id || c.jid
      if (!jid) continue
      const name = c.name || null
      const pushName = c.notify || c.pushName || c.verifiedName || null
      const phone = jid.split('@')[0] || null
      const picUrl = c.imgUrl || null

      stmt.run(jid, ctx.workspaceId, name, pushName, phone, picUrl)
      formatted.push({ jid, name, pushName, phone })
    }
  })()

  ctx.io.emit('contact.updated', { workspaceId: ctx.workspaceId, contacts: formatted })
}

function persistUpdate(ctx: DispatchContext, updates: any[]) {
  const db = getDb()

  const stmt = db.prepare(`
    UPDATE contacts SET name = COALESCE(?, name), push_name = COALESCE(?, push_name), profile_pic_url = COALESCE(?, profile_pic_url)
    WHERE jid = ? AND workspace_id = ?
  `)

  const formatted: any[] = []
  for (const u of updates) {
    const jid = u.id || u.jid
    if (!jid) continue
    const name = u.name ?? null
    const pushName = u.notify ?? u.pushName ?? null
    const picUrl = u.imgUrl ?? null
    stmt.run(name, pushName, picUrl, jid, ctx.workspaceId)
    formatted.push({ jid, name, pushName })
  }

  ctx.io.emit('contact.updated', { workspaceId: ctx.workspaceId, contacts: formatted })
}

export function registerContactHandlers(dispatcher: EventDispatcher) {
  dispatcher.on('contacts.upsert', persistUpsert)
  dispatcher.on('contacts.update', persistUpdate)
}
