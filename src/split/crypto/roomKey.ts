/*
  Room encryption — the ONLY place crypto lives in this module.

  - Each room has one random 256-bit secret, made on the phone with Web Crypto (never hand-rolled).
    It travels only in the room link after '#', so the server never sees it.
  - From that secret, HKDF derives two separate things:
      * the encryption key (AES-GCM), which never leaves the phone, and
      * the access token sent with every call; the server keeps only its SHA-256.
    Knowing the token (e.g. from server logs) does not reveal the encryption key.
  - Every blob is bound to its room and entry (AES-GCM additional data), so a blob copied
    to another entry or room fails to decrypt instead of showing the wrong thing.
  - Text is padded to size buckets before encrypting so the length doesn't give away
    "Pizza" from a long note. Same format as Gillefeeling ("2." + base64url(iv ‖ ciphertext)).
*/

const FORMAT = '2.'
const IV_BYTES = 12
const enc = new TextEncoder()
const dec = new TextDecoder()

export type RoomKeys = {
  /** base64url secret, the part after '.' in the link. */
  secret: string
  /** Sent to the server with every call. */
  token: string
  encKey: CryptoKey
}

export function toB64u(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromB64u(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))
    return Uint8Array.from(bin, (c) => c.charCodeAt(0))
  } catch {
    return null
  }
}

export function newSecret(): string {
  return toB64u(crypto.getRandomValues(new Uint8Array(32)))
}

/** Derives the room's token and encryption key from its secret. Throws on a malformed secret. */
export async function roomKeys(roomId: string, secret: string): Promise<RoomKeys> {
  const raw = fromB64u(secret)
  if (!raw || raw.length !== 32) throw new Error('bad_secret')
  const base = await crypto.subtle.importKey('raw', raw as BufferSource, 'HKDF', false, ['deriveBits', 'deriveKey'])
  const salt = enc.encode(`es1|${roomId}`)
  const tokenBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('es1|room-token') }, base, 256)
  const encKey = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('es1|room-enc') },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
  return { secret, token: toB64u(new Uint8Array(tokenBits)), encKey }
}

/** Size buckets in bytes: 64, 256, 1 KB, 4 KB. Entries are capped well under 4 KB. */
function bucketFor(length: number): number {
  for (const size of [64, 256, 1024, 4096]) if (length < size) return size
  throw new Error('too_big')
}

function pad(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bucketFor(bytes.length))
  out.set(bytes)
  out[bytes.length] = 0x80 // ISO/IEC 7816-4: one 0x80, then zeros
  return out
}

function unpad(bytes: Uint8Array): Uint8Array | null {
  let i = bytes.length - 1
  while (i >= 0 && bytes[i] === 0) i--
  return i >= 0 && bytes[i] === 0x80 ? bytes.slice(0, i) : null
}

const aad = (roomId: string, entryId: string) => enc.encode(`es1|entry|${roomId}|${entryId}`)

export async function encryptEntry(keys: RoomKeys, roomId: string, entryId: string, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const plain = pad(enc.encode(JSON.stringify(value)))
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(roomId, entryId) }, keys.encKey, plain as BufferSource),
  )
  const out = new Uint8Array(iv.length + ct.length)
  out.set(iv)
  out.set(ct, iv.length)
  return FORMAT + toB64u(out)
}

/** Returns the parsed JSON, or null if it can't be read (wrong key, tampered, garbage). */
export async function decryptEntry(keys: RoomKeys, roomId: string, entryId: string, blob: string): Promise<unknown> {
  if (!blob.startsWith(FORMAT)) return null
  const bytes = fromB64u(blob.slice(FORMAT.length))
  if (!bytes || bytes.length <= IV_BYTES) return null
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.slice(0, IV_BYTES) as BufferSource, additionalData: aad(roomId, entryId) },
      keys.encKey,
      bytes.slice(IV_BYTES) as BufferSource,
    )
    const unpadded = unpad(new Uint8Array(plain))
    return unpadded ? JSON.parse(dec.decode(unpadded)) : null
  } catch {
    return null
  }
}
