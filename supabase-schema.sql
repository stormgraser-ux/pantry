-- Pantry App — Supabase Schema
-- Paste this entire file into the Supabase SQL editor and run it.

create table sections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null,
  created_at timestamptz default now()
);

create table items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  section_id uuid references sections(id) on delete set null,
  in_stock boolean not null default true,
  notes text,
  created_at timestamptz default now()
);

create index on items(section_id);
create index on items(in_stock);

create table grocery_list (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references items(id) on delete cascade,
  ad_hoc_name text,
  section_id uuid references sections(id) on delete set null,
  checked boolean not null default false,
  added_at timestamptz default now(),
  constraint grocery_list_has_name check (item_id is not null or ad_hoc_name is not null)
);

create index on grocery_list(checked);
create index on grocery_list(section_id);

create table recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text,
  created_at timestamptz default now()
);

create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  item_id uuid references items(id) on delete set null,
  free_text text,
  quantity text,
  constraint ingredient_has_name check (item_id is not null or free_text is not null)
);

create index on recipe_ingredients(recipe_id);

create table meal_plan (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  week_start date not null,
  day_of_week smallint,
  created_at timestamptz default now()
);

create index on meal_plan(week_start);

-- Row Level Security
alter table sections enable row level security;
alter table items enable row level security;
alter table grocery_list enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table meal_plan enable row level security;

create policy "anon full access" on sections for all to anon using (true) with check (true);
create policy "anon full access" on items for all to anon using (true) with check (true);
create policy "anon full access" on grocery_list for all to anon using (true) with check (true);
create policy "anon full access" on recipes for all to anon using (true) with check (true);
create policy "anon full access" on recipe_ingredients for all to anon using (true) with check (true);
create policy "anon full access" on meal_plan for all to anon using (true) with check (true);

-- Seed WinCo sections
insert into sections (name, sort_order) values
  ('Produce', 1),
  ('Aisle 1', 2), ('Aisle 2', 3), ('Aisle 3', 4), ('Aisle 4', 5),
  ('Aisle 5', 6), ('Aisle 6', 7), ('Aisle 7', 8), ('Aisle 8', 9),
  ('Aisle 9', 10), ('Aisle 10', 11),
  ('Meat & Cheese', 12),
  ('Dairy', 13),
  ('Aisle 20', 14), ('Aisle 19', 15), ('Aisle 18', 16), ('Aisle 17', 17),
  ('Aisle 16', 18), ('Aisle 15', 19), ('Aisle 14', 20), ('Aisle 13', 21),
  ('Aisle 12', 22), ('Aisle 11', 23),
  ('Drinks', 24),
  ('Bulk Bins', 25),
  ('Unsorted', 99);
