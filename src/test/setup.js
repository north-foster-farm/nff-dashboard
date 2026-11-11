// Loaded before every test file (vitest.config.js: setupFiles). See
// isolation.js for the two rules.

import { afterAll } from "vitest";

import { blockedHosts, closeNetwork, scrubEnv } from "./isolation.js";

scrubEnv(process.env);
closeNetwork();

afterAll(() => {
  const hosts = blockedHosts();
  if (hosts.length) {
    throw new Error(`Tests reached the network: ${hosts}`);
  }
});
