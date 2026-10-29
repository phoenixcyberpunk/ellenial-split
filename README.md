# Split, by Ellenial

Split shared costs with friends: who paid what, and the fewest transfers to settle up.
No sign-up, no ads, no tracking. Everything you type is encrypted on your phone before it's sent,
and rooms tidy themselves away once you're done.

I'm building it as a free little app for everyday ease, and as a module my friend-planning app
Gillefeeling can reuse.

## How private is it?
- The room's key is the part of the link after `#`. Browsers never send that part to the server.
- The server only stores random IDs, encrypted data and timestamps.
- Rooms delete themselves 7 days after being settled, or after 30 days without changes.
- Honest limit: everyone in a room can see the list of expenses, so they could work out each other's
  balances. The app only shows you your own.

## Structure
- `src/split/` the reusable module (maths, encryption, screens). The host app passes in its Supabase client.
- `src/app/` the standalone app around it.
- `supabase/migrations/` the database functions (the only way in; tables aren't exposed).

## Run locally
```
npm install
npm run dev
npm test        # the money and settle-up maths
```

## Licence
AGPL-3.0. An Ellenial app, made by one person with Claude helping on the code.
