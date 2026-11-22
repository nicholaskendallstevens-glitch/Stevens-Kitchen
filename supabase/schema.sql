-- Stevens Kitchen — database schema
-- Run once in Supabase → SQL Editor → New query → paste → Run.
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE where possible.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Recipes
-- ingredients: jsonb array of
--   { id, raw, qty (number|null), unit (string|null), name, note, category, group }
-- steps: jsonb array of strings
-- ---------------------------------------------------------------------------
create table if not exists public.recipes (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  image_url     text,
  source_url    text,
  servings      int  not null default 4,
  prep_minutes  int,
  cook_minutes  int,
  total_minutes int,
  ingredients   jsonb not null default '[]'::jsonb,
  steps         jsonb not null default '[]'::jsonb,
  tags          text[] not null default '{}',
  notes         text,
  favorite      boolean not null default false,
  rating        int check (rating between 0 and 5),
  created_by    uuid references auth.users(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists recipes_title_idx on public.recipes using gin (to_tsvector('simple', title));
create index if not exists recipes_tags_idx on public.recipes using gin (tags);

-- ---------------------------------------------------------------------------
-- Meal plan: one row per planned meal
-- ---------------------------------------------------------------------------
create table if not exists public.meal_plan (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  meal        text not null default 'dinner' check (meal in ('breakfast','lunch','dinner')),
  recipe_id   uuid references public.recipes(id) on delete cascade,
  title       text,                       -- free text when no recipe ("Leftovers", "Eating out")
  servings    int not null default 4,
  cooked      boolean not null default false,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists meal_plan_date_idx on public.meal_plan (date);
create index if not exists meal_plan_recipe_idx on public.meal_plan (recipe_id);

-- ---------------------------------------------------------------------------
-- Shopping list: one list per week (week_start = Monday)
-- ---------------------------------------------------------------------------
create table if not exists public.shopping_items (
  id          uuid primary key default gen_random_uuid(),
  week_start  date not null,
  key         text,                       -- aggregation key for generated items
  name        text not null,
  qty         numeric,
  unit        text,
  amount_text text,                       -- pre-formatted Swiss amount, e.g. "2.5 dl"
  category    text not null default 'other',
  checked     boolean not null default false,
  manual      boolean not null default false,
  staple      boolean not null default false,
  sources     text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists shopping_items_week_idx on public.shopping_items (week_start);

-- ---------------------------------------------------------------------------
-- Pantry staples: things you always have (shown collapsed, not hidden)
-- ---------------------------------------------------------------------------
create table if not exists public.pantry_staples (
  id    uuid primary key default gen_random_uuid(),
  name  text not null unique
);

-- Learned categories: when you move an item to another aisle, it is remembered
create table if not exists public.category_overrides (
  name_key  text primary key,
  category  text not null
);

-- Household settings (single row, id = 1)
create table if not exists public.settings (
  id               int primary key default 1 check (id = 1),
  default_store    text not null default 'migros',
  default_servings int  not null default 4,
  store_orders     jsonb not null default '{}'::jsonb,
  updated_at       timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

insert into public.pantry_staples (name) values
  ('salt'), ('pepper'), ('salz'), ('pfeffer'), ('olive oil'), ('olivenöl'),
  ('oil'), ('öl'), ('water'), ('wasser'), ('sugar'), ('zucker')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists recipes_touch on public.recipes;
create trigger recipes_touch before update on public.recipes
  for each row execute function public.touch_updated_at();
drop trigger if exists shopping_touch on public.shopping_items;
create trigger shopping_touch before update on public.shopping_items
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security: any signed-in user of this project = household member.
-- Sign-ups are disabled in Supabase Auth, so only the accounts you create exist.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['recipes','meal_plan','shopping_items','pantry_staples','category_overrides','settings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists household_all on public.%I', t);
    execute format('create policy household_all on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Newer Supabase projects don't auto-grant table access to API roles
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: live sync of the shopping list and plan between both phones
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.shopping_items;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.meal_plan;
  exception when duplicate_object then null;
  end;
end $$;
alter table public.shopping_items replica identity full;

-- ---------------------------------------------------------------------------
-- Storage bucket for your own recipe photos
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

drop policy if exists "household upload" on storage.objects;
create policy "household upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'recipe-images');
drop policy if exists "household update" on storage.objects;
create policy "household update" on storage.objects
  for update to authenticated using (bucket_id = 'recipe-images');
drop policy if exists "household delete" on storage.objects;
create policy "household delete" on storage.objects
  for delete to authenticated using (bucket_id = 'recipe-images');

-- Keep-alive helper: the free tier pauses after 7 days without activity.
-- The Vercel cron (/api/keepalive, daily) calls this.
create or replace function public.keepalive() returns int
language sql security definer as $$ select 1 $$;
grant execute on function public.keepalive() to anon;
