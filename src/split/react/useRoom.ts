import { useCallback, useEffect, useRef, useState } from 'react'
import { loadRoom, watchRoom, type LoadedRoom, type OpenRoom } from '../data/room'
import { SplitError, type SplitBackend } from '../data/backend'

/*
  Keeps one room fresh:
  - live: a Realtime ping after every save triggers a refetch (debounced),
  - safety net: refetch when the app comes back on screen, and a slow poll in case a ping
    was missed (phones drop sockets in the background).
*/

export type RoomStatus = 'loading' | 'ready' | 'not_found' | 'error'

export function useRoom(backend: SplitBackend, room: OpenRoom | null) {
  const [loaded, setLoaded] = useState<LoadedRoom | null>(null)
  const [status, setStatus] = useState<RoomStatus>('loading')
  const [live, setLive] = useState(false)
  const busy = useRef(false)
  const again = useRef(false)

  const reload = useCallback(async () => {
    if (!room) return
    // One fetch at a time; a ping during a fetch schedules exactly one more.
    if (busy.current) { again.current = true; return }
    busy.current = true
    try {
      do {
        again.current = false
        const next = await loadRoom(backend, room)
        setLoaded(next)
        setStatus('ready')
      } while (again.current)
    } catch (e) {
      const code = e instanceof SplitError ? e.code : 'network'
      if (code === 'room_not_found') { setLoaded(null); setStatus('not_found') }
      else setStatus((s) => (s === 'ready' ? s : 'error')) // keep showing what we have
    } finally {
      busy.current = false
    }
  }, [backend, room])

  useEffect(() => {
    if (!room) return
    setStatus('loading')
    setLoaded(null)
    void reload()

    let timer: number | undefined
    const ping = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void reload(), 250)
    }
    const stop = watchRoom(backend, room.roomId, ping, setLive)
    const onVisible = () => { if (document.visibilityState === 'visible') void reload() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    const poll = window.setInterval(onVisible, 45_000)
    return () => {
      stop()
      window.clearTimeout(timer)
      window.clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [backend, room, reload])

  return { loaded, status, live, reload }
}
