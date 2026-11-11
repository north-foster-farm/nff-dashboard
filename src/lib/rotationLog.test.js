// E2 (#68): a secret with no line in docs/rotation-log.md fails the
// check, so no secret silently skips the yearly rotation.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  sampleNames,
  requiredNames,
  loggedNames,
  missingFromLog,
} from "../../scripts/check-rotation-log.mjs";

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

  it("passes on the repository's own page, sample and log", () => {
    const read = (path) => readFileSync(path, "utf8");
    const required = requiredNames(
      read("docs/secrets.md"),
      read(".env.example"),
    );
    expect(missingFromLog(required, read("docs/rotation-log.md"))).toEqual([]);
  });
});
