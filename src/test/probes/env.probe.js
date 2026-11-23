// Run by src/test/isolation.test.js in a vitest of its own, started
// with the first three PLANTED_NAMES set to "planted" in its
// environment and the last in a fake .env.local, as a leak would set
// them. Under the suite's setup every one reads as undefined, through
// process.env and through import.meta.env.
import { expect, it } from "vitest";

const PLANTED_NAMES = [
  "NFF_ISOLATION_PROBE",
  "SUPABASE_SECRET_KEY",
  "VITE_ISOLATION_PROBE",
  "VITE_ENV_FILE_PROBE",
];

it("reads every planted variable as undefined", () => {
  const seen = Object.fromEntries(PLANTED_NAMES.map((name) => [
    name,
    { processEnv: process.env[name], importMetaEnv: import.meta.env[name] },
  ]));
  const nothing = Object.fromEntries(PLANTED_NAMES.map((name) => [
    name,
    { processEnv: undefined, importMetaEnv: undefined },
  ]));

  expect(seen).toEqual(nothing);
});
