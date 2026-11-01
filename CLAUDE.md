# Ellenial Split — Project Guide

Read this first in every session. It replaces re-reading the codebase.
Working name **Split** / repo `ellenial-split` (real app name decided later).
A free cost-splitting mini-app under the brand **Ellenial**, and a reusable module that
Gillefeeling will import later ("split costs for this hangout").

## Infrastructure
- **Code:** GitHub `phoenixcyberpunk/ellenial-split` (public, open source).
- **Database:** Gillefeeling's Supabase project `gillefeeling` (ref `knvrvmqdxvcatsrvkrgx`, Stockholm, Free plan,
  max 2 active projects). Everything for this app is in its own `split` schema + `public.split_*` functions,
  with no link to Gillefeeling's tables or auth. Can move to its own project later if it grows.
- **Hosting:** Vercel team "The Ellenial Project", project `ellenial-split`. `main` → `split.ellenial.app` (production);
  `staging` branch → `split-staging.ellenial.app` (look here first, then merge to main).
- **Workspace limits:** npm works (1 Nov), supabase.co doesn't → real backend only on Vercel deployments.
  Locally: `npm run build`, `npm test` (pure maths), and a preview build with an in-memory backend shim (see "Testing").

## Decisions (2026-10-29)
- **Live updates are a must.** Server pings `split:<roomId>` (Realtime broadcast, public channel, empty
  payload) after every change; phones refetch + decrypt. Safety net: refetch on return to the app + 45 s poll.
- **End-to-end encrypted, like Gillefeeling.** Room secret lives only in the link after `#`. HKDF derives
  (a) the AES-GCM key (never leaves the phone) and (b) the access token sent to the server, which stores
  only its SHA-256. Blob format `2.` + base64url(iv‖ct), padded to 64/256/1024/4096-byte buckets,
  AAD `es1|entry|<roomId>|<entryId>`. Server sees random IDs, blobs, timestamps. Nothing else.
- **No accounts, no Supabase anonymous sign-in.** Gillefeeling keeps anonymous sign-ins OFF (turning them on
  would let throwaway accounts count as signed-in users there). The link IS the permission.
- **Minimal data:** room name, nicknames, amounts, what for, dates — all encrypted.
- **Rooms delete themselves:** 7 days after "settled", or 30 days without changes (`split.cleanup()`, pg_cron
  `split-cleanup` at :41 every hour). Anyone can delete a room immediately.
- **Anyone can mark a room settled, with undo.** Any new change reopens a settled room automatically.
- **Joining:** one tap via link or QR, then "Which one are you?" (pick a name or add yourself).
- **Settle-up = truly fewest transfers** for up to 15 people with money to move (exact subset search),
  greedy above that. Beat the usual shortcut in ~1.3 % of random rooms; tested against brute force.

## Ellenial look (final, decided 1 Nov 2026 — don't reopen)
Source of truth: Ellenial – Brand identity doc (https://claude.ai/artifact/9Fng54MMZMyyKjkqKaVR7r). Applied everywhere, no exceptions.
- **Palette** (tokens in `src/app/app.css`, same names as Gillefeeling; `split.css` fallbacks match):
  light Peach `#FEF2E2` bg · Card `#FFFBF5` · Lavender `#F1EAF8` · Periwinkle `#B7B1E6` · Indigo `#342E86` · Night `#1F1A2E` ·
  Muted `#575166` · Line `#EDE1D1`. Dark: `#17141F` · `#221E2C` · `#2D2640` · Periwinkle `#463C6E` (text `#F3EEF8` on it) ·
  accent `#B39AE8` (text `#1A1430` on it) · text `#F3EEF8` · muted `#C2BACF` · line `#332D40`. Red only for delete/errors.
  Old non-brand tokens (line-strong, ink-faint as its own colour, cover-* tints, accent-soft #E6DDF3) are gone.
- **Fonts:** Fraunces (headings) + DM Sans (text), self-hosted via @fontsource. Replaced Instrument Sans (31 Oct choice, superseded).
- **Auto / Light / Dark:** `public/ellenial-theme.js`, copied UNCHANGED from ellenial maps, loaded in `<head>` before CSS
  (excluded from the SPA rewrite in vercel.json). Sets `data-theme` on `<html>`; saved on this phone only (`ellenial:theme`).
  Dark tokens live under `:root[data-theme="dark"]` AND an identical `@media (prefers-color-scheme: dark) :root:not([data-theme])`
  block (for no-JS) — keep them identical. Switch shown in the Home footer and in a room's More sheet (`RoomView moreExtra`,
  so the module stays host-agnostic; Gillefeeling passes its own). Test with `?theme=light|dark`.
- **Accessibility:** text ≥ 4.5:1, controls ≥ 3:1. Line is decorative only; inputs, chips, pick rows, the Equal/Custom switch get
  a `--edge` (Muted) outline. Selected chips/switch = Periwinkle fill + Indigo outline + ✓ (never colour alone). Periwinkle is a
  fill only (Muted text fails on it at 3.8:1 → balance card uses Night text). Invalid amount shows words, not just a line change.
  Payment rows no longer use opacity (it dimmed text below 4.5:1). Checked 1 Nov: every rendered text in both themes ≥ 4.5:1.

## Brand Principles applied
1. Worst day: no "you owe", no red money, no nagging. Money is "to send" / "to get back". Red only for delete.
2. Art: placeholder wordmark + favicon in plain type only. **Real mark must be made by a person (the owner) before any release.**
3. Pay myself: free, no ads, no tracking.
4. Data: encrypted, temporary, explained in-app (More → How private is this?).
   **Honest limit:** everyone in a room has the key, so anyone could work out all balances from the expense
   list. The app only *shows* you your own balance and transfers (never a ranking) and says so in Settle up.
5. Runs without me: rooms clean themselves up; limits keep the free plan free (1000 entries/room,
   50 people, 30 new rooms/address/hour, 600/hour total).
6. Free and open: AGPL-3.0, public repo.

## Data model (inside the encrypted blobs, `src/split/core/model.ts`)
- One `split.entries` row per thing; kind hidden in the blob: `room` (entry id = room id; name, currency),
  `member` (nickname), `expense` (title, amount in minor units, paidBy, split, date, addedBy),
  `payment` (from, to, amount, date).
- Split modes: `equal` (among ids), `exact` (minor amounts that must add up), `shares` (weights; model only, no UI yet).
- Rounding: leftover öre go by largest remainder, ties by sorted id → every phone gets the same numbers.
- Decrypted data is untrusted: `parseEntryData` checks every field and limit.
- Edits use `revision` (optimistic concurrency): `split_put_entry(..., p_expected_revision)` → `edit_conflict`.

## Server (`supabase/migrations/20261029000001_split_rooms.sql`)
- Tables `split.rooms`, `split.entries`, `split.create_attempts`, `split.settings` (salt). RLS on, no policies,
  schema not granted to anon/authenticated → unreachable through the API.
- Functions (anon + authenticated may execute): `split_create_room`, `split_get_room`, `split_put_entry`,
  `split_delete_entry`, `split_set_settled`, `split_delete_room`. Wrong token and unknown room give the same
  `room_not_found`. Tested 2026-10-29 with SQL as `anon` (13 checks) + cleanup timing (31d idle / 8d settled
  deleted; 29d idle / 6d settled kept). Security advisor warns that these are callable without login: intended.

## Code structure
```
src/split/            the reusable module (no app imports; host passes its Supabase client)
  index.ts            public API
  core/               money.ts, model.ts, balances.ts, settle.ts (pure) + core.test.ts
  crypto/roomKey.ts   the ONLY place crypto lives
  data/               backend.ts (minimal client interface), room.ts (RPC calls), link.ts, device.ts (localStorage)
  react/              context (SplitProvider), useRoom (live sync), RoomView, ExpenseSheet, SettleSheet,
                      People (WhoAreYou + PeopleSheet), RoomSheets (Invite, More), ui (Sheet, Button, Chip, QrCode, Icon)
  copy/en.ts          ALL module words (host can pass its own with the same shape)
  split.css           .sp- prefixed; reads Gillefeeling's token names with fallbacks
src/app/              standalone shell: Home, CreateRoom, App (routes / , /new, /r), config, copy, app.css (tokens)
supabase/migrations/  schema, mirrored from what's applied
```
- Links: `https://split.ellenial.app/r#<roomId 22 chars>.<secret 43 chars>`. On arrival the secret is saved
  on the phone and the address bar is trimmed to `/r#<roomId>`.
- This phone remembers rooms (`es:rooms`: id, secret, name, which person you are). Never sent anywhere.

## Gillefeeling integration (later)
- `npm i github:phoenixcyberpunk/ellenial-split#<tag>` (package exports `src/split/index.ts`, Vite compiles it).
- Wrap in `<SplitProvider backend={supabase} copy={...}>`, render `<RoomView>` for a plan.
- Room secret: derive from the group key per plan, so no extra link. Needs an extractable or HKDF-capable
  group key in Gillefeeling (check `shared/crypto/groupKey.ts`).
- **Gillefeeling's CSP must add `wss://knvrvmqdxvcatsrvkrgx.supabase.co`** to `connect-src` for live updates.
- Gillefeeling's code rule "crypto only in shared/crypto": the module brings its own `crypto/roomKey.ts`; note it there.

## Testing
- npm works from the workspace now (1 Nov): `npm run build` (tsc + vite) runs locally.
- `tsx src/split/core/core.test.ts` → 9,000+ checks (amount parsing, rounding, balances, settle vs brute force).
- Preview: bundle `src/app/main.tsx` with esbuild, aliasing `@supabase/supabase-js` to an in-memory shim that
  mirrors the SQL rules (shared between tabs via localStorage + BroadcastChannel), serve, click through with
  Playwright at 390×844. Checked 2026-10-29: create, add people, equal + custom splits, live update between two
  tabs, settle + "I've sent it", settled banner + undo, edit, delete expense, remove payback, invite, delete room,
  dark mode. No errors.

## Open
- Real app name; Own hand-made mark/icon (placeholder now).
- Add LICENSE file (AGPL-3.0) via GitHub's template (workspace can't fetch the text verbatim).
- Live test on two real phones once deployed (Realtime "public channels" must be allowed in the project).
- Later: shares UI (weights), PWA install, Swedish copy, back gesture closing sheets, multiple currencies per room.
- Currency default on Create follows the browser (showed USD in the preview); consider SEK/EUR first for Sweden.

## Status
- 2026-10-29: Stack check of Gillefeeling. Decisions above. Schema applied + tested. Module + standalone app
  built; core maths tested; full click-through in preview. Next: push, Vercel project + split.ellenial.app,
  phone test.
- 2026-10-29/31: pushed; live at split.ellenial.app (production); text font briefly Instrument Sans.
- 2026-11-01: Final Ellenial brand applied (palette + Periwinkle, Fraunces + DM Sans, Auto/Light/Dark switch from
  ellenial maps, accessibility rules). Build + 9,233 maths checks pass; preview click-through in light + dark with an
  automated contrast scan of every visible text (0 failures), theme switch saves/restores. Shipped to staging
  (split-staging.ellenial.app) for Ellen to look at. Next: Ellen's review → merge staging to main; real-phone test.
