import { fromB64u, toB64u } from '../crypto/roomKey'

/*
  Room links: https://<host>/r#<roomId as 22 chars>.<secret as 43 chars>
  Everything after '#' stays on the phone: browsers never send it to Vercel or Supabase.
  Chat apps sometimes mangle the '#' part, so the reader is forgiving (trailing punctuation,
  %23 instead of #, the link pasted in the middle of a message).
*/

export function shortId(uuid: string): string {
  const hex = uuid.replace(/-/g, '')
  return toB64u(Uint8Array.from(hex.match(/../g)!, (h) => parseInt(h, 16)))
}

export function longId(short: string): string | null {
  const bytes = fromB64u(short)
  if (!bytes || bytes.length !== 16) return null
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function roomLink(origin: string, roomId: string, secret: string): string {
  return `${origin}/r#${shortId(roomId)}.${secret}`
}

export type RoomRef = { roomId: string; secret: string }

/** Finds "<22>.<43>" in a hash, a whole link or a pasted message. */
export function readRoomRef(text: string): RoomRef | null {
  let t = text
  try { t = decodeURIComponent(text) } catch { /* keep as typed */ }
  const m = t.match(/([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})(?![A-Za-z0-9_-])/)
  if (!m) return null
  const roomId = longId(m[1])
  const secret = fromB64u(m[2])
  return roomId && secret && secret.length === 32 ? { roomId, secret: m[2] } : null
}
