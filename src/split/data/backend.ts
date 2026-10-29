/*
  The only things this module needs from Supabase. The host app passes in its own client
  (Gillefeeling already has one for the same project), so the module never creates a second
  connection and doesn't depend on supabase-js directly.
*/

export type RpcResult<T> = { data: T | null; error: { message: string; code?: string } | null }

export interface ChannelLike {
  on(type: 'broadcast', filter: { event: string }, callback: (payload: unknown) => void): ChannelLike
  subscribe(callback?: (status: string, err?: Error) => void): ChannelLike
}

export interface SplitBackend {
  rpc<T = unknown>(fn: string, args: Record<string, unknown>): PromiseLike<RpcResult<T>>
  channel(name: string, opts?: { config?: { broadcast?: { self?: boolean } } }): ChannelLike
  removeChannel(channel: ChannelLike): unknown
}

/** Errors the server raises on purpose. Everything else counts as "network". */
export type SplitErrorCode = 'room_not_found' | 'edit_conflict' | 'room_full' | 'rate_limited' | 'bad_request' | 'network'

export class SplitError extends Error {
  constructor(public code: SplitErrorCode) {
    super(code)
  }
}

export function toSplitError(error: { message: string } | null | undefined): SplitError {
  const known: SplitErrorCode[] = ['room_not_found', 'edit_conflict', 'room_full', 'rate_limited', 'bad_request']
  const code = known.find((c) => error?.message?.includes(c))
  return new SplitError(code ?? 'network')
}
