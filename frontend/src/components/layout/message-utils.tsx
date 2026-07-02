export function formatTime(ts: number | null | undefined): string {
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function formatDate(ts: number): string {
  const d = new Date(ts * 1000)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 86400000 && d.getDate() === now.getDate()) return 'Today'
  if (diff < 172800000 && d.getDate() === now.getDate() - 1) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
}

export function isSameDay(a: number, b: number): boolean {
  return new Date(a * 1000).toDateString() === new Date(b * 1000).toDateString()
}

export function statusIcon(status: string | null): string {
  switch (status) {
    case 'pending': return '○'
    case 'sent': return '✓'
    case 'delivered': return '✓✓'
    case 'read': return '✓✓'
    case 'played': return '✓✓'
    default: return '✓'
  }
}

export function msgTypeLabel(type: string | null): string {
  const map: Record<string, string> = {
    imageMessage: 'Photo',
    videoMessage: 'Video',
    audioMessage: 'Audio',
    ptvMessage: 'Video',
    documentMessage: 'Document',
    stickerMessage: 'Sticker',
    locationMessage: 'Location',
    liveLocationMessage: 'Live Location',
    contactMessage: 'Contact',
    pollCreationMessage: 'Poll',
    reactionMessage: 'Reaction',
  }
  return map[type ?? ''] || 'Message'
}
