import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  RoomView, SplitProvider, forgetRoom, longId, openRoom, readRoomRef, rememberRoom, rememberedRoom, roomLink, shortId,
  type OpenRoom,
} from '../split'
import { supabase } from './supabase'
import { shareOrigin } from './config'
import { Home } from './Home'
import { CreateRoom } from './CreateRoom'

/*
  Three screens: Home (/), Create (/new), Room (/r).
  A room link is /r#<id>.<secret>. On arrival the secret is saved on this phone and the
  address bar is trimmed to /r#<id>, so it doesn't sit in screenshots or browser history.
*/

type Route = { name: 'home'; badLink?: boolean } | { name: 'new' } | { name: 'room'; roomId: string; secret: string }

function readRoute(): Route {
  const path = location.pathname
  if (path === '/new') return { name: 'new' }
  if (path === '/r' || path.startsWith('/r/')) {
    const full = readRoomRef(location.hash.slice(1))
    if (full) {
      rememberRoom({ roomId: full.roomId, secret: full.secret })
      history.replaceState(null, '', `/r#${shortId(full.roomId)}`)
      return { name: 'room', ...full }
    }
    const id = longId(location.hash.slice(1).trim())
    const known = id ? rememberedRoom(id) : undefined
    if (known) return { name: 'room', roomId: known.roomId, secret: known.secret }
    return { name: 'home', badLink: true }
  }
  return { name: 'home' }
}

export function App() {
  const [route, setRoute] = useState<Route>(readRoute)
  const [room, setRoom] = useState<OpenRoom | null>(null)
  const [myId, setMyId] = useState<string | null>(null)

  useEffect(() => {
    const onPop = () => setRoute(readRoute())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const go = useCallback((path: string, replace = false) => {
    if (replace) history.replaceState(null, '', path)
    else history.pushState(null, '', path)
    setRoute(readRoute())
    window.scrollTo(0, 0)
  }, [])

  // Derive the room's keys whenever we enter a room.
  const roomKey = route.name === 'room' ? `${route.roomId}.${route.secret}` : null
  useEffect(() => {
    if (route.name !== 'room') { setRoom(null); return }
    let alive = true
    setMyId(rememberedRoom(route.roomId)?.myId ?? null)
    openRoom(route.roomId, route.secret)
      .then((r) => { if (alive) setRoom(r) })
      .catch(() => { if (alive) go('/', true) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomKey])

  const link = useMemo(
    () => (route.name === 'room' ? roomLink(shareOrigin(), route.roomId, route.secret) : ''),
    [route],
  )

  return (
    <SplitProvider backend={supabase}>
      {route.name === 'home' ? (
        <Home badLink={!!route.badLink} onNew={() => go('/new')} onOpen={(ref) => go(`/r#${shortId(ref.roomId)}.${ref.secret}`)} />
      ) : route.name === 'new' ? (
        <CreateRoom onBack={() => go('/', true)} onCreated={(roomId, secret) => go(`/r#${shortId(roomId)}.${secret}`, true)} />
      ) : room && room.roomId === route.roomId ? (
        <RoomView
          room={room}
          link={link}
          myId={myId}
          onMyId={(id) => { setMyId(id); rememberRoom({ roomId: room.roomId, secret: route.secret, myId: id ?? undefined }) }}
          onName={(name) => rememberRoom({ roomId: room.roomId, secret: route.secret, name })}
          onExit={() => go('/')}
          onGone={() => { forgetRoom(room.roomId); go('/', true) }}
        />
      ) : (
        <div className="sp-screen sp-center-screen" aria-busy="true"><span className="sp-spinner" aria-label="Loading" /></div>
      )}
    </SplitProvider>
  )
}
