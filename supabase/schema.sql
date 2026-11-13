-- ============================================================
--  IronStorm — database schema
--  Run against the Supabase project (Postgres 17)
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
--  Tank catalog (server-side pricing authority)
-- ------------------------------------------------------------
create table if not exists public.tanks (
  id          text primary key,
  name        text not null,
  price       integer not null default 0,
  unlock_level integer not null default 1
);
alter table public.tanks enable row level security;
drop policy if exists "tanks readable" on public.tanks;
create policy "tanks readable" on public.tanks for select using (true);

insert into public.tanks (id, name, price, unlock_level) values
  ('sherman',    'M4 SHERMAN',     0,     1),
  ('crusader',   'CRUSADER',       900,   1),
  ('churchill',  'CHURCHILL VII',  1400,  2),
  ('t34',        'T-34/85',        1800,  3),
  ('pershing',   'M26 PERSHING',   2600,  4),
  ('panther',    'PANTHER',        3000,  5),
  ('is2',        'IS-2',           4200,  6),
  ('tiger',      'TIGER I',        5200,  8),
  ('leopard',    'LEOPARD 1',      5600,  9),
  ('jagdpanther','JAGDPANTHER',    7200,  10),
  ('maus',       'MAUS',           9000,  12),
  ('kv2',        'KV-2',           11000, 13)
on conflict (id) do update
  set name = excluded.name, price = excluded.price, unlock_level = excluded.unlock_level;

-- ------------------------------------------------------------
--  Player profiles
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null unique,
  credits      integer not null default 500,
  level        integer not null default 1,
  xp           integer not null default 0,
  tank_id      text not null default 'sherman',
  owned_tanks  text[] not null default array['sherman'],
  upgrades     jsonb not null default '{"engine":0,"armor":0,"firepower":0,"reload":0,"tracks":0}'::jsonb,
  kills        integer not null default 0,
  deaths       integer not null default 0,
  matches      integer not null default 0,
  wins         integer not null default 0,
  best_score   integer not null default 0,
  created_at   timestamptz not null default now(),
  last_seen    timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select using (true);

-- No direct writes from clients: every mutation goes through the RPCs below.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update (last_seen) on public.profiles to authenticated;

-- ------------------------------------------------------------
--  Match history
-- ------------------------------------------------------------
create table if not exists public.match_history (
  id        bigserial primary key,
  player_id uuid not null references public.profiles(id) on delete cascade,
  kills     integer not null,
  deaths    integer not null,
  score     integer not null,
  won       boolean not null,
  credits   integer not null,
  xp        integer not null,
  played_at timestamptz not null default now()
);
alter table public.match_history enable row level security;
drop policy if exists "history readable own" on public.match_history;
create policy "history readable own" on public.match_history
  for select using (auth.uid() = player_id);
revoke insert, update, delete on public.match_history from anon, authenticated;
grant select on public.match_history to authenticated;

-- ------------------------------------------------------------
--  New user -> profile
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text;
begin
  uname := trim(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  if uname = '' or uname is null then
    uname := 'commander_' || substr(new.id::text, 1, 6);
  end if;
  insert into public.profiles (id, username) values (new.id, uname)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
--  Helper: level curve (100 xp for level 2, ~ +40% per level)
-- ------------------------------------------------------------
create or replace function public.level_for_xp(p_xp integer)
returns integer language sql immutable as $$
  select greatest(1, floor(sqrt(greatest(p_xp, 0) / 100.0))::int + 1);
$$;

-- ------------------------------------------------------------
--  RPC: equip a tank the player already owns
-- ------------------------------------------------------------
create or replace function public.equip_tank(p_tank text)
returns public.profiles
language plpgsql security definer set search_path = public
as $$
declare
  me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid() for update;
  if me.id is null then raise exception 'not authenticated'; end if;
  if not (p_tank = any(me.owned_tanks)) then raise exception 'tank not owned'; end if;
  update public.profiles set tank_id = p_tank where id = me.id returning * into me;
  return me;
end;
$$;

-- ------------------------------------------------------------
--  RPC: buy a tank
-- ------------------------------------------------------------
create or replace function public.buy_tank(p_tank text)
returns public.profiles
language plpgsql security definer set search_path = public
as $$
declare
  me public.profiles;
  t public.tanks;
begin
  select * into me from public.profiles where id = auth.uid() for update;
  if me.id is null then raise exception 'not authenticated'; end if;
  select * into t from public.tanks where id = p_tank;
  if t.id is null then raise exception 'unknown tank'; end if;
  if p_tank = any(me.owned_tanks) then raise exception 'already owned'; end if;
  if me.level < t.unlock_level then raise exception 'requires level %', t.unlock_level; end if;
  if me.credits < t.price then raise exception 'not enough credits'; end if;

  update public.profiles
     set credits = credits - t.price,
         owned_tanks = array_append(owned_tanks, p_tank),
         tank_id = p_tank
   where id = me.id
   returning * into me;
  return me;
end;
$$;

-- ------------------------------------------------------------
--  RPC: buy one upgrade level
-- ------------------------------------------------------------
create or replace function public.upgrade_cost(p_level integer)
returns integer language sql immutable as $$
  select round(160 * power(greatest(p_level, 1), 1.4))::int;
$$;

create or replace function public.buy_upgrade(p_key text)
returns public.profiles
language plpgsql security definer set search_path = public
as $$
declare
  me public.profiles;
  cur integer;
  cost integer;
begin
  if p_key not in ('engine','armor','firepower','reload','tracks') then
    raise exception 'unknown upgrade';
  end if;

  select * into me from public.profiles where id = auth.uid() for update;
  if me.id is null then raise exception 'not authenticated'; end if;

  cur  := coalesce((me.upgrades->>p_key)::int, 0);
  if cur >= 5 then raise exception 'max level'; end if;
  cost := public.upgrade_cost(cur + 1);
  if me.credits < cost then raise exception 'not enough credits'; end if;

  update public.profiles
     set credits = credits - cost,
         upgrades = jsonb_set(upgrades, array[p_key], to_jsonb(cur + 1), true)
   where id = me.id
   returning * into me;
  return me;
end;
$$;

-- ------------------------------------------------------------
--  RPC: record a finished match (server decides rewards)
-- ------------------------------------------------------------
create or replace function public.record_match(
  p_kills  integer,
  p_deaths integer,
  p_score  integer,
  p_won    boolean
)
returns public.profiles
language plpgsql security definer set search_path = public
as $$
declare
  me public.profiles;
  k integer; d integer; s integer;
  gain_credits integer;
  gain_xp integer;
begin
  select * into me from public.profiles where id = auth.uid() for update;
  if me.id is null then raise exception 'not authenticated'; end if;

  -- clamp everything the client sends
  k := least(greatest(coalesce(p_kills, 0), 0), 60);
  d := least(greatest(coalesce(p_deaths, 0), 0), 60);
  s := least(greatest(coalesce(p_score, 0), 0), 50000);

  gain_credits := 30 + k * 14 + (case when p_won then 180 else 0 end) + (s / 25);
  gain_xp      := 40 + k * 22 + (case when p_won then 120 else 0 end) + (s / 60);

  update public.profiles
     set credits    = credits + gain_credits,
         xp         = xp + gain_xp,
         kills      = kills + k,
         deaths     = deaths + d,
         matches    = matches + 1,
         wins       = wins + (case when p_won then 1 else 0 end),
         best_score = greatest(best_score, s),
         level      = public.level_for_xp(xp + gain_xp),
         last_seen  = now()
   where id = me.id
   returning * into me;

  insert into public.match_history (player_id, kills, deaths, score, won, credits, xp)
  values (me.id, k, d, s, coalesce(p_won, false), gain_credits, gain_xp);

  return me;
end;
$$;

-- ------------------------------------------------------------
--  RPC: touch presence timestamp
-- ------------------------------------------------------------
create or replace function public.touch_player()
returns void language sql security definer set search_path = public as $$
  update public.profiles set last_seen = now() where id = auth.uid();
$$;

-- ------------------------------------------------------------
--  Leaderboard view (public read)
-- ------------------------------------------------------------
create or replace view public.leaderboard
with (security_invoker = true) as
select
  p.id,
  p.username,
  p.level,
  p.kills,
  p.deaths,
  p.matches,
  p.wins,
  p.best_score,
  round(case when p.deaths = 0 then p.kills::numeric else p.kills::numeric / p.deaths end, 2) as kd
from public.profiles p
where p.matches > 0;

grant select on public.leaderboard to anon, authenticated;
grant execute on function public.equip_tank(text) to authenticated;
grant execute on function public.buy_tank(text) to authenticated;
grant execute on function public.buy_upgrade(text) to authenticated;
grant execute on function public.record_match(integer, integer, integer, boolean) to authenticated;
grant execute on function public.touch_player() to authenticated;
grant execute on function public.level_for_xp(integer) to anon, authenticated;
grant execute on function public.upgrade_cost(integer) to anon, authenticated;

-- ------------------------------------------------------------
--  v2: camouflage, expanded roster, daily supply crate
-- ------------------------------------------------------------
alter table public.profiles add column if not exists skin text not null default 'olive';
alter table public.profiles add column if not exists owned_skins text[] not null default array['olive'];
alter table public.profiles add column if not exists last_daily timestamptz;

create table if not exists public.skins (
  id           text primary key,
  name         text not null,
  price        integer not null default 0,
  unlock_level integer not null default 1,
  rarity       text not null default 'STANDARD'
);
alter table public.skins enable row level security;
drop policy if exists "skins readable" on public.skins;
create policy "skins readable" on public.skins for select using (true);

insert into public.skins (id, name, price, unlock_level, rarity) values
  ('olive',   'FIELD OLIVE',    0,    1,  'STANDARD'),
  ('desert',  'DESERT RAT',     600,  1,  'STANDARD'),
  ('winter',  'WINTER WHITE',   1200, 3,  'STANDARD'),
  ('night',   'NIGHT OPS',      1800, 5,  'RARE'),
  ('crimson', 'CRIMSON GUARD',  2600, 7,  'RARE'),
  ('toxic',   'TOXIC',          3200, 9,  'RARE'),
  ('chrome',  'CHROME',         4600, 11, 'ELITE'),
  ('gold',    'GILDED',         6400, 14, 'ELITE')
on conflict (id) do update
  set name = excluded.name, price = excluded.price,
      unlock_level = excluded.unlock_level, rarity = excluded.rarity;

create or replace function public.equip_skin(p_skin text)
returns public.profiles
language plpgsql security definer set search_path = public
as $$
declare
  me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid() for update;
  if me.id is null then raise exception 'not authenticated'; end if;
  if not (p_skin = any(me.owned_skins)) then raise exception 'camo not owned'; end if;
  update public.profiles set skin = p_skin where id = me.id returning * into me;
  return me;
end;
$$;

create or replace function public.buy_skin(p_skin text)
returns public.profiles
language plpgsql security definer set search_path = public
as $$
declare
  me public.profiles;
  s public.skins;
begin
  select * into me from public.profiles where id = auth.uid() for update;
  if me.id is null then raise exception 'not authenticated'; end if;
  select * into s from public.skins where id = p_skin;
  if s.id is null then raise exception 'unknown camo'; end if;
  if p_skin = any(me.owned_skins) then raise exception 'already owned'; end if;
  if me.level < s.unlock_level then raise exception 'requires level %', s.unlock_level; end if;
  if me.credits < s.price then raise exception 'not enough credits'; end if;

  update public.profiles
     set credits = credits - s.price,
         owned_skins = array_append(owned_skins, p_skin),
         skin = p_skin
   where id = me.id
   returning * into me;
  return me;
end;
$$;

create or replace function public.claim_daily()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  me public.profiles;
  reward integer;
begin
  select * into me from public.profiles where id = auth.uid() for update;
  if me.id is null then raise exception 'not authenticated'; end if;
  if me.last_daily is not null and me.last_daily > now() - interval '20 hours' then
    raise exception 'crate already opened';
  end if;
  reward := 120 + floor(random() * 141)::int;
  update public.profiles
     set credits = credits + reward, last_daily = now()
   where id = me.id
   returning * into me;
  return jsonb_build_object('reward', reward, 'profile', to_jsonb(me));
end;
$$;

grant select on public.skins to anon, authenticated;
grant execute on function public.equip_skin(text) to authenticated;
grant execute on function public.buy_skin(text) to authenticated;
grant execute on function public.claim_daily() to authenticated;
