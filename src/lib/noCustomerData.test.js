// C1 (#55): the repository is public, so tracked files must hold no
// real personal contact data. Fixtures use placeholder addresses on
// reserved domains (example.com and friends). This test fails on an
// email address, phone number or street address anywhere else, and
// reports only the file, line and kind of match, never the match.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const EMAIL =
  /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g;
const PHONE =
  /(?<![\d.])(?:\+?1[-. ])?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}(?![\d.])/;
const STREET_SUFFIX = "St|Street|Rd|Road|Ave|Avenue|Ln|Lane|Dr|Drive|Way";
const STREET = new RegExp(
  "\\b\\d{1,5} (?:[A-Z][a-z]+ ){1,3}(?:" + STREET_SUFFIX + ")\\b",
);

const PLACEHOLDER_DOMAINS = /^(example\.(com|org|net)|[^.]+\.test|localhost)$/;

// Files allowed to hold contact data, each with the reason.
const ALLOWLIST = {
  // The admin login allowlist: the owner's own work address, not a
  // customer's. The table is the app's access control.
  "supabase/migrations/0001_auth_admins.sql": ["email"],
  // Vendor documentation copied for reference (vendor support lines).
  "docs/research/yosmart_docs.md": ["email", "phone", "street"],
  // This file: the samples that prove the detector works.
  "src/lib/noCustomerData.test.js": ["email", "phone", "street"],
  // Farm event venues: public business locations, not customers.
  "docs/ecommerce/markets-and-popups-2026.md": ["street"],
  "src/data/nff-data.json": ["street"],
  "supabase/migrations/0005_events_products_inventory.sql": ["street"],
  "supabase/migrations/0006_threads_orders_updates_projects.sql": [
    "street",
  ],
  // Placeholder contact details the doc itself calls placeholders.
  "docs/ecommerce/google-business-profile-description.md": ["phone"],
  // Obviously fake fixture address (Ada Lovelace, 12 Farm Rd).
  "src/lib/orders.test.js": ["street"],
};

const BINARYISH = /\.(png|jpe?g|gif|webp|ico|svg|woff2?|pdf|lock)$/i;

function trackedFiles() {
  return execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter((f) => f && !BINARYISH.test(f) && f !== "package-lock.json");
}

function findContactData(file, text) {
  const hits = [];
  text.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(EMAIL)) {
      if (!PLACEHOLDER_DOMAINS.test(m[1].toLowerCase()))
        hits.push(`${file}:${i + 1} email`);
    }
    if (PHONE.test(line)) hits.push(`${file}:${i + 1} phone`);
    if (STREET.test(line)) hits.push(`${file}:${i + 1} street address`);
  });
  return hits;
}

describe("tracked files hold no customer contact data", () => {
  it("finds an email, phone and street address outside the allowlist", () => {
    const offenders = [];
    for (const file of trackedFiles()) {
      const allowed = ALLOWLIST[file] || [];
      const text = readFileSync(file, "utf8");
      for (const hit of findContactData(file, text)) {
        const kind = hit.split(" ").slice(1).join(" ");
        if (!allowed.includes(kind.split(" ")[0])) offenders.push(hit);
      }
    }
    expect(offenders, "contact data found at").toEqual([]);
  });

  it("recognizes each kind of contact data", () => {
    const sample = [
      "mail a.person@gmail.com now",
      "call 401-555-0123",
      "visit 12 Main Street today",
    ].join("\n");
    const kinds = findContactData("x", sample).map((h) => h.split(" ")[1]);
    expect(kinds).toEqual(["email", "phone", "street"]);
  });

  it("accepts placeholders on reserved domains", () => {
    expect(findContactData("x", "a@example.com b@mail.test")).toEqual([]);
  });
});
