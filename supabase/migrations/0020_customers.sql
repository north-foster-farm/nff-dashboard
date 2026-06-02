-- 0020_customers.sql
-- Customers + Lists (Batch 24).
--
--   customers             — the directory. Deliberately minimal
--                           (James's call at the field workshop):
--                           name, email, phone, notes. Everything
--                           else can come additively later.
--   customer_lists        — named lists (title + purpose) for
--                           segmentation / mailing groups. The
--                           Batch 32 farm-updates email blast will
--                           target one of these.
--   customer_list_members — membership (list ↔ customer).
--
-- Seeded with James's existing email list (65 contacts) gathered from
-- the egg drop / farmers market, all placed on one "Mailing list".

-- ── customers ────────────────────────────────────────────────────────
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  phone text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A record needs at least something to identify it by.
  check (name is not null or email is not null)
);

-- One record per email address (case-insensitive); customers without
-- an email aren't constrained.
create unique index if not exists customers_email_unique
  on public.customers (lower(email)) where email is not null;
create index if not exists customers_active_idx
  on public.customers (name) where archived_at is null;

create or replace function public.touch_customers_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists customers_touch_updated_at on public.customers;
create trigger customers_touch_updated_at
  before update on public.customers
  for each row execute function public.touch_customers_updated_at();

alter table public.customers enable row level security;

drop policy if exists customers_read on public.customers;
create policy customers_read on public.customers
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists customers_write on public.customers;
create policy customers_write on public.customers
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── customer_lists ───────────────────────────────────────────────────
create table if not exists public.customer_lists (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  purpose text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_customer_lists_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists customer_lists_touch_updated_at
  on public.customer_lists;
create trigger customer_lists_touch_updated_at
  before update on public.customer_lists
  for each row execute function public.touch_customer_lists_updated_at();

alter table public.customer_lists enable row level security;

drop policy if exists customer_lists_read on public.customer_lists;
create policy customer_lists_read on public.customer_lists
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists customer_lists_write on public.customer_lists;
create policy customer_lists_write on public.customer_lists
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── customer_list_members ────────────────────────────────────────────
create table if not exists public.customer_list_members (
  list_id uuid not null
    references public.customer_lists(id) on delete cascade,
  customer_id uuid not null
    references public.customers(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, customer_id)
);

create index if not exists customer_list_members_customer_idx
  on public.customer_list_members (customer_id);

alter table public.customer_list_members enable row level security;

drop policy if exists customer_list_members_read
  on public.customer_list_members;
create policy customer_list_members_read on public.customer_list_members
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists customer_list_members_write
  on public.customer_list_members;
create policy customer_list_members_write on public.customer_list_members
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── Realtime ─────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'customers', 'customer_lists', 'customer_list_members'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute 'alter publication supabase_realtime add table public.' || t;
    end if;
  end loop;
end $$;


-- ── Seed: James's existing email list ────────────────────────────────
-- 65 contacts, all members of one "Mailing list". Entries that came as
-- a bare email address have no name. Skipped entirely on re-run (or if
-- any customers already exist).
do $$
declare
  v_list_id uuid;
begin
  if exists (select 1 from public.customers) then
    return;
  end if;

  insert into public.customer_lists (title, purpose)
  values (
    'Mailing list',
    'Email list for farm updates and announcements — seeded from the '
    || 'egg drop / farmers market contact list.'
  )
  returning id into v_list_id;

  insert into public.customers (name, email)
  select x.name, x.email
  from jsonb_to_recordset($seed$[
    {"name": "Erik D’Ellaposta", "email": "edellaposta@gmail.com"},
    {"name": "Alicia Plouffe", "email": "alicia@plouffe.me"},
    {"name": "Amanda Hauser", "email": "hausera8@gmail.com"},
    {"name": "Amy Harnedy", "email": "alharnedy@gmail.com"},
    {"name": "Angela Anderson", "email": "iam@veryspeedy.net"},
    {"name": "Ann Mary Deangelis", "email": "annmaryd@icloud.com"},
    {"name": "Ann Primiano", "email": "aprimiano62@gmail.com"},
    {"name": "Annmarie West", "email": "westann22@verizon.net"},
    {"name": "Barbara Kelley", "email": "bekelley27@gmail.com"},
    {"name": "Bev Tinnell", "email": "tinnellbev@yahoo.com"},
    {"name": "Bobbie DiScuillo", "email": "bdisc35@gmail.com"},
    {"name": "Brenda Spaziano", "email": "minibee63@aol.com"},
    {"name": "Carol Beaumier", "email": "oreoandcookie@netzero.net"},
    {"name": "Chris Chito", "email": "tiredpw1@gmail.com"},
    {"name": "Christine Iannone", "email": "iown72@aol.com"},
    {"name": "Claudia Stewart", "email": "claudias828@yahoo.com"},
    {"name": "Dawn Soko", "email": "dawnsoko@gmail.com"},
    {"name": "Deborah Corey", "email": "cwebhiedebbie@aol.com"},
    {"name": "Denise Joyal", "email": "robertsjoyal@gmail.com"},
    {"name": "Donna Reedy", "email": "donnareedy@gmx.com"},
    {"name": "Elizabeth Shallcross", "email": "elizshallcross@yahoo.com"},
    {"name": "Emily", "email": "emmzy.j@gmail.com"},
    {"name": "Erin Feeney", "email": "erinfeeney7@gmail.com"},
    {"name": "Francois Karam", "email": "francois.karam88@gmail.com"},
    {"name": "Jane Milano", "email": "milano.jane@gmail.com"},
    {"name": "Jess Apostolou", "email": "jessica.lynn.pagano@gmail.com"},
    {"name": "Jess Gabriele", "email": "jgabriele30@yahoo.com"},
    {"name": "Jessica", "email": "jazam24@gmail.com"},
    {"name": "Jessica Santana", "email": "jessrdhnyc@gmail.com"},
    {"name": "Jim Melfi", "email": "jmel0456@cox.net"},
    {"name": "Joann Perkowski", "email": "jopoplawski@gmail.com"},
    {"name": "Joyce LHeureux", "email": "joycelheureux@icloud.com"},
    {"name": "Kalin", "email": "kalinmck@gmail.com"},
    {"name": "Karla Little", "email": "klittle@finefurnishingsshows.com"},
    {"name": "Kelsey Tortolano", "email": "ktortolano1218@gmail.com"},
    {"name": "Kristin Phillips", "email": "dalmations2375@yahoo.com"},
    {"name": "Laura Zaglio", "email": "lazag51@hotmail.com"},
    {"name": "Laurie Cullen", "email": "knip71665@hotmail.com"},
    {"name": "Lisa Denullane", "email": "kidnurse6969@aol.com"},
    {"name": "Lucia Cueto Kearney", "email": "peashootfarm@gmail.com"},
    {"name": "Lynus Berube", "email": "steelerman316@yahoo.com"},
    {"name": "Maria DiScuillo", "email": "mariadiscuillo@gmail.com"},
    {"name": "Mary Schmidt", "email": "m_schmidt_rn@yahoo.com"},
    {"name": "MaryAnn Power", "email": "mapower@hayessherry.com"},
    {"name": "Mayi", "email": "mayijustino@gmail.com"},
    {"name": "Molly Belliveau", "email": "mbelliveau91@icloud.com"},
    {"name": "Nancy Davis", "email": "nldavis18@yahoo.com"},
    {"name": "Rachel Kutcher", "email": "missrachel_gmschool@yahoo.com"},
    {"name": "Renee Pepler", "email": "rmapepler@gmail.com"},
    {"name": "Ronda Tortolano", "email": "rht881@aol.com"},
    {"name": "Rosemary Huestis", "email": "rhuestis@cox.net"},
    {"name": "Shannon Regine", "email": "stanleyj.shannon@gmail.com"},
    {"name": "Sharron", "email": "blissful2@cox.net"},
    {"name": "Shelly Gaulin", "email": "shellygaulin@gmail.com"},
    {"name": "Stacy Pursche", "email": "spursche@yahoo.com"},
    {"name": "Susan Polouski", "email": "smpolouski@gmail.com"},
    {"name": "Susanne Dillon", "email": "suedillon4546@gmail.com"},
    {"name": "Tamed Brizard", "email": "etbrizard@gmail.com"},
    {"name": "Virginia Champagne", "email": "vmchampagne@gmail.com"},
    {"name": null, "email": "cschneiderrd@gmail.com"},
    {"name": null, "email": "jandrews0414@gmail.com"},
    {"name": null, "email": "reneepepler@gmail.com"},
    {"name": null, "email": "samanthastorres97@gmail.com"},
    {"name": null, "email": "sandiepan@aol.com"},
    {"name": null, "email": "sheri113@gmail.com"}
  ]$seed$::jsonb) as x(name text, email text);

  insert into public.customer_list_members (list_id, customer_id)
  select v_list_id, c.id from public.customers c;
end $$;
