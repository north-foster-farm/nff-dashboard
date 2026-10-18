// What the migrations say about who may touch what. Row-level security
// is the dashboard's only access control: the browser holds the public
// anon key, so a table without it, a policy open to everyone or a
// function anon can call is a hole. These read the SQL as text, in
// file order, and answer the questions the invariants test asks
// (src/lib/rlsInvariants.test.js) and the live check reuses.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const strip = (sql) => sql
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/--[^\n]*/g, " ");

export const readMigrations = (dir) => readdirSync(dir)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => strip(readFileSync(join(dir, name), "utf8")))
  .join("\n;\n");

const NAME = String.raw`(?:public\.)?"?(\w+)"?`;
const lower = (list) => list.split(",").map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const events = (sql, pattern, make) => [...sql.matchAll(pattern)]
  .map((m) => ({ at: m.index, ...make(m) }));

// Tables that exist once every migration has run: created, then dropped
// later in file order.
export const liveTables = (sql) => {
  const made = events(sql, new RegExp(
    String.raw`create\s+table\s+(?:if\s+not\s+exists\s+)?${NAME}`, "gi",
  ), (m) => ({ add: m[1] }));
  const dropped = events(sql, new RegExp(
    String.raw`drop\s+table\s+(?:if\s+exists\s+)?([^;]+);`, "gi",
  ), (m) => ({
    drop: [...m[1].matchAll(/(?:public\.)?"?(\w+)"?/g)].map((x) => x[1])
      .filter((x) => !/^(cascade|restrict)$/i.test(x)),
  }));
  const live = new Set();

  for (const e of [...made, ...dropped].sort((a, b) => a.at - b.at)) {
    if (e.add) live.add(e.add);
    for (const name of e.drop || []) live.delete(name);
  }

  return [...live].sort();
};

export const rlsEnabled = (sql) => new Set(events(sql, new RegExp(
  String.raw`alter\s+table\s+(?:only\s+)?${NAME}`
  + String.raw`\s+enable\s+row\s+level\s+security`,
  "gi",
), (m) => ({ table: m[1] })).map((e) => e.table));

// Each policy: its table and the roles it applies to. No TO clause
// means PUBLIC, which includes anon.
export const policies = (sql) => events(sql, new RegExp(
  String.raw`create\s+policy\s+("[^"]+"|\w+)\s+on\s+${NAME}([^;]*);`, "gi",
), (m) => {
  const to = /\bto\s+([\w\s,]+?)(?=\s+(?:using|with)\b|\s*$)/i.exec(m[3]);

  return { name: m[1], table: m[2], roles: to ? lower(to[1]) : ["public"] };
});

// Grants of table or function privileges: who receives them.
export const grants = (sql) => events(sql, new RegExp(
  String.raw`grant\s+([\w\s,]+?)\s+on\s+`
  + String.raw`(table|function|all\s+tables|all\s+functions)\s+`
  + String.raw`[^;]*?\bto\s+([\w\s,]+?);`,
  "gi",
), (m) => ({ what: m[2].toLowerCase(), roles: lower(m[3]), text: m[0] }));

// `security definer` functions run with their owner's rights, past RLS.
// Each chunk runs from a `create function` to the next create.
export const definerFunctions = (sql) => {
  const starts = events(sql, new RegExp(
    String.raw`create\s+(?:or\s+replace\s+)?function\s+${NAME}\s*\(`, "gi",
  ), (m) => ({ name: m[1] }));
  const found = new Set();

  starts.forEach((s, i) => {
    const next = starts[i + 1] ? starts[i + 1].at : sql.length;

    if (/security\s+definer/i.test(sql.slice(s.at, next))) found.add(s.name);
  });

  return [...found].sort();
};

// The roles each function's EXECUTE was revoked from, in file order.
export const revokes = (sql) => events(sql, new RegExp(
  String.raw`revoke\s+(?:all|execute)(?:\s+privileges)?\s+on\s+function\s+`
  + String.raw`${NAME}\s*\([^)]*\)\s*from\s+([\w\s,]+?);`,
  "gi",
), (m) => ({ name: m[1], roles: lower(m[2]) }));

// Functions dropped and made again lose their grants: the position of
// the last drop, by name.
export const lastDrop = (sql, name) => {
  const drops = events(sql, new RegExp(
    String.raw`drop\s+function\s+(?:if\s+exists\s+)?(?:public\.)?`
    + String.raw`"?${name}"?\s*\(`,
    "gi",
  ), () => ({}));

  return drops.length ? drops[drops.length - 1].at : -1;
};

export const defaultPrivilegesForAnon = (sql) => events(sql, new RegExp(
  String.raw`alter\s+default\s+privileges[^;]*\bto\s+[\w\s,]*\banon\b`, "gi",
), (m) => ({ text: m[0] }));

const OPEN = ["anon", "public"];
const touchesOpen = (roles) => roles.some((r) => OPEN.includes(r));

const tableViolations = (sql) => {
  const enabled = rlsEnabled(sql);

  return liveTables(sql)
    .filter((t) => !enabled.has(t))
    .map((t) => `table ${t} has no row-level security`);
};

const policyViolations = (sql) => policies(sql)
  .filter((p) => touchesOpen(p.roles))
  .map((p) => `policy ${p.name} on ${p.table} is open to ${
    p.roles.join(", ")}`);

const grantViolations = (sql) => grants(sql)
  .filter((g) => touchesOpen(g.roles))
  .map((g) => `a ${g.what} grant reaches anon or public: ${
    g.text.replace(/\s+/g, " ").slice(0, 80)}`);

const functionViolations = (sql) => {
  const all = revokes(sql);

  return definerFunctions(sql).filter((name) => {
    const after = lastDrop(sql, name);

    return !all.some((r) => r.name === name && r.at > after
      && r.roles.includes("anon"));
  }).map((name) => `security definer function ${name} is not revoked `
    + "from anon");
};

// Everything that would let the public anon key reach data it should
// not. An empty list is the invariant.
export const violations = (sql) => [
  ...tableViolations(sql),
  ...policyViolations(sql),
  ...grantViolations(sql),
  ...functionViolations(sql),
  ...defaultPrivilegesForAnon(sql)
    .map((d) => `default privileges reach anon: ${d.text.slice(0, 80)}`),
];
