// Run by src/test/isolation.test.js in a vitest of its own. It opens
// sockets to a host that is not this machine and swallows every error,
// as careless code would. Its one test passes on its own terms; the
// suite's setup must fail the file anyway.
import net from "node:net";

import { it } from "vitest";

const REAL_SERVICE = "supabase.example.test";

it("opens a socket and hides the error", async () => {
  await fetch(`https://${REAL_SERVICE}/rest/v1/`).catch(() => {});
  try {
    net.connect({ host: REAL_SERVICE, port: 443 }).on("error", () => {});
  } catch {
    // Hidden on purpose.
  }
});
