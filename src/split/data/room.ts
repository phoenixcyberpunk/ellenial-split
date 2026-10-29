import { decryptEntry, encryptEntry, newSecret, roomKeys, type RoomKeys } from '../crypto/roomKey'
import { buildRoomState, parseEntryData, type Entry, type EntryData, type Member, type RoomInfo, type RoomState } from '../core/model'
import type { Currency } from '../core/money'
import { SplitError, toSplitError, type SplitBackend } from './backend'

/*
  Talking to the server: everything is encrypted before it leaves the phone and decrypted
  (then checked as untrusted) when it comes back.
*/

export type OpenRoom = { roomId: string; keys: RoomKeys }

type ServerEntry = { id: string; data_enc: string; revision: number; updated_at: string }
type ServerRoom = { settled_at: string | null; last_activity_at: string; entries: ServerEntry[] }

async function call<T>(backend: SplitBackend, fn: string, args: Record<string, unknown>): Promise<T> {
  let res
  try {
    res = await backend.rpc<T>(fn, args)
  } catch {
    throw new SplitError('network')
  }
  if (res.error) throw toSplitError(res.error)
  return res.data as T
}

export async function openRoom(roomId: string, secret: string): Promise<OpenRoom> {
  return { roomId, keys: await roomKeys(roomId, secret) }
}

/** Makes a new room with its settings and the creator as the first person. */
export async function createRoom(
  backend: SplitBackend,
  input: { name: string; currency: Currency; myName: string },
): Promise<{ room: OpenRoom; myId: string }> {
  const roomId = crypto.randomUUID()
  const myId = crypto.randomUUID()
  const room = await openRoom(roomId, newSecret())
  const info: RoomInfo = { kind: 'room', v: 1, name: input.name, currency: input.currency }
  const me: Member = { kind: 'member', v: 1, name: input.myName }
  const entries = [
    { id: roomId, data_enc: await encryptEntry(room.keys, roomId, roomId, info) },
    { id: myId, data_enc: await encryptEntry(room.keys, roomId, myId, me) },
  ]
  await call(backend, 'split_create_room', { p_room: roomId, p_token: room.keys.token, p_entries: entries })
  return { room, myId }
}

export type LoadedRoom = { state: RoomState; lastActivityAt: string; unreadable: number }

export async function loadRoom(backend: SplitBackend, room: OpenRoom): Promise<LoadedRoom> {
  const data = await call<ServerRoom>(backend, 'split_get_room', { p_room: room.roomId, p_token: room.keys.token })
  let unreadable = 0
  const entries: Entry[] = []
  await Promise.all(
    data.entries.map(async (e) => {
      const parsed = parseEntryData(await decryptEntry(room.keys, room.roomId, e.id, e.data_enc))
      if (parsed) entries.push({ id: e.id, revision: e.revision, updatedAt: e.updated_at, data: parsed })
      else unreadable++
    }),
  )
  entries.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.id.localeCompare(b.id))
  return { state: buildRoomState(entries, data.settled_at, room.roomId), lastActivityAt: data.last_activity_at, unreadable }
}

/** Adds (revision undefined) or changes an entry. Returns the new revision. */
export async function saveEntry(backend: SplitBackend, room: OpenRoom, id: string, data: EntryData, revision?: number): Promise<number> {
  return call<number>(backend, 'split_put_entry', {
    p_room: room.roomId,
    p_token: room.keys.token,
    p_id: id,
    p_data_enc: await encryptEntry(room.keys, room.roomId, id, data),
    p_expected_revision: revision ?? null,
  })
}

export async function deleteEntry(backend: SplitBackend, room: OpenRoom, id: string): Promise<void> {
  await call(backend, 'split_delete_entry', { p_room: room.roomId, p_token: room.keys.token, p_id: id })
}

export async function setSettled(backend: SplitBackend, room: OpenRoom, settled: boolean): Promise<string | null> {
  return call<string | null>(backend, 'split_set_settled', { p_room: room.roomId, p_token: room.keys.token, p_settled: settled })
}

export async function deleteRoom(backend: SplitBackend, room: OpenRoom): Promise<void> {
  await call(backend, 'split_delete_room', { p_room: room.roomId, p_token: room.keys.token })
}

/**
 * Live updates: the server pings "changed" on the room's channel after every save.
 * The ping carries no data; the caller refetches. Returns a stop function.
 */
export function watchRoom(backend: SplitBackend, roomId: string, onChange: () => void, onStatus?: (live: boolean) => void): () => void {
  const channel = backend
    .channel(`split:${roomId}`, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'changed' }, () => onChange())
    .subscribe((status) => onStatus?.(status === 'SUBSCRIBED'))
  return () => {
    backend.removeChannel(channel)
  }
}
