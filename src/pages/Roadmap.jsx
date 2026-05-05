// What's coming. Plain-English overview of the planned features, sized
// to give a reader a feel for where the app is going without diving into
// implementation detail. The source-of-truth — with batch numbers,
// schemas, and execution rules — lives in `ROADMAP.md` at the repo root.

const ITEMS = [
  {
    title: "Projects, rebuilt",
    body: "Every project breaks down into phases, steps, and checklists, " +
      "with progress that adds up on its own. Editing supports markdown, " +
      "file attachments, assignees, and date ranges. Dependencies between " +
      "projects can shuffle dates proportionally when one slips.",
  },
  {
    title: "Processes",
    body: "Templates that hang off an event kind. Schedule a processing " +
      "day and the right preparation work lands on the calendar at the " +
      "right offsets — \"1 week before: check trailer hitch and tires\".",
  },
  {
    title: "Customers and lists",
    body: "A customer directory plus named lists for segmentation and " +
      "mailing groups.",
  },
  {
    title: "Resources, rethought",
    body: "Today's catch-all \"Resources\" gets broken up and re-homed " +
      "where it belongs — brooders alongside broilers, suppliers " +
      "alongside feed and inventory — with a search fallback so " +
      "anything is still findable.",
  },
  {
    title: "Animals & feed, overhauled",
    body: "The Feed page restructures to look and behave like Chores: " +
      "grouped by animal, drag-orderable, with amount remaining and " +
      "next order date front-and-center. Broiler pages get persistence " +
      "and a per-batch tracker so batches are easy to compare side by " +
      "side.",
  },
  {
    title: "Broiler weeks-remaining widget",
    body: "Front-and-center on the dashboard: every active broiler " +
      "batch with current week and weeks left. Replaces the " +
      "office-whiteboard scrawl.",
  },
  {
    title: "Products and pricing",
    body: "Real product pages with photos, descriptions, and content, " +
      "grouped by animal. Sales-over-time charts. A pricing UI " +
      "workshopped against Shopify, Square, Faire, and GoodEggs as " +
      "references.",
  },
  {
    title: "Inventory and point of sale",
    body: "On-hand counts by SKU and location. Selling at a market " +
      "drains inventory FIFO. An internal \"family sale\" flow.",
  },
  {
    title: "Orders",
    body: "Manual order entry, in-flight edits in collaboration with " +
      "the customer, and shipments created directly from an order.",
  },
  {
    title: "Stripe, Venmo, QuickBooks",
    body: "Card payments through Stripe, Venmo where the API supports " +
      "it, and accounting sync into QuickBooks.",
  },
  {
    title: "Google Calendar sync",
    body: "Sync between the farm schedule and Google Calendar. " +
      "One-way or two-way is still being worked out.",
  },
  {
    title: "Farm updates, social posts, content calendar",
    body: "A markdown editor with file uploads, list-based targeting, " +
      "and email sequences with delays. AI-assisted review before " +
      "anything goes out. Social posts share the same shell with real " +
      "network integrations and proper scheduling. A content calendar " +
      "that can drop items onto the schedule.",
  },
  {
    title: "Lessons",
    body: "Capture what we learn from the farm's repeating events — " +
      "\"rushed processing day, birds came in too small for the first " +
      "market\" — and have those lessons resurface automatically the " +
      "next time the schedule heads toward the same kind of event.",
  },
  {
    title: "App-wide search",
    body: "Cmd-K palette over every entity in the app, backed by a " +
      "Postgres full-text index.",
  },
  {
    title: "Bookmarks",
    body: "Pin any page or entity to a per-user bookmarks list, " +
      "surfaced in the sidebar.",
  },
  {
    title: "iPhone-friendly",
    body: "Every page audited at iPhone widths. Add to Home Screen via " +
      "a PWA install prompt.",
  },
  {
    title: "Works offline",
    body: "Mutations queue locally when the connection drops and sync " +
      "when it comes back. Assets cached so the app still loads.",
  },
  {
    title: "Pasture simulator",
    body: "Draw the farm's pastures on a map, drop tractor pins with " +
      "capacity, and assign batches. Scrub a timeline to see which " +
      "pastures are occupied or recovering on any given day, then " +
      "commit a movement plan that schedules the chore moves " +
      "automatically.",
  },
  {
    title: "Voice control",
    body: "Talk to the app — \"log Saturday's farmers market, six dozen " +
      "eggs sold\" — and have it interpret, confirm, then record.",
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
            className="bg-surface border border-line p-5 flex flex-col gap-2"
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
