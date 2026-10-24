-- SPEC 06: games, profiles, scores, game_stats, trigger de perfil y RLS

create table public.games (
  id          text primary key,
  title       text not null,
  short       text not null,
  long        text not null,
  category    text not null check (category in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover       text not null,
  color       text not null check (color in ('cyan','magenta','yellow','green')),
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique check (username ~ '^[A-Za-z0-9_]{3,10}$'),
  created_at  timestamptz not null default now()
);

-- username único sin distinguir mayúsculas
create unique index profiles_username_lower_idx on public.profiles (lower(username));

create table public.scores (
  id           uuid primary key default gen_random_uuid(),
  game_id      text not null references public.games(id) on delete cascade,
  user_id      uuid references public.profiles(id) on delete set null,
  player_name  text not null,
  score        int  not null check (score >= 0),
  created_at   timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc);
create index scores_user_game_idx  on public.scores (user_id, game_id);

create view public.game_stats with (security_invoker = true) as
select g.id as game_id,
       coalesce(max(s.score), 0) as best,
       count(s.id)               as plays
from public.games g left join public.scores s on s.game_id = g.id
group by g.id;

-- Trigger: crea el perfil al registrarse un usuario
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.games    enable row level security;
alter table public.profiles enable row level security;
alter table public.scores   enable row level security;

create policy "games_select" on public.games
  for select to anon, authenticated using (true);

create policy "profiles_select" on public.profiles
  for select to anon, authenticated using (true);

create policy "scores_select" on public.scores
  for select to anon, authenticated using (true);

create policy "scores_insert_own" on public.scores
  for insert to authenticated with check (user_id = (select auth.uid()));
