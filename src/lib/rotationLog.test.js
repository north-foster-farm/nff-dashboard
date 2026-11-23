// E2 (#68): a secret with no line in docs/rotation-log.md fails the
// check, so no secret silently skips the yearly rotation.
import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  sampleNames,
  envNamesIn,
  hasSecretsTable,
  namesInTrackedCode,
  requiredNames,
  loggedNames,
  missingFromLog,
} from "../../scripts/check-rotation-log.mjs";

const SCRIPT = resolve("scripts/check-rotation-log.mjs");

const SAMPLE = [
  "# comment",
  "VITE_SUPABASE_URL=",
  "SUPABASE_SECRET_KEY=",
  "NEW_SERVICE_TOKEN=",
].join("\n");

const SECRETS_PAGE = [
  "| Name | Kind | Set on |",
  "| --- | --- | --- |",
  "| `PUSH_CALLER_SECRET` | secret | Netlify |",
  "| `VAPID_SUBJECT` | configuration | Netlify |",
  "| `Google OAuth client secret` | secret | Supabase |",
].join("\n");

const LOG = [
  "name | date | environment | reason | who",
  "--- | --- | --- | --- | ---",
  "SUPABASE_SECRET_KEY | 2026-11-11 | production | seed | James",
  "PUSH_CALLER_SECRET | planned | production | planned, not done | James",
].join("\n");

describe("rotation log coverage", () => {
  it("reads the names a sample declares", () => {
    expect(sampleNames(SAMPLE)).toEqual([
      "VITE_SUPABASE_URL",
      "SUPABASE_SECRET_KEY",
      "NEW_SERVICE_TOKEN",
    ]);
  });

  it("requires secret-looking sample names and secret table rows", () => {
    expect(requiredNames(SECRETS_PAGE, SAMPLE)).toEqual([
      "Google OAuth client secret",
      "NEW_SERVICE_TOKEN",
      "PUSH_CALLER_SECRET",
      "SUPABASE_SECRET_KEY",
    ]);
  });

  it("counts dated and planned lines as logged", () => {
    expect(loggedNames(LOG)).toEqual([
      "supabase_secret_key",
      "push_caller_secret",
    ]);
  });

  it("names a secret added to the sample without a rotation line", () => {
    const required = requiredNames(SECRETS_PAGE, SAMPLE);
    expect(missingFromLog(required, LOG)).toEqual([
      "Google OAuth client secret",
      "NEW_SERVICE_TOKEN",
    ]);
  });

  it("finds secret-looking env names in source code", () => {
    const code = "const k = process.env.NEW_API_TOKEN; run(DB_PASSWORD);";
    expect(envNamesIn(code)).toEqual(["NEW_API_TOKEN", "DB_PASSWORD"]);
    expect(envNamesIn("const NAME = 'plain'")).toEqual([]);
  });

  it("in app code counts only names read from env, not storage keys", () => {
    const app = "const c = CACHE_KEY; const k = import.meta.env.VITE_X_KEY;";
    expect(envNamesIn(app, true)).toEqual(["VITE_X_KEY"]);
  });

  it("requires a secret that only the code names", () => {
    const required = requiredNames(SECRETS_PAGE, SAMPLE, ["CODE_ONLY_TOKEN"]);
    expect(missingFromLog(required, LOG)).toContain("CODE_ONLY_TOKEN");
  });

  it("reads a table's Kind column in any case", () => {
    const page = "| Name | Kind |\n| --- | --- |\n| `X_THING` | Secret |";
    expect(requiredNames(page, "")).toEqual(["X_THING"]);
  });

  it("knows a page with no secrets table from one with a table", () => {
    expect(hasSecretsTable(SECRETS_PAGE)).toBe(true);
    expect(hasSecretsTable("| Credential | Type |\n| --- | --- |")).toBe(false);
  });

  it("exits 1 when the secrets page has no table", () => {
    const dir = mkdtempSync(join(tmpdir(), "rotation-"));
    mkdirSync(join(dir, "docs"));
    writeFileSync(join(dir, "docs/secrets.md"), "| Credential | Type |\n");
    const run = spawnSync("node", [SCRIPT], { cwd: dir, encoding: "utf8" });
    expect(run.status, run.stderr).toBe(1);
    expect(run.stderr).toContain("no table");
  });

  it("passes on the repository's own page, sample, code and log", () => {
    const read = (path) => readFileSync(path, "utf8");
    const required = requiredNames(
      read("docs/secrets.md"),
      read(".env.example"),
      namesInTrackedCode(read),
    );
    expect(missingFromLog(required, read("docs/rotation-log.md"))).toEqual([]);
  });
});
