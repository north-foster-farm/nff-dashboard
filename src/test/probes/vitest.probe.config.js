// The suite's own config (vitest.config.js), setupFiles and all, run
// on one probe at a time by src/test/isolation.test.js. Only what it
// runs changes: the probes are not unit tests and never run on their
// own, so `npm test` never picks them up.
import base from "../../../vitest.config.js";

// NFF_PROBE_ENV_DIR, when set, is a folder holding a fake .env.local,
// so a probe can show a leaked file's keys never reach a test without
// the repo's own .env.local ever being touched. The config reads it
// here, in the main process, before the setup scrubs the environment.
export default {
  ...base,
  envDir: process.env.NFF_PROBE_ENV_DIR ?? base.envDir,
  test: {
    ...base.test,
    include: ["src/test/probes/*.probe.js"],
    coverage: { enabled: false },
  },
};
