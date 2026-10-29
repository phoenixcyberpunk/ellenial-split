-- Ellenial split: shared cost-splitting rooms.
--
-- Lives in Gillefeeling's Supabase project for now (free plan = 2 projects), fully separate:
-- its own schema, its own functions, no link to auth.users or Gillefeeling's tables.
--
-- Privacy model (same idea as Gillefeeling):
--   * The room key is made on the phone and only travels in the link after '#'. The server never sees it.
--   * Everything people type (room name, nicknames, amounts, what for) is encrypted on the phone.
--     The server stores random IDs, encrypted blobs and timestamps. Nothing else.
--   * Nobody signs in. Holding the link IS the permission: the phone derives an access token from
--     the room key, the server keeps only its SHA-256 and checks it on every call.
--   * The tables are not reachable through the API at all; these public.split_* functions are the
--     only door.
--   * Rooms delete themselves: 7 days after being marked settled, or after 30 days without changes.

create schema if not exists split;
revoke all on schema split from public, anon, authenticated;

create table split.rooms (
  id               uuid primary key,
  token_hash       bytea not null check (length(token_hash) = 32),
  created_at       timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  settled_at       timestamptz
);

-- One row per thing in a room: room settings, a person, an expense, a payment.
-- Which kind it is lives INSIDE the encrypted blob, so the server can't even count people.
create table split.entries (
  room_id    uuid not null references split.rooms(id) on delete cascade,
  id         uuid not null,
  data_enc   text not null check (length(data_enc) between 10 and 6000),
  revision   int  not null default 1,
  updated_at timestamptz not null default now(),
  primary key (room_id, id)
);

-- Rate limit for creating rooms. Salted hashes of addresses, deleted after a day.
create table split.create_attempts (
  ip_hash bytea not null,
  at      timestamptz not null default now()
);
create index on split.create_attempts (at);
create index on split.create_attempts (ip_hash, at);

create table split.settings (
  id   int primary key default 1 check (id = 1),
  salt bytea not null
);
insert into split.settings (salt) values (extensions.gen_random_bytes(32));

alter table split.rooms enable row level security;
alter table split.entries enable row level security;
alter table split.create_attempts enable row level security;
alter table split.settings enable row level security;
revoke all on all tables in schema split from public, anon, authenticated;

-- Limits that keep a free plan free (principle 5) and stop one room from growing forever.
-- Max 1000 entries per room; max 30 new rooms per address per hour, 600 per hour in total.

-- The same error for "no such room" and "wrong token", so nobody can probe for room IDs.
create or replace function split.open_room(p_room uuid, p_token text)
returns split.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  r split.rooms;
begin
  if p_room is null or p_token is null or length(p_token) < 40 or length(p_token) > 64 then
    raise exception 'room_not_found' using errcode = 'P0002';
  end if;
  select * into r from split.rooms
   where id = p_room and token_hash = sha256(convert_to(p_token, 'UTF8'))
   for update;
  if not found then
    raise exception 'room_not_found' using errcode = 'P0002';
  end if;
  return r;
end;
$$;

-- "Something changed" ping to everyone watching the room. No data in it: phones refetch and decrypt.
-- Never lets a Realtime hiccup break a save.
create or replace function split.ping(p_room uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send('{}'::jsonb, 'changed', 'split:' || p_room::text, false);
exception when others then
  null;
end;
$$;

create or replace function public.split_create_room(p_room uuid, p_token text, p_entries jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ip      text;
  v_ip_hash bytea;
  v_salt    bytea;
  e         jsonb;
begin
  if p_room is null or p_token is null or length(p_token) < 40 or length(p_token) > 64 then
    raise exception 'bad_request';
  end if;
  if p_entries is null or jsonb_typeof(p_entries) <> 'array'
     or jsonb_array_length(p_entries) < 1 or jsonb_array_length(p_entries) > 20 then
    raise exception 'bad_request';
  end if;

  -- Cloudflare's address only: the first x-forwarded-for entry can be set by the caller.
  begin
    v_ip := current_setting('request.headers', true)::json ->> 'cf-connecting-ip';
  exception when others then
    v_ip := null;
  end;
  select salt into v_salt from split.settings where id = 1;
  if v_ip is not null then
    v_ip_hash := sha256(v_salt || convert_to(v_ip, 'UTF8'));
    if (select count(*) from split.create_attempts
         where ip_hash = v_ip_hash and at > now() - interval '1 hour') >= 30 then
      raise exception 'rate_limited';
    end if;
  else
    v_ip_hash := sha256(v_salt || convert_to('unknown', 'UTF8'));
  end if;
  if (select count(*) from split.create_attempts where at > now() - interval '1 hour') >= 600 then
    raise exception 'rate_limited';
  end if;
  insert into split.create_attempts (ip_hash) values (v_ip_hash);

  insert into split.rooms (id, token_hash) values (p_room, sha256(convert_to(p_token, 'UTF8')));

  for e in select * from jsonb_array_elements(p_entries) loop
    insert into split.entries (room_id, id, data_enc)
    values (p_room, (e ->> 'id')::uuid, e ->> 'data_enc');
  end loop;
end;
$$;

create or replace function public.split_get_room(p_room uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r split.rooms;
begin
  r := split.open_room(p_room, p_token);
  return jsonb_build_object(
    'settled_at', r.settled_at,
    'last_activity_at', r.last_activity_at,
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'data_enc', e.data_enc, 'revision', e.revision, 'updated_at', e.updated_at)
             order by e.updated_at, e.id)
        from split.entries e where e.room_id = p_room), '[]'::jsonb)
  );
end;
$$;

-- Add or change one entry. p_expected_revision: null = this is new; a number = the revision the
-- phone started editing from (refused with 'edit_conflict' if someone saved in between).
-- Any change reopens a settled room: a new expense means it isn't settled any more.
create or replace function public.split_put_entry(
  p_room uuid, p_token text, p_id uuid, p_data_enc text, p_expected_revision int default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  r     split.rooms;
  v_rev int;
begin
  r := split.open_room(p_room, p_token);
  if p_id is null or p_data_enc is null or length(p_data_enc) < 10 or length(p_data_enc) > 6000 then
    raise exception 'bad_request';
  end if;

  if p_expected_revision is null then
    if (select count(*) from split.entries where room_id = p_room) >= 1000 then
      raise exception 'room_full';
    end if;
    insert into split.entries (room_id, id, data_enc) values (p_room, p_id, p_data_enc)
    on conflict (room_id, id) do nothing;
    if not found then
      raise exception 'edit_conflict';
    end if;
    v_rev := 1;
  else
    update split.entries
       set data_enc = p_data_enc, revision = revision + 1, updated_at = now()
     where room_id = p_room and id = p_id and revision = p_expected_revision
    returning revision into v_rev;
    if not found then
      raise exception 'edit_conflict';
    end if;
  end if;

  update split.rooms set last_activity_at = now(), settled_at = null where id = p_room;
  perform split.ping(p_room);
  return v_rev;
end;
$$;

create or replace function public.split_delete_entry(p_room uuid, p_token text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r split.rooms;
begin
  r := split.open_room(p_room, p_token);
  delete from split.entries where room_id = p_room and id = p_id;
  update split.rooms set last_activity_at = now(), settled_at = null where id = p_room;
  perform split.ping(p_room);
end;
$$;

-- Anyone in the room can mark it settled, and anyone can undo it.
-- Settling starts the 7-day countdown to deletion.
create or replace function public.split_set_settled(p_room uuid, p_token text, p_settled boolean)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  r     split.rooms;
  v_at  timestamptz;
begin
  r := split.open_room(p_room, p_token);
  v_at := case when p_settled then now() else null end;
  update split.rooms set settled_at = v_at, last_activity_at = now() where id = p_room;
  perform split.ping(p_room);
  return v_at;
end;
$$;

-- "Delete this room now", for anyone in it. Gone for everyone, straight away.
create or replace function public.split_delete_room(p_room uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r split.rooms;
begin
  r := split.open_room(p_room, p_token);
  delete from split.rooms where id = p_room;
  perform split.ping(p_room);
end;
$$;

create or replace function split.cleanup()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from split.rooms
   where (settled_at is not null and settled_at < now() - interval '7 days')
      or last_activity_at < now() - interval '30 days';
  delete from split.create_attempts where at < now() - interval '1 day';
$$;

revoke all on all functions in schema split from public, anon, authenticated;
revoke all on function
  public.split_create_room(uuid, text, jsonb),
  public.split_get_room(uuid, text),
  public.split_put_entry(uuid, text, uuid, text, int),
  public.split_delete_entry(uuid, text, uuid),
  public.split_set_settled(uuid, text, boolean),
  public.split_delete_room(uuid, text)
  from public;
grant execute on function
  public.split_create_room(uuid, text, jsonb),
  public.split_get_room(uuid, text),
  public.split_put_entry(uuid, text, uuid, text, int),
  public.split_delete_entry(uuid, text, uuid),
  public.split_set_settled(uuid, text, boolean),
  public.split_delete_room(uuid, text)
  to anon, authenticated;

select cron.schedule('split-cleanup', '41 * * * *', 'select split.cleanup()');
