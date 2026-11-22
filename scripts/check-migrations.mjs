#!/usr/bin/env node
// check-migrations.mjs — migration discipline (D4, #63). Production
// applies what `main` deploys, so a migration on origin/main is
// applied, and the schema is additive-only (CLAUDE.md, "Data safety").
// Fails when the commit checked (HEAD, or the one named) edits,
// deletes or renames a migration applied when it branched from
// origin/main, or gives a new one a number already in use.
//
//   node scripts/check-migrations.mjs [commit]
//
// Run by `npm run check` (so by CI) and by .githooks/pre-push for each
// commit pushed. It only reads git; it needs origin/main fetched.
import { execFileSync } from "node:child_process";

const MIGRATIONS = "supabase/migrations";
const MAIN = "origin/main";

function git(...args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

// Every migration in `rev`, as file name -> blob id.
function migrationsAt(rev) {
  const listing = git("ls-tree", rev, `${MIGRATIONS}/`);
  const entries = listing.split("\n").filter(Boolean).map((line) => {
    const [meta, path] = line.split("\t");
    return [path.slice(MIGRATIONS.length + 1), meta.split(" ")[2]];
  });
  return new Map(entries);
}

function changedApplied(applied, checked) {
  const problems = [];
  for (const [name, blob] of applied) {
    if (!checked.has(name)) {
      problems.push(`${name} is applied; it was deleted or renamed`);
    } else if (checked.get(name) !== blob) {
      problems.push(`${name} is applied; it was edited`);
    }
  }
  return problems;
}

function reusedNumbers(...trees) {
  const namesByNumber = new Map();
  for (const name of trees.flatMap((tree) => [...tree.keys()])) {
    const number = /^(\d+)_/.exec(name)?.[1];
    if (number === undefined) continue;
    const names = namesByNumber.get(number) ?? new Set();
    namesByNumber.set(number, names.add(name));
  }
  return [...namesByNumber]
    .filter(([, names]) => names.size > 1)
    .map(([number, names]) =>
      `number ${number} is used by ${[...names].sort().join(" and ")}`);
}

function main(rev) {
  const base = git("merge-base", rev, MAIN);
  const checked = migrationsAt(rev);
  return [
    ...changedApplied(migrationsAt(base), checked),
    ...reusedNumbers(checked, migrationsAt(MAIN)),
  ];
}

function run() {
  const rev = process.argv[2] ?? "HEAD";
  let problems;
  try {
    problems = main(rev);
  } catch (error) {
    console.error(`check-migrations: cannot compare ${rev} with ${MAIN}` +
      ` (fetch it first): ${error.stderr ?? error.message}`.trim());
    process.exit(1);
  }
  if (problems.length > 0) {
    console.error("check-migrations: migrations are additive-only; add a" +
      " new migration with the next number instead:");
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  console.log("check-migrations: clean.");
}

run();
