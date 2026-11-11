import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const MIGRATION = readFileSync(
  new URL(
    "../supabase/migrations/0053_orders_from_site.sql",
    import.meta.url,
  ),
  "utf8",
);

// What the site records as payment.via (north-foster-farm
// netlify/functions/lib/checkout.mjs).
const SITE_PAYMENT_VIA = ["square", "venmo"];

// The quoted values of the first `in (...)` list that follows `anchor`.
function allowedValues(anchor) {
  const from = MIGRATION.indexOf(anchor);
  expect(from, `${anchor} is in the migration`).toBeGreaterThan(-1);
  const list = MIGRATION.slice(from).match(/in \(([^)]*)\)/)[1];
  return [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe("migration 0053 accepts the payments the site writes", () => {
  it.each(SITE_PAYMENT_VIA)(
    "lets orders.payment_provider be %s",
    (via) => {
      const allowed = allowedValues("orders_payment_provider_check");
      expect(allowed).toContain(via);
    },
  );

  it.each(SITE_PAYMENT_VIA)(
    "lets order_events.source be %s",
    (via) => {
      const allowed = allowedValues("public.order_events (\n  id uuid");
      expect(allowed).toContain(via);
    },
  );
});
