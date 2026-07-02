export interface NormalizedMessage {
  id: string
  chatId: string
  fromMe: number
  sender: string | null
  timestamp: number | null
  messageType: string | null
  textContent: string | null
  quotedMessageId: string | null
  quotedText: string | null
  mediaUrl: string | null
  mediaMimeType: string | null
  mediaSize: number | null
  mediaWidth: number | null
  mediaHeight: number | null
  mediaSha256: string | null
  mediaStoragePath: string | null
  status: string | null
  dataJson: string
}

const TYPES = [
  'conversation',
  'extendedTextMessage',
  'imageMessage',
  'videoMessage',
  'audioMessage',
  'documentMessage',
  'stickerMessage',
  'locationMessage',
  'liveLocationMessage',
  'contactMessage',
  'contactsArrayMessage',
  'pollCreationMessage',
  'pollUpdateMessage',
  'reactionMessage',
  'protocolMessage',
  'eventMessage',
  'listMessage',
  'listResponseMessage',
  'buttonsMessage',
  'buttonsResponseMessage',
  'templateMessage',
  'templateButtonReplyMessage',
  'orderMessage',
  'productMessage',
] as const

function detectType(content: any): string | null {
  for (const t of TYPES) {
    if (content[t]) return t
  }
  if (content['ptvMessage']) return 'ptvMessage'
  if (content['documentWithCaptionMessage']) {
    const sub = content.documentWithCaptionMessage?.message?.documentMessage
    if (sub) return 'documentMessage'
  }
  return 'unknown'
}

function extractText(content: any): string | null {
  if (content.conversation) return content.conversation
  if (content.extendedTextMessage?.text) return content.extendedTextMessage.text
  if (content.imageMessage?.caption) return content.imageMessage.caption
  if (content.videoMessage?.caption) return content.videoMessage.caption
  if (content.documentMessage?.caption) return content.documentMessage.caption
  return null
}

function extractQuotedId(content: any): string | null {
  const ci = content.extendedTextMessage?.contextInfo
  return ci?.stanzaId || ci?.quotedMessage?.conversation || null
}

function extractQuotedText(content: any): string | null {
  const ci = content.extendedTextMessage?.contextInfo
  if (!ci?.quotedMessage) return null
  const q = ci.quotedMessage
  if (q.conversation) return q.conversation
  if (q.extendedTextMessage?.text) return q.extendedTextMessage.text
  if (q.imageMessage?.caption) return q.imageMessage.caption
  if (q.videoMessage?.caption) return q.videoMessage.caption
  if (q.documentMessage?.caption) return q.documentMessage.caption
  if (q.imageMessage) return 'Photo'
  if (q.videoMessage) return 'Video'
  if (q.audioMessage) return 'Audio'
  if (q.stickerMessage) return 'Sticker'
  return 'Message'
}

function getMediaContent(content: any, msgType: string | null): any {
  if (!msgType) return null
  if (msgType === 'documentMessage') {
    const doc = content.documentWithCaptionMessage?.message?.documentMessage
    if (doc) return doc
  }
  return content[msgType] || null
}

export function normalizeMessage(msg: any): NormalizedMessage | null {
  try {
    const chatId = msg.key?.remoteJid
    if (!chatId) return null

    const id = msg.key.id || `${chatId}_${msg.messageTimestamp || Date.now()}`
    const content = msg.message || {}
    const msgType = detectType(content)
    const text = extractText(content)
    const quotedId = extractQuotedId(content)
    const quotedText = extractQuotedText(content)

    const media = getMediaContent(content, msgType)
    let mediaUrl: string | null = null
    let mediaMimeType: string | null = null
    let mediaSize: number | null = null
    let mediaWidth: number | null = null
    let mediaHeight: number | null = null
    let mediaSha256: string | null = null
    let mediaStoragePath: string | null = null

    if (media) {
      mediaUrl = media.url?.toString() || media.directPath || null
      mediaMimeType = media.mimeType || null
      mediaSize = media.fileLength ? Number(media.fileLength) : media.fileSize ? Number(media.fileSize) : null
      mediaWidth = media.width || null
      mediaHeight = media.height || null
      mediaSha256 = media.fileSha256 ? Buffer.from(media.fileSha256).toString('base64') : null
    }

    let status = null
    if (msg.status === 'PENDING') status = 'pending'
    else if (msg.status === 'SERVER_ACK') status = 'sent'
    else if (msg.status === 'DELIVERY_ACK') status = 'delivered'
    else if (msg.status === 'READ') status = 'read'
    else if (msg.status === 'PLAYED') status = 'played'

    return {
      id,
      chatId,
      fromMe: msg.key?.fromMe ? 1 : 0,
      sender: msg.key?.participant || msg.pushName || null,
      timestamp: msg.messageTimestamp || null,
      messageType: msgType,
      textContent: text,
      quotedMessageId: quotedId,
      quotedText,
      mediaUrl,
      mediaMimeType,
      mediaSize,
      mediaWidth,
      mediaHeight,
      mediaSha256,
      mediaStoragePath,
      status,
      dataJson: JSON.stringify(msg),
    }
  } catch (err) {
    console.error('[normalizer]', err)
    return null
  }
}
