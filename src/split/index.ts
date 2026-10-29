/*
  @ellenial/split — the reusable cost-splitting module.

  Standalone app and Gillefeeling both use exactly this. It has no idea who is signed in
  and never creates its own Supabase client: the host passes one in via <SplitProvider>.

  Gillefeeling (later):
    <SplitProvider backend={supabase} copy={gillefeelingSplitCopy}>
      <RoomView room={await openRoom(roomId, secretFromGroupKey)} ... />
    </SplitProvider>
  plus 'wss://<project>.supabase.co' in its CSP connect-src for live updates.
*/

import './split.css'

export { SplitProvider, useSplit } from './react/context'
export { RoomView, type RoomViewProps } from './react/RoomView'
export { Button, Chip, Sheet, QrCode, Icon } from './react/ui'

export { createRoom, openRoom, loadRoom, saveEntry, deleteEntry, setSettled, deleteRoom, watchRoom, type OpenRoom } from './data/room'
export { roomLink, readRoomRef, shortId, longId, type RoomRef } from './data/link'
export { rememberedRooms, rememberedRoom, rememberRoom, forgetRoom, type RememberedRoom } from './data/device'
export { SplitError, type SplitBackend } from './data/backend'

export { splitCopy, type SplitCopy } from './copy/en'
export { CURRENCIES, parseAmount, formatAmount, type Currency } from './core/money'
export { computeBalances, shareOut } from './core/balances'
export { settleUp, type Transfer } from './core/settle'
export { LIMITS, type RoomState, type Expense, type Payment, type Member } from './core/model'
