/*
  What this phone remembers, and nothing more: which rooms you've opened here (with their
  secret, so you can come back without the link) and which person you are in each.
  Never sent anywhere. Never throws: private browsing or blocked storage just means the
  phone forgets.
*/

export type RememberedRoom = { roomId: string; secret: string; name?: string; myId?: string; seenAt: string }

const KEY = 'es:rooms'

function read(): RememberedRoom[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((r) => r && typeof r.roomId === 'string' && typeof r.secret === 'string') : []
  } catch {
    return []
  }
}

function write(rooms: RememberedRoom[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(rooms.slice(0, 30)))
  } catch {
    /* storage full or blocked: forgetting is fine */
  }
}

export function rememberedRooms(): RememberedRoom[] {
  return read().sort((a, b) => b.seenAt.localeCompare(a.seenAt))
}

export function rememberedRoom(roomId: string): RememberedRoom | undefined {
  return read().find((r) => r.roomId === roomId)
}

export function rememberRoom(update: Partial<RememberedRoom> & { roomId: string }) {
  const rooms = read()
  const i = rooms.findIndex((r) => r.roomId === update.roomId)
  const next = { ...(i >= 0 ? rooms[i] : {}), ...update, seenAt: new Date().toISOString() } as RememberedRoom
  if (!next.secret) return
  if (i >= 0) rooms.splice(i, 1)
  write([next, ...rooms])
}

export function forgetRoom(roomId: string) {
  write(read().filter((r) => r.roomId !== roomId))
}
