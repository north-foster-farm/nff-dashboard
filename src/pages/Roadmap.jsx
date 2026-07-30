// What's coming. Plain-English overview of the planned features, sized
// to give a reader a feel for where the app is going without diving into
// implementation detail. The source-of-truth — with batch numbers,
// schemas, and execution rules — lives in `ROADMAP.md` at the repo root.
//
// Items are deleted from this list as they ship. Recently retired:
// "Chores, rebuilt", "Rounds", "Chore telemetry + push", "Chore
// assignments", "Events + Schedule, rebuilt", "A working calendar",
// "Resources, rethought" (dissolved into the farm map's place tree +
// the records drawer in Batch 18.2), "Triggers + animal-batch
// lifecycles" (Batches 19–20), "Inbox" (Batch 21), "Projects,
// rebuilt" (Batch 22), "Processes" (Batch 23), "Customers and
// lists" (Batch 24), "Animals & feed, overhauled" (Batches
// 25.1–25.2 — the Feed page group-cards redesign and the animal
// pages rethink with the feed schedule editor), "Metrics &
// analytics" (Batches 26.1–26.2 — the metrics registry, weigh-in /
// egg-count capture, the per-cohort cards on batch pages, the
// Metrics comparison page, and the dashboard broiler
// weeks-remaining widget), "Products and pricing" (Batches
// 27.1–27.3 — the catalog with photos and the four-slot
// descriptions, the pricing grid with live margins and price
// history, bundles, and the record-a-sale + sales-over-time
// surface), "Inventory and point of sale" (Batches 28.1–28.2 —
// lot-based inventory with the movement audit trail, and the Sell
// tab register with FIFO draw-down and the family-sale flow),
// "Orders" (Batches 29.1–29.3 — orders backend + CRUD, the open →
// ready → fulfilled lifecycle, and shipments), "App-wide search"
// (Batch 33 — the cmd-K palette; it is client-side, never a
// tsvector index), "iPhone-friendly" (Batch 35 — the mobile pass +
// the PWA install prompt).
//
// Graveyarded (cut from the plan, not shipped — see ROADMAP.md →
// Graveyard): "Bookmarks", "Voice control" (both 2026-06-02).

const ITEMS = [
  {
    title: "Farm events on your phone",
    body: "A one-way push to Google Calendar puts every market, " +
      "delivery, and processing day in the calendar app on your phone " +
      "(and watch, and laptop notification center, and anywhere else " +
      "Google Calendar reaches). The dashboard stays the source of " +
      "truth for edits — the phone copy is intentionally read-only so " +
      "there's no risk of two clocks disagreeing.",
  },
  {
    title: "Stripe, Venmo, QuickBooks",
    body: "Card payments through Stripe, Venmo where the API supports " +
      "it, and accounting sync into QuickBooks.",
  },
  {
    title: "Farm updates, social posts, content calendar",
    body: "Draft an update once — markdown editor, file uploads, " +
      "AI-assisted review — and on approval it goes out two ways " +
      "at the same time: published to the public nff website, and " +
      "emailed via our Fastmail account to a customer list " +
      "maintained over in CRM → Lists. Social posts share the same " +
      "shell with real network integrations and proper scheduling. " +
      "A content calendar that can drop items onto the schedule.",
  },
  {
    title: "Lessons",
    body: "Capture what we learn from the farm's repeating events " +
      "and have those lessons resurface automatically the next time " +
      "the schedule heads toward the same kind of event.",
  },
  {
    title: "Works offline",
    body: "Field captures — chore ticks, notes, mortality — already " +
      "queue on this device and sync when signal returns. Still to " +
      "come: the rest of the app's writes, plus cached assets so the " +
      "app loads with no signal at all.",
  },
  {
    title: "Rotation planner",
    body: "Plan pasture rotations on the same farm map the dashboard " +
      "already draws: real paddock boundaries, tractor pins with " +
      "capacity, and batch assignments. Scrub a timeline to see which " +
      "pastures are occupied or recovering on any given day, then " +
      "commit a movement plan that schedules the chore moves " +
      "automatically.",
  },
  {
    title: "The big audit",
    body: "A full pass over everything that's shipped: a code-side " +
      "review of the app's component architecture and design system, " +
      "then a recorded walkthrough of the whole app — every bug, rough " +
      "edge, and design inconsistency goes on one list and gets fixed " +
      "in order.",
  },
  {
    title: "Mileage tracker",
    body: "A record of miles driven for farm trips — markets, " +
      "deliveries, supply runs, vet visits — totalled per year for " +
      "tax season and per trip so we can see whether a particular " +
      "market is actually worth the drive. Where it lives in the UI " +
      "is still being worked out.",
  },
  {
    title: "A small daily something",
    body: "A rotating bit of polish on the login screen and dashboard. " +
      "Saving the rest for the reveal.",
  },
];

export default function Roadmap() {
  return (
    <div className="max-w-[760px] mx-auto flex flex-col gap-8 py-2">
      <div>
        <h2 className="font-heading text-[28px] font-bold -tracking-[0.02em] m-0 text-fg">
          What's coming
        </h2>
        <p className="text-[13px] text-dim mt-2 leading-relaxed">
          The features on deck after what's already shipped. This is the
          plan, not a promise — the order shifts as priorities change,
          and items get added as new ideas surface.
        </p>
      </div>

      <ul className="flex flex-col gap-1 bg-line list-none p-0 m-0">
        {ITEMS.map((item) => (
          <li
            key={item.title}
            className="border border-line p-5 flex flex-col gap-2"
          >
            <h3 className="font-heading text-[17px] font-semibold m-0 text-fg">
              {item.title}
            </h3>
            <p className="text-[13px] text-dim leading-relaxed m-0">
              {item.body}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
