// What's coming. Plain-English overview of the planned features, sized
// to give a reader a feel for where the app is going without diving into
// implementation detail. The source-of-truth — with batch numbers,
// schemas, and execution rules — lives in `ROADMAP.md` at the repo root.

const ITEMS = [
  {
    title: "Chores, rebuilt",
    body: "Sites become first-class — Brooder #1 and Brooder #2 are " +
      "different places, used across chores, observations, and the " +
      "metrics & analytics subsystem. Time blocks (Morning / " +
      "Afternoon / Evening, or whatever you name them) are CRUD-able; " +
      "edit a window once and every chore in it inherits. Chore " +
      "definitions get in-place edit. The schema lays the rails for " +
      "everything that follows.",
  },
  {
    title: "Rounds",
    body: "A mobile-first full-screen surface for actually doing " +
      "chores. Tap \"Start rounds\" — the sidebar everywhere flips to " +
      "\"Help with rounds\" with a live counter, your dad's phone " +
      "stays in sync, ticking a box on one phone disables the same " +
      "box on the other (no bickering). A persistent Site Switcher " +
      "lets you jump from Brooders to Mobile coops to Sheep without " +
      "drilling back up. Quick actions for notes, condition checks, " +
      "mortality, and \"moved coops\" are site-aware — at Mobile " +
      "coop 1, those buttons already know which cohort lives there.",
  },
  {
    title: "Events + Schedule, rebuilt",
    body: "Event creation, editing, and the full recurrence picker " +
      "(\"first and third Sunday May 14 to September 21 every year\" " +
      "is one rule, not a workaround). The schema splits a series " +
      "from its occurrences so per-instance edits — \"this Saturday's " +
      "market is at a different address\" — have a real home. The " +
      "old timeline view goes away; an Agenda view replaces it.",
  },
  {
    title: "A working calendar",
    body: "Day, Week, Month, and Agenda views on one page. Click the " +
      "month/year header to type where you want to land. Drag events " +
      "to reschedule. Chore-block windows show as faint amber bands " +
      "behind the day grid — when a market lands on top of a band, " +
      "you see the conflict at a glance instead of finding out at 7:55 " +
      "AM the day of.",
  },
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
    title: "Triggers + animal-batch lifecycles",
    body: "Two seed automations to start: feed dropping to its reorder " +
      "point creates an order chore plus a \"receive delivery\" event, " +
      "and creating a new broiler batch stamps its arrival, " +
      "pasture-move, processing, and brooder-cleanout dates onto the " +
      "calendar. Click any of those dates from the batch detail page " +
      "to edit them in place. Auto-generated rows are flagged so you " +
      "can sanity-check before the day arrives.",
  },
  {
    title: "Inbox — \"just a thought…\"",
    body: "A quiet capture surface for ideas that aren't yet projects " +
      "or chores. Type-and-go from the top bar; new items land in the " +
      "dashboard notifications widget without firing a push. A " +
      "dedicated Inbox page lists every captured thought with " +
      "drag-orderable, pinnable rows, an Archived tab for things " +
      "you're done with, and per-user read/unread state so each of " +
      "us can mark our own.",
  },
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
    body: "The Feed page becomes a group-cards layout: grouped by " +
      "animal, drag-orderable, with amount remaining and next order " +
      "date front-and-center and last price paid as a secondary line. " +
      "Broiler pages get persistence and a UI rethink across all " +
      "subpages — the per-batch numbers (FCR, weight gain, mortality, " +
      "feed cost) live in the Metrics & analytics subsystem below " +
      "rather than being bolted on here.",
  },
  {
    title: "Metrics & analytics",
    body: "A first-class home for every number the dashboard tries to " +
      "answer questions with — and the subsystem all our reporting " +
      "and data-viz lands in instead of getting scattered across " +
      "individual pages. Two seeded metric families to start: " +
      "broiler batches (Feed Conversion Ratio, Average Daily Gain " +
      "from a weekly random sample, uniformity, weeks-remaining, " +
      "cross-batch comparison sheet) and layer flocks (hen-housed " +
      "production, feed per dozen, feed per pound of egg mass, body " +
      "weight trend with the \"burning reserves vs. getting fat\" " +
      "flags). One registry, one front-end API, one place to ask " +
      "\"how are we doing?\" and get a real answer.",
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
