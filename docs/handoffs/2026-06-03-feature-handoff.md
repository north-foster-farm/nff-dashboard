# North Foster Farm — Operations Dashboard Feature Handoff

**Purpose:** This document captures new feature requests and design considerations discussed for the NFF Operations Dashboard. It is intended as a planning input for Claude Code to fold into the existing roadmap. Features are grouped loosely by logical area; they are expected to be reprioritized and potentially merged into features already planned. Verbosity is intentional — capture the nuance and reasoning, not just the bullet points.

**Context:** This is a two-person operation (James and his father). The work environment is highly interrupt-driven — chores break up the day roughly five times, so context switching is a constant reality. Many design decisions below flow directly from that constraint: the app should *reduce* variability and push toward single-focus execution rather than introducing more things to juggle.

> Captured into the repo 2026-06-03 (was attached to chat). Folded into
> ROADMAP.md under "Recently added — sequencing TBD"; this file is the
> verbatim source of record. Two additions made in the same session and
> NOT in the original doc: a **Claude-powered agent** (in-app chat +
> email-to-agent) and two named integrations — **YoLink** (smart
> thermometers) and **transactional email** (SendGrid/Mailgun). Both are
> in the roadmap + the credentials walkthrough (`docs/integrations-and-credentials.md`).

---

## 1. Scheduling & Availability

A new capability to schedule both **working hours** and **time off** for both operators (James and his father).

### Recurring availability rules
- Set standing patterns, e.g. "weekends we try to quit at 5pm," or "on weekends we don't do projects — just chores."
- These are rules defined once and apply on an ongoing basis.

### Ad hoc / one-off blocks
- Block off specific hours or days for appointments, errands, vacation, etc. — e.g. "this Saturday afternoon I can't work" or "I'm off next Thursday."
- This is one-off vacation/time-off style scheduling layered on top of the recurring rules.

### Both modes required
- The system needs **both** recurring patterns *and* ad hoc entries. They coexist: recurring rules set the baseline, one-off blocks override or carve out exceptions.

### Design considerations raised (not committed, but worth weighing)
- **Availability at a glance:** ability to see who is available at any given time, so it's clear whether a person can actually take on a task.
- **Reason/category for a block:** distinguish *why* someone is blocked — time off vs. appointment vs. a hard stop for the day vs. other. This context helps planning.
- **Feeding into scheduling:** recurring patterns like "no projects on weekends" could potentially influence which tasks/projects get scheduled or surfaced. (Raised as a possibility, not finalized.)

---

## 2. Project Prioritization (Forced Ranking)

This is a significant rework of how projects are prioritized and how the schedule derives from them.

### Core philosophy
- Priorities are problematic when allowed to exist in plurality. The intent is a **single, forced-ranked list** where every project in queue is ranked against every other project — not multiple things flagged "high priority."
- This forced ranking should **dictate what happens and when.** The top of the list is the single focus.
- The friction of working on something *other* than the top priority should be **painful by design.** Given how divided the team's time already is (constant chore interruptions, heavy context switching), the app should actively direct toward a single focus rather than enabling more variability.

### Scope: projects only
- This forced-ranking applies **only to projects.** Processes, events, and chores are treated as effectively immutable / externalized:
  - Animals must be fed every day (chores are non-negotiable).
  - Events are usually external forces.
  - These get scheduled into the schedule *as needed*, and **projects fill the remaining time.**
- So the priority question is really: *of all the projects, which one fills the remaining (non-chore, non-event) time?*

### Reordering behavior
- An easy-to-access list of projects in priority order.
- Quick reprioritization by moving projects up/down the list (drag-style reordering).
- Moving a project changes everything below/above it accordingly — e.g. if Project 1 moves to slot 2, then Project 2 jumps to the top priority slot.
- When the top priority changes, the **Today view** should reflect the new top project's tasks, because those are now what should be worked on.

### Working in tandem
- There will be real circumstances where two projects/tasks must progress in parallel. This **must be possible** — but it should **not be the "happy path."** The default experience is single-focus; tandem work is the accommodated exception.

### Locking items to dates (the escape hatch)
- The mechanism for deliberately jumping something ahead of the priority order is **locking a task (or higher-level project element) to a date.**
- Example: "We know we need to get certain tasks done Thursday." Go to the project → go to the task → set a date → lock it there.
- Locked items stay put even when priorities are reordered around them. The rest of the schedule **flows around** locked items.
- Locking should be available at any level — project, phase, step, task (matching the hierarchy levels discussed originally).
- Because locking is a deliberate action, **no warning is needed** for "working out of sequence" when something is locked — the user knowingly chose it. (However, if a lock *creates a conflict*, that conflict must surface — see Conflicts section.)

### Schedule reflow
- The schedule updates based on priority reordering and locks ("schedule reflow").
- **Avoid cascade chaos:** if the user is actively planning — moving projects around, then moving them again in the same session — we do NOT want a massive recalculation firing on every single change.
- **Debounce the reflow.** James explicitly walked back the idea of a long debounce (5–10+ min felt too long). Target: **no more than ~30 seconds** between finishing prioritization and the schedule updating. Find a balanced value within that ceiling.
- **Manual reflow option:** a "reflow schedule" button in the UI may be useful so the user can trigger it explicitly.
- **Automatic fallback:** even with a manual button, reflow must also happen automatically, so that if the user forgets to click, the schedule stays accurate.

### Stale-state indicator (important UX pattern)
- When the schedule is out of sync with the current project priority list, show a **clear "stale" indicator** somewhere in the UI.
- The likely-right pattern: show the indicator wherever priorities live, and surface a manual "update / sync" button **anywhere stale priorities appear.**
- This prevents the confusing situation where everything suddenly looks different for no apparent reason. The user keeps the historical/current view ("this is what things just were") and then deliberately syncs to the new priorities ("we've changed our priorities now — sync it up").

---

## 3. Dates & Time in Projects (deliberately light-touch)

A nuanced stance on how dates fit into the project system.

### Why traditional date fields don't fit
- Traditional PM tools rely on start dates, end dates, and durations. Useful in a conventional environment — but here, the team often **doesn't know how long things will take.** Constant context switching from chores makes duration estimates unreliable.
- More importantly, it largely **doesn't matter** — the working model is "focus on the next thing until it's done," not "finish by date X."
- The team can tolerate **limited visibility into the future,** and that's considered acceptable/preferable: better to focus on getting the next thing done than on hitting arbitrary dates.

### Where dates DO have value
- Some date/time info is still useful in the projects view for **manual projection** when desired.
- Example: "We want to do this project when it cools off — in September." The exact duration doesn't matter much; the value is in being able to *position* the project in time mentally.

### The tension with forced ranking
- Assigning a date like "do this in the fall" **defeats the priority system** — it's explicitly deferring something rather than letting priority order dictate timing.
- **Resolution:** projects with this kind of date/timing intent should be handled differently from the actively-ranked list. The date is **useful metadata** (when we *want* to work on something) but should **not** be fed into the schedule or used for actual scheduling logic.

### The pattern (leaf-raking example)
- Example: "Rake leaves" is a project that can't happen until the leaves fall — it's literally **not actionable yet.**
- Such a project should go into an **Unprioritized bucket** rather than the active ranked list.
- Optionally attach a **plain-text timing note** (e.g. "last three weeks of fall," "when it cools out again"), so when it's time to prioritize it, there's a frame of reference.
- **Explicitly rejected:** a separate "On Hold" bucket — it creates duplication. The Unprioritized bucket serves this role instead.

---

## 4. Unprioritized Bucket (backlog)

- A bucket for **anything not yet scoped or not yet actionable** — not just time-gated items.
- Contents could be: a single sentence describing a project, a partial list of tasks, a seasonal/conditional project, a vague idea — anything project-related that isn't ready to be ranked.
- This is where projects land by default when promoted from "Just a Thought" (see next feature).
- When a project is ready to be committed to and worked on, it moves out of Unprioritized into the active forced-ranked priority list.

---

## 5. "Just a Thought" → Quick Convert (separate feature)

> Noted explicitly as its **own distinct feature**, separate from the projects/prioritization work.

- There is currently a "Just a Thought" capture feature in the app header.
- Add **quick actions** to convert a thought into a **Project**, **Chore**, or **Event.**
- This is essentially an automation: take the text from the "Just a Thought" post and route/stick it into the right place.
- When converted into a **Project**, it lands in the **Unprioritized bucket** by default.

---

## 6. Repeatable Projects (clone from stub)

- Projects are **one-off occurrences by nature** — not inherently recurring.
- But the same *kind* of project will be done repeatedly over the life of the farm. Example: building **chicken tractors** (the mobile enclosure pens). They eventually break and need to be scrapped/rebuilt, so that project recurs in practice.
- Need an easy way to **"reboot" / spin up a fresh version** of such a project — a clone/duplicate so the task structure doesn't have to be rebuilt from scratch.
- **Explicitly rejected:** a separate "Templates" folder in projects — that's too much infrastructure. Cloning from an existing project (a stub) is preferred over formal templating.

### Time tracking — explicitly OUT of scope
- It would be *nice* to know how long things take (e.g. how long to build a chicken tractor), but **collecting that data is too much overhead** given the constant jumping around, and most projects aren't repeated anyway.
- **Decision: skip time tracking entirely.** Do not build it.

---

## 7. Conflicts as a First-Class Concept

A broader concept than just project priority — **conflict indication needs to be its own thing in the app.**

### Why it matters
- Two-person operation. When two things need to happen at the same time, coordination is mandatory: person A does thing one, person B does thing two. Every conflict must be resolved deliberately and in advance.

### Where conflicts arise
- **Locked tasks** that create a scheduling collision (e.g. a locked task lands on top of a chore, or out of sequence in a way that conflicts).
- **Chores and events** occurring at the same time.
- **Two events** occurring at the same time (a particularly clear case).
- Generally: any scheduling collision.

### Behavior
- Conflicts must surface with **very clear flags** — prominent, not a quiet warning. They need their own "special sauce" treatment in the UI.
- The point is to detect conflicts **well in advance** so the two operators can plan how to split the work.
- **No severity levels** for now — all conflicts treated as equally urgent / equally needing resolution.

### Note on warnings vs. deliberate actions
- Don't warn the user merely for working "out of sequence" via a deliberate lock — that's an intentional choice.
- DO surface the situation when a lock (or anything else) actually **creates a conflict.**

---

## 8. Notifications — Behavior & Channels

> The notification UI itself needs tweaking later, but that's **not** the focus here. This is about **behavior and routing.**

### Channels
- **Email:** transactional email isn't wired up yet but is coming soon. Once it lands, add the ability to send notifications via email.
- **Push:** already exists (e.g. a notification fires when a round is finished, intended for when multiple people are working on it).
- **In-app:** notifications that pop into the alerts/inbox area at the top.

### Per-notification channel preferences (settings)
- Expose in **Settings** a per-notification-type preference grid/array.
- For each notification type, the user can choose channel(s): **push, email, in-app** — and "none at all."
- This is **checkboxes, not radio buttons** — a notification can go out on multiple channels simultaneously.
- Effectively a grid: notification types × channels.

### Example notification on hand
- "Round finished" — when a round completes, a push notification goes out (intended behavior: when multiple people are working on it). This is the kind of item that should become user-configurable per the grid above.

### In-app noise control
- Pain point: logging into an app, seeing a pile of in-app notifications with no clear reason, and just clearing them all — they become junk.
- Add the ability to **mute in-app notifications** from entering the inbox in the first place (a checkbox option per notification, consistent with the channel grid). The goal is high signal-to-noise.

---

## 9. Wish List (new top-level feature)

A new top-level feature. Not fully baked, but the shape is clear: a **prioritized list of things to acquire** — anything that costs money (goods, services, merchandise), though it doesn't strictly have to cost money.

### Item attributes
- **Title / name** of the thing (e.g. "high tunnel storage system," "tractor").
- **Priority:** high / medium / low.
- **Cost estimate:** roughly how much it's expected to cost.
- **URL / link:** optional link to the product.
- **Description:** why we need the thing to exist.
- **Image:**
  - For items with a **product URL**, auto-fetch the product image (avoid awkward manual screenshots or empty icons).
  - For **plain-text descriptions**, ideally auto-pull a relevant image — possibly via an API connection to Claude or similar that can parse the natural-language description and find an appropriate image.
  - Allow **manual image upload** to override the auto-fetched image.
- **Captured by / when:** who added the item and the timestamp.

### Collaboration / agreement
- A **thumbs-up / "I agree" button** — if Dad drops something on the list and James agrees it's needed, he can endorse it.
- A **skeptical reaction** — the 🤨 "thinking/raised-eyebrow" face (the skeptical, chin-scratching one). *(Note: this is NOT a neutral "meh" — it specifically conveys skepticism/uncertainty.)*

### Item lifecycle / actions
- **Create / Edit / Delete** (a straight delete button).
- **Purchased / Acquired** action — clears the item off the active list.
- On **Purchased**, the item should flow into the asset system (see below).

### Filtering & grouping
- Group by **category.**
- Group by **priority** — and within a priority group, order by the wish-list (manual) order.
- Also a straight **priority-only** sort.

### Wish List → Asset pipeline
- Purchased wish-list items are effectively **business assets.**
- Existing asset categories are already stubbed out (tractors, trailers, equipment, etc.) — these double as useful **wish-list categories.**
- On purchase, **auto-create an asset object** in the matching category. Example: "tractor" on the wish list → buy it → a tractor asset object is created in the tractor section.
- **Not fully automatic:** on purchase, **pre-fill the asset-creation UI** with the wish-list data, let the user **tweak each field** before saving, then save the object. Mostly automated, but the user retains control over the final asset record.

---

## 10. Asset Subsystem (revisit & expand)

Several asset pages are still "coming soon" (e.g. equipment). The broader idea: **assets are things the farm owns**, and it's valuable to know what exists and what's tied to what.

### Linking assets to work
- Assets should be **linkable to projects, chores, AND events.**
- Rationale — when an asset is committed to a piece of work, it's unavailable elsewhere that day:
  - Example: processing chickens requires the **F-150** and the **deck-over trailer** — two fleet items locked up that day, unavailable to anyone else.
  - Example: overlapping markets this season — Dad goes to one, James to another. James needs to know he's bringing **market kit B** and Dad has **market kit A.**
- It was historically obvious (just the two of them), but overlapping commitments now make explicit asset-to-work linkage genuinely useful.
- Assets aren't just vehicles/equipment — **any asset type** can be linked.

### Asset metadata
- **Global / universal:** purchase date.
- **Type-specific fields** (specificity by asset class):
  - **Vehicles:** fuel type (gas / electric / diesel), and **mileage** — shown as **previously recorded mileage history** on the asset page (e.g. clicking the F-150 shows its logged mileage over time).
  - **Machinery:** an **hours** field.
- The mileage model should reflect reality: mileage is **recorded against the specific vehicle**, not as an abstract number in absentia — so it makes sense to display it on that vehicle's page (e.g. the F-150 page).
- There will be plenty more type-specific fields to work through later; these are just the starting examples.

### Dependency note
- **Mileage tracking** is targeted for a **near-future batch** — the logging mechanism doesn't fully exist yet, but the asset pages should be modeled to accommodate it.

---

## 11. Storage Locations, Lots & Bins (e-commerce / inventory)

Specific to e-commerce and physical product (eggs, chicken meat, etc.).

### The problem
- Product is stored across **multiple freezers / multiple locations** (e.g. two chest freezers).
- Multiple **batches** of chicken; **eggs arrive every day.**
- **Stock rotation (FIFO)** is critical to nail down early. Without infrastructure, staying organized will be a challenge — e.g. preventing cuts from processing day A from getting interleaved with cuts from processing day B, while still keeping product accessible.

### App infrastructure needed
- **Lot tracking:** each processing batch gets a lot identifier.
- **Storage location / bin assignment:** track *where* each lot physically lives (which freezer, which bin/partition/shelf).
- **Fulfillment integration:** when a sale comes in (e.g. an e-commerce order for a piece of chicken), the **fulfillment ticket should show where the stored item is located.** When the item is pulled from that location, **decrement the inventory** for that lot accordingly.
- This is **FIFO inventory management** — important for food safety and freshness.

### Flagged as a design consideration (not an action item yet)
- James wants **advice on the physical organization system** (e.g. cardboard partitions vs. another scheme for keeping batches separate yet accessible in the chest freezers). This needs thought/consideration — **flagged now, to be designed separately.** The app side should make lot + location tracking easy regardless of the physical scheme chosen.
- There's "plenty more to get through" on the e-commerce side; for now the focus is specifically the **lot + bin concept** and **stock rotation.**

---

## 12. File Storage (new cross-cutting feature)

The concept of **file storage** needs to exist in the app and be integrated across a number of features.

### Backend
- Likely an **S3 bucket** — unless there's a better-fit storage option for the use case. (Worth a quick evaluation: S3-compatible alternatives like Cloudflare R2, Backblaze B2, or DigitalOcean Spaces can be cheaper, especially on egress, and several are drop-in S3-API compatible. Decision deferred to implementation.)

### Upload targets (files attach to various entities)
- **Cut sheets** → uploaded to **processing events.**
- **Photos and videos** → uploaded to **product pages.**
- **Media** → uploaded to the **social media content calendar** section.
- **…and more** — treat this as a general capability that many entities can use, not a one-off per section.

### Google Drive integration
- There's an existing **Google Drive account.** Some kind of integration would be great — ideally **pulling files directly from Google Drive** rather than only uploading from local.

### Versioning (flagged for further design)
- Versioning of stored items would be valuable — flagged as a **question mark / needs more design consideration at implementation time.**
- Possible expanded use: **host important company brand assets in the dashboard** — logo files, typefaces, etc.
- Proposed pattern: in backend storage, **never destroy anything** — instead upload new versions and keep a **manifest pointing to the latest version** of each item. Seems like a useful way to get started, but **flag for further discussion** before building.

---

## 13. Guest / Contributor Access (lightweight, NOT a full role system)

Currently authentication is restricted to users with a North Foster Farm email address, and that works fine for the two principals. The new need is **limited, gated access for occasional helpers** — without building a heavy permissions system.

### Explicitly NOT wanted
- **No full, robust multi-user role/permission system.** Not necessary for any foreseeable period.
- **No granular per-everything permission grid.** Don't make the user specify permissions on every object.

### What's actually needed
- **Gated access for specific guest users** to specific parts of the dashboard.
- Example: James's sister (Sarah) will help with **social media** — she needs access to social media content management, the relevant **files uploaded to the content calendar**, and **post creation/scheduling.** And that's it.
- Other helpers (e.g. someone **farm-sitting**) might need access to the **chores list** (and possibly the schedule). This applies to anyone who comes to help, not just Sarah.

### Access model
- Prefer an **explicit allow-list approach**: for a given user (or group), grant access to a small set of **basic things we expose** — e.g. chores, schedule, social media — rather than defining permissions on everything.
- Could even be **ad hoc**: once a user is verified, pick which pages/sections they can access (e.g. "this user gets chores"). Think page-level / section-level grants, not fine-grained object permissions.

### Expiry
- Ability to set **time-limited access** — e.g. "give them access for this weekend" or "for the next month" — with **automatic revocation** when it expires.
- **Expiry applies to guest contributors only.**

### Auth mechanism
- **Magic link sign-in** is appealing — possibly avoiding username/password entirely, even for regular helpers like Sarah.
- Key requirement: **don't force constant re-authentication.** Persist a session (e.g. stash data in local storage) so a regular contributor isn't requesting a new magic link every time.
- Implementation note: current auth system is minimal/uncertain, so what's supported vs. not needs to be checked during implementation. Exact mechanism (magic link vs. temporary username/password) is flexible as long as it's lightweight and doesn't require constant re-auth.

---

## Quick Index of Decisions / Constraints

- **Single forced-ranked priority list** for projects; tandem work allowed but not the happy path.
- **Lock-to-date** is the deliberate escape hatch for jumping the queue.
- **Schedule reflow:** debounced (<= ~30s), with a manual button AND automatic fallback, plus a **stale indicator** + sync action.
- **Dates in projects:** capture as metadata / plain-text intent only — do NOT feed into scheduling logic.
- **Unprioritized bucket** replaces any "On Hold" concept (no duplication); holds unscoped + not-yet-actionable items.
- **No time tracking** — explicitly out of scope.
- **Repeatable projects** via clone-from-stub, NOT a templates folder.
- **Conflicts** are a first-class, high-visibility concept; **no severity levels** for now.
- **Notifications:** per-type channel grid (push / email / in-app, multi-select checkboxes), plus in-app mute; email pending transactional support.
- **Wish List -> Asset** pipeline with pre-filled, editable asset-creation form on purchase.
- **Assets** link to projects/chores/events; type-specific metadata (vehicle mileage history, machinery hours); mileage logging is a near-future batch.
- **Lots + bins + FIFO** for product storage; physical-organization advice flagged for separate design.
- **File storage** (likely S3 or S3-compatible) integrated across entities (cut sheets, product media, social calendar); Google Drive pull-in desired; versioning + brand-asset hosting via never-destroy + manifest pattern, flagged for further design.
- **Guest access:** lightweight allow-list by page/section, NOT a full permission system; magic-link auth with persistent session; expiry with auto-revocation for guests only.
