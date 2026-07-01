interface ExtractedMessage {
  id: string
  chatId: string
  fromMe: number
  sender: string | null
  timestamp: number | null
  messageType: string | null
  textContent: string | null
  quotedMessageId: string | null
  mediaUrl: string | null
  mediaMimeType: string | null
  mediaSize: number | null
  mediaWidth: number | null
  mediaHeight: number | null
  status: string | null
  dataJson: string
}

function getMessageContent(msg: any): any {
  return msg.message || {}
}

function getMessageType(content: any): string | null {
  const types = [
    'conversation', 'extendedTextMessage', 'imageMessage', 'videoMessage',
    'audioMessage', 'documentMessage', 'stickerMessage', 'locationMessage',
    'contactMessage', 'contactsArrayMessage', 'liveLocationMessage',
    'pollCreationMessage', 'pollUpdateMessage', 'reactionMessage',
    'protocolMessage', 'eventMessage', 'listMessage', 'listResponseMessage',
    'buttonsMessage', 'buttonsResponseMessage', 'templateMessage',
    'templateButtonReplyMessage', 'orderMessage', 'productMessage',
  ]
  for (const t of types) {
    if (content[t]) return t
  }
  return 'unknown'
}

function getText(content: any, msgType: string | null): string | null {
  if (content.conversation) return content.conversation
  if (content.extendedTextMessage?.text) return content.extendedTextMessage.text
  if (content.imageMessage?.caption) return content.imageMessage.caption
  if (content.videoMessage?.caption) return content.videoMessage.caption
  if (content.documentMessage?.caption) return content.documentMessage.caption
  return null
}

function getQuotedId(content: any): string | null {
  const ctx = content.extendedTextMessage?.contextInfo
  if (ctx?.stanzaId) return ctx.stanzaId
  return null
}

function getMediaMetadata(content: any, msgType: string | null) {
  if (!msgType) {
    return {
      mediaUrl: null,
      mediaMimeType: null,
      mediaSize: null,
      mediaWidth: null,
      mediaHeight: null,
    }
  }
  const media = content[msgType]
  if (!media) {
    return {
      mediaUrl: null,
      mediaMimeType: null,
      mediaSize: null,
      mediaWidth: null,
      mediaHeight: null,
    }
  }
  return {
    mediaUrl: media.url ? media.url.toString() : null,
    mediaMimeType: media.mimeType || null,
    mediaSize: media.fileLength ? Number(media.fileLength) : null,
    mediaWidth: media.width || null,
    mediaHeight: media.height || null,
  }
}

export function extractMessageFields(msg: any): ExtractedMessage | null {
  try {
    const chatId = msg.key?.remoteJid
    if (!chatId) return null

    const id = msg.key.id || `${chatId}_${msg.messageTimestamp || Date.now()}`
    const content = getMessageContent(msg)
    const msgType = getMessageType(content)
    const text = getText(content, msgType)
    const quotedId = getQuotedId(content)
    const media = getMediaMetadata(content, msgType)

    return {
      id,
      chatId,
      fromMe: msg.key?.fromMe ? 1 : 0,
      sender: msg.key?.participant || msg.pushName || null,
      timestamp: msg.messageTimestamp || null,
      messageType: msgType,
      textContent: text,
      quotedMessageId: quotedId,
      status: msg.status || null,
      ...media,
      dataJson: JSON.stringify(msg),
    }
  } catch {
    return null
  }
}
