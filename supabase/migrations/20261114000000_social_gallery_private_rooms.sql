-- ============================================================
--  IronStorm v4 — cross-device social layer
--  Regiments, global map gallery, private-room admission.
--
--  Run this in the Supabase SQL editor for the project used by
--  js/config.js, or apply it with `supabase db push` after linking.
--  Realtime private-room access also requires the channel client to
--  connect with `config: { private: true }` (net.js does this).
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
--  Regiments
-- ------------------------------------------------------------
create table if not exists public.regiments (
  code        text primary key check (code ~ '^[A-Z0-9]{5}$'),
  name        text not null check (name ~ '^[A-Z0-9 _-]{3,24}$'),
  tag         text not null unique check (tag ~ '^[A-Z0-9]{2,5}$'),
  color       text not null default '#8fe86b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  motto       text not null default 'HOLD THE LINE',
  owner       uuid not null references public.profiles(id) on delete cascade,
  owner_name  text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.regiment_members (
  player_id     uuid primary key references public.profiles(id) on delete cascade,
  regiment_code text not null references public.regiments(code) on delete cascade,
  role          text not null default 'SOLDIER' check (role in ('COMMANDER', 'OFFICER', 'SOLDIER')),
  joined_at     timestamptz not null default now()
);

create index if not exists regiment_members_code_idx on public.regiment_members(regiment_code);

alter table public.regiments enable row level security;
alter table public.regiment_members enable row level security;

drop policy if exists "regiments readable" on public.regiments;
create policy "regiments readable" on public.regiments
  for select to anon, authenticated using (true);

drop policy if exists "regiment members readable" on public.regiment_members;
create policy "regiment members readable" on public.regiment_members
  for select to anon, authenticated using (true);

revoke insert, update, delete on public.regiments from anon, authenticated;
revoke insert, update, delete on public.regiment_members from anon, authenticated;
grant select on public.regiments to anon, authenticated;
grant select on public.regiment_members to anon, authenticated;

create or replace function public.create_regiment(
  p_name text,
  p_tag text,
  p_color text default '#8fe86b',
  p_motto text default 'HOLD THE LINE'
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  uname text;
  clean_name text := upper(trim(coalesce(p_name, '')));
  clean_tag text := upper(trim(coalesce(p_tag, '')));
  clean_color text := coalesce(nullif(trim(p_color), ''), '#8fe86b');
  clean_motto text := upper(trim(coalesce(p_motto, 'HOLD THE LINE')));
  new_code text;
  reg public.regiments;
  i integer;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.regiment_members where player_id = uid) then
    raise exception 'already enlisted in a regiment';
  end if;
  if clean_name !~ '^[A-Z0-9 _-]{3,24}$' then raise exception 'invalid regiment name'; end if;
  if clean_tag !~ '^[A-Z0-9]{2,5}$' then raise exception 'invalid regiment tag'; end if;
  if clean_color !~ '^#[0-9a-fA-F]{6}$' then clean_color := '#8fe86b'; end if;
  clean_motto := left(clean_motto, 40);
  select username into uname from public.profiles where id = uid;
  if uname is null then raise exception 'profile not found'; end if;

  for i in 1..20 loop
    new_code := '';
    for j in 1..5 loop
      new_code := new_code || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random() * 32)::int + 1, 1);
    end loop;
    exit when not exists (select 1 from public.regiments where code = new_code);
  end loop;

  begin
    insert into public.regiments (code, name, tag, color, motto, owner, owner_name)
    values (new_code, clean_name, clean_tag, clean_color, clean_motto, uid, uname)
    returning * into reg;
  exception when unique_violation then
    raise exception 'regiment tag already in use';
  end;

  insert into public.regiment_members (player_id, regiment_code, role)
  values (uid, reg.code, 'COMMANDER');

  return jsonb_build_object('regiment', to_jsonb(reg), 'role', 'COMMANDER');
end;
$$;

create or replace function public.join_regiment(p_code text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean_code text := upper(trim(coalesce(p_code, '')));
  reg public.regiments;
  mine public.regiment_members;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into reg from public.regiments where code = clean_code;
  if reg.code is null then raise exception 'regiment not found'; end if;
  select * into mine from public.regiment_members where player_id = uid;
  if mine.player_id is not null then
    if mine.regiment_code = reg.code then
      return jsonb_build_object('regiment', to_jsonb(reg), 'role', mine.role);
    end if;
    raise exception 'leave your current regiment first';
  end if;
  insert into public.regiment_members (player_id, regiment_code, role)
  values (uid, reg.code, 'SOLDIER');
  return jsonb_build_object('regiment', to_jsonb(reg), 'role', 'SOLDIER');
end;
$$;

create or replace function public.update_regiment(
  p_code text,
  p_name text,
  p_tag text,
  p_color text,
  p_motto text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean_code text := upper(trim(coalesce(p_code, '')));
  clean_name text := upper(trim(coalesce(p_name, '')));
  clean_tag text := upper(trim(coalesce(p_tag, '')));
  clean_color text := coalesce(nullif(trim(p_color), ''), '#8fe86b');
  clean_motto text := upper(trim(coalesce(p_motto, 'HOLD THE LINE')));
  reg public.regiments;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into reg from public.regiments where code = clean_code for update;
  if reg.code is null then raise exception 'regiment not found'; end if;
  if reg.owner <> uid then raise exception 'only the founder can edit the regiment'; end if;
  if clean_name !~ '^[A-Z0-9 _-]{3,24}$' then raise exception 'invalid regiment name'; end if;
  if clean_tag !~ '^[A-Z0-9]{2,5}$' then raise exception 'invalid regiment tag'; end if;
  if clean_color !~ '^#[0-9a-fA-F]{6}$' then clean_color := '#8fe86b'; end if;
  update public.regiments
     set name = clean_name, tag = clean_tag, color = clean_color,
         motto = left(clean_motto, 40), updated_at = now()
   where code = clean_code
   returning * into reg;
  return jsonb_build_object('regiment', to_jsonb(reg));
exception when unique_violation then
  raise exception 'regiment tag already in use';
end;
$$;

create or replace function public.leave_regiment()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  mine public.regiment_members;
  reg public.regiments;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into mine from public.regiment_members where player_id = uid;
  if mine.player_id is null then return; end if;
  select * into reg from public.regiments where code = mine.regiment_code;
  if reg.owner = uid then
    delete from public.regiments where code = reg.code;
  else
    delete from public.regiment_members where player_id = uid;
  end if;
end;
$$;

grant execute on function public.create_regiment(text, text, text, text) to authenticated;
grant execute on function public.join_regiment(text) to authenticated;
grant execute on function public.update_regiment(text, text, text, text, text) to authenticated;
grant execute on function public.leave_regiment() to authenticated;

-- ------------------------------------------------------------
--  Global map gallery
-- ------------------------------------------------------------
create table if not exists public.community_maps (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (length(code) between 10 and 4096),
  name        text not null check (length(name) between 3 and 24),
  author      uuid references public.profiles(id) on delete set null,
  author_name text not null default 'COMMANDER',
  votes       integer not null default 0,
  reports     integer not null default 0,
  hidden      boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.map_votes (
  map_id    uuid not null references public.community_maps(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  voted_at  timestamptz not null default now(),
  primary key (map_id, player_id)
);

create table if not exists public.map_reports (
  map_id    uuid not null references public.community_maps(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  reason    text not null default 'broken layout',
  reported_at timestamptz not null default now(),
  primary key (map_id, player_id)
);

create index if not exists community_maps_public_idx
  on public.community_maps(created_at desc) where not hidden;
create index if not exists community_maps_votes_idx
  on public.community_maps(votes desc) where not hidden;

alter table public.community_maps enable row level security;
alter table public.map_votes enable row level security;
alter table public.map_reports enable row level security;

drop policy if exists "community maps readable" on public.community_maps;
create policy "community maps readable" on public.community_maps
  for select to anon, authenticated using (not hidden);

revoke insert, update, delete on public.community_maps from anon, authenticated;
revoke all on public.map_votes from anon, authenticated;
revoke all on public.map_reports from anon, authenticated;
grant select on public.community_maps to anon, authenticated;

create or replace function public.publish_gallery_map(
  p_code text,
  p_name text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  uname text;
  clean_code text := trim(coalesce(p_code, ''));
  clean_name text := upper(trim(coalesce(p_name, 'CUSTOM FIELD')));
  map_row public.community_maps;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if length(clean_code) < 10 or length(clean_code) > 4096 then raise exception 'invalid map code'; end if;
  if length(clean_name) < 3 or length(clean_name) > 24 then raise exception 'invalid map name'; end if;
  if (select count(*) from public.community_maps where author = uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'daily publish limit reached';
  end if;
  select username into uname from public.profiles where id = uid;
  if uname is null then raise exception 'profile not found'; end if;

  begin
    insert into public.community_maps (code, name, author, author_name)
    values (clean_code, clean_name, uid, uname)
    returning * into map_row;
  exception when unique_violation then
    raise exception 'that battlefield is already published';
  end;
  return to_jsonb(map_row);
end;
$$;

create or replace function public.vote_gallery_map(p_id uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  next_votes integer;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.community_maps where id = p_id and not hidden) then
    raise exception 'map not found';
  end if;
  if exists (select 1 from public.map_votes where map_id = p_id and player_id = uid) then
    raise exception 'already voted';
  end if;
  insert into public.map_votes (map_id, player_id) values (p_id, uid);
  update public.community_maps set votes = votes + 1 where id = p_id
  returning votes into next_votes;
  return next_votes;
end;
$$;

create or replace function public.report_gallery_map(p_id uuid, p_reason text default 'broken layout')
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  next_reports integer;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.community_maps where id = p_id and not hidden) then
    raise exception 'map not found';
  end if;
  if exists (select 1 from public.map_reports where map_id = p_id and player_id = uid) then
    raise exception 'already reported';
  end if;
  insert into public.map_reports (map_id, player_id, reason)
  values (p_id, uid, left(coalesce(nullif(trim(p_reason), ''), 'broken layout'), 80));
  update public.community_maps
     set reports = reports + 1,
         hidden = (reports + 1) >= 3
   where id = p_id
   returning reports into next_reports;
  return next_reports >= 3;
end;
$$;

grant execute on function public.publish_gallery_map(text, text) to authenticated;
grant execute on function public.vote_gallery_map(uuid) to authenticated;
grant execute on function public.report_gallery_map(uuid, text) to authenticated;

-- ------------------------------------------------------------
--  Private rooms
--  Passcodes are bcrypt-hashed server-side. The generated channel
--  topic is only returned after a successful RPC admission check.
-- ------------------------------------------------------------
create table if not exists public.private_rooms (
  id            uuid primary key default gen_random_uuid(),
  mode          text not null check (mode in ('deathmatch', 'team', 'koth', 'survival')),
  name          text not null check (name ~ '^[A-Z0-9 _-]{3,16}$'),
  owner         uuid not null references public.profiles(id) on delete cascade,
  passcode_hash text not null,
  channel       text not null unique,
  rules         jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '12 hours',
  unique (mode, name)
);

create table if not exists public.private_room_members (
  room_id   uuid not null references public.private_rooms(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, player_id)
);

alter table public.private_rooms enable row level security;
alter table public.private_room_members enable row level security;

-- Clients never read passcodes or channels directly. Admission is RPC-only.
revoke all on public.private_rooms from anon, authenticated;
revoke all on public.private_room_members from anon, authenticated;

create or replace function public.can_access_private_topic(p_topic text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
      from public.private_rooms r
      join public.private_room_members m on m.room_id = r.id
     where r.channel = p_topic
       and r.expires_at > now()
       and m.player_id = auth.uid()
  );
$$;

grant execute on function public.can_access_private_topic(text) to authenticated;

-- Realtime Authorization: members may receive and publish on their room topic.
drop policy if exists "private room members receive" on realtime.messages;
create policy "private room members receive" on realtime.messages
  for select to authenticated
  using (
    extension in ('broadcast', 'presence')
    and public.can_access_private_topic(realtime.topic())
  );

drop policy if exists "private room members send" on realtime.messages;
create policy "private room members send" on realtime.messages
  for insert to authenticated
  with check (
    extension in ('broadcast', 'presence')
    and public.can_access_private_topic(realtime.topic())
  );

create or replace function public.host_private_room(
  p_mode text,
  p_name text,
  p_passcode text,
  p_rules jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean_mode text := lower(trim(coalesce(p_mode, '')));
  clean_name text := upper(trim(coalesce(p_name, '')));
  clean_pass text := trim(coalesce(p_passcode, ''));
  reg public.private_rooms;
  new_channel text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if clean_mode not in ('deathmatch', 'team', 'koth', 'survival') then raise exception 'invalid warzone'; end if;
  if clean_name !~ '^[A-Z0-9 _-]{3,16}$' then raise exception 'invalid room name'; end if;
  if length(clean_pass) < 4 or length(clean_pass) > 32 then raise exception 'passcode must be 4-32 characters'; end if;

  -- Expire stale fields with the same name.
  delete from public.private_rooms
   where mode = clean_mode and name = clean_name and expires_at <= now();

  select * into reg from public.private_rooms
   where mode = clean_mode and name = clean_name for update;

  if reg.id is not null then
    if reg.owner <> uid then raise exception 'that field name is already in use'; end if;
    update public.private_rooms
       set passcode_hash = crypt(clean_pass, gen_salt('bf')),
           rules = coalesce(p_rules, '{}'::jsonb),
           expires_at = now() + interval '12 hours'
     where id = reg.id
     returning * into reg;
    delete from public.private_room_members
     where room_id = reg.id and player_id <> uid;
  else
    new_channel := 'ironstorm-private-' || encode(gen_random_bytes(18), 'hex');
    insert into public.private_rooms (mode, name, owner, passcode_hash, channel, rules)
    values (clean_mode, clean_name, uid, crypt(clean_pass, gen_salt('bf')), new_channel, coalesce(p_rules, '{}'::jsonb))
    returning * into reg;
  end if;

  insert into public.private_room_members (room_id, player_id)
  values (reg.id, uid) on conflict do nothing;

  return jsonb_build_object('id', reg.id, 'channel', reg.channel, 'name', reg.name, 'mode', reg.mode, 'expires_at', reg.expires_at);
end;
$$;

create or replace function public.join_private_room(
  p_mode text,
  p_name text,
  p_passcode text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean_mode text := lower(trim(coalesce(p_mode, '')));
  clean_name text := upper(trim(coalesce(p_name, '')));
  clean_pass text := trim(coalesce(p_passcode, ''));
  reg public.private_rooms;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if length(clean_pass) = 0 then raise exception 'passcode required'; end if;
  select * into reg from public.private_rooms
   where mode = clean_mode and name = clean_name and expires_at > now();
  if reg.id is null then raise exception 'private field not found or expired'; end if;
  if reg.passcode_hash <> crypt(clean_pass, reg.passcode_hash) then
    raise exception 'wrong passcode';
  end if;
  insert into public.private_room_members (room_id, player_id)
  values (reg.id, uid) on conflict do nothing;
  return jsonb_build_object('id', reg.id, 'channel', reg.channel, 'name', reg.name, 'mode', reg.mode);
end;
$$;

create or replace function public.leave_private_room(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from public.private_room_members
   where room_id = p_id and player_id = auth.uid();
end;
$$;

grant execute on function public.host_private_room(text, text, text, jsonb) to authenticated;
grant execute on function public.join_private_room(text, text, text) to authenticated;
grant execute on function public.leave_private_room(uuid) to authenticated;

comment on function public.can_access_private_topic(text) is
  'Realtime Authorization helper for IronStorm private room channels.';
comment on table public.private_rooms is
  'Private arena fields. Channels and passcodes are never exposed through table SELECT.';
