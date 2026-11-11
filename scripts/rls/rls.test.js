import { describe, expect, it } from "vitest";

import { readMigrations, violations } from "./migrations.mjs";

const MIGRATIONS = new URL("../../supabase/migrations", import.meta.url)
  .pathname;

const GOOD = `
  create table public.notes (id uuid primary key);
  alter table public.notes enable row level security;
  create policy "own notes" on public.notes
    for select to authenticated using (true);
  create or replace function public.touch() returns void
    language sql security definer as $$ select 1 $$;
  revoke execute on function public.touch() from public, anon;
  grant execute on function public.touch() to authenticated;
`;

describe("the migrations keep the anon key out", () => {
  it("leave no table, policy, grant or function open to it", () => {
    expect(violations(readMigrations(MIGRATIONS))).toEqual([]);
  });
});

describe("the check that says so", () => {
  it("passes a table with RLS, a policy for signed-in users and a locked function", () => {
    expect(violations(GOOD)).toEqual([]);
  });

  it("flags a table created without row-level security", () => {
    expect(violations(`${GOOD} create table orders (id int);`)).toEqual([
      "table orders has no row-level security",
    ]);
  });

  it("does not count a table dropped later", () => {
    const sql = `${GOOD} create table gone (id int); drop table if exists gone;`;

    expect(violations(sql)).toEqual([]);
  });

  it("flags a policy with no TO clause, or one for anon or public", () => {
    const none = `${GOOD} create policy "all" on notes for select using (true);`;
    const anon = `${GOOD} create policy "a" on notes for select to anon using (true);`;
    const open = `${GOOD} create policy "p" on notes to authenticated, public using (true);`;

    expect(violations(none)).toEqual(["policy \"all\" on notes is open to public"]);
    expect(violations(anon)).toEqual(["policy \"a\" on notes is open to anon"]);
    expect(violations(open)).toHaveLength(1);
  });

  it("flags a grant to anon on a table or a function", () => {
    expect(violations(`${GOOD} grant select on table notes to anon;`)).toHaveLength(1);
    expect(violations(`${GOOD} grant execute on function touch() to public;`))
      .toHaveLength(1);
  });

  it("flags a security definer function not revoked from anon", () => {
    const sql = `${GOOD} create function public.leak() returns void
      language sql security definer as $$ select 1 $$;
      revoke all on function public.leak() from public;`;

    expect(violations(sql)).toEqual([
      "security definer function leak is not revoked from anon",
    ]);
  });

  it("flags a definer function recreated after its revoke", () => {
    const sql = `${GOOD} drop function public.touch();
      create function public.touch() returns void
        language sql security definer as $$ select 1 $$;`;

    expect(violations(sql)).toEqual([
      "security definer function touch is not revoked from anon",
    ]);
  });

  it("flags default privileges handed to anon", () => {
    const sql = `${GOOD} alter default privileges in schema public
      grant select on tables to anon;`;

    expect(violations(sql).length).toBeGreaterThan(0);
  });
});
