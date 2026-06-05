# Functional + UX audit — walkthrough 2026-06-04

Source: `audits/raw/walkthrough-2026-06-04.mov` (7:01, 45 segments).
Processed transcript + frames:
`audits/2026-06-04/processed/walkthrough-2026-06-04/`.

Scope of this clip: shell / top bar / first impressions, the "Just a
thought" capture flow, the Inbox, and notifications. Each finding =
page · James's words · frame · diagnosis · size · checkbox. Sizes are
S (≤30 min), M (≤2 h), L (half-day+). Nothing here touches migrations
or prod data.

---

## Top bar

### F1 — Logo is too big  ·  S  ·  `[ ]`
> "this logo is too big. It needs to be approximately the same size as
> the hamburger menu in the height of the text." — [00:47]

Frame: `frames/0005_00-47.jpg`.
`LOGO_HEIGHT = 32` in `src/components/TopBar.jsx:72`, rendered via CSS
mask. The hamburger is `Menu size={18}` and the "Admin · v…" label is
`text-[11px]`. The mark towers over both. Drop `LOGO_HEIGHT` to ~18–20
so it sits flush with the hamburger glyph and the cap height of the
text. Width auto-scales (mask `size: contain`), so only the constant
changes.

### F2 — Logo isn't a link  ·  S  ·  `[ ]`
> "It also is not a hyperlink and that is tripping me up because I keep
> clicking on it." — [01:00]

Frame: `frames/0007_01-00.jpg`.
`LogoMark` is a bare `<span role="img">` (`TopBar.jsx:106`). Wrap it
(and ideally the Admin label) in a link to the home route — confirm at
triage whether home = `/now` or `/map`. Keep the mask styling; just add
the anchor + hover affordance.

### F3 — Search control is too cluttered  ·  M  ·  `[ ]`
> "this search button right here is just too cluttered… All we really
> need is the command K and maybe a magnifying glass… search, but not
> the full UI with the double boxes." — [01:08]–[02:53]

Frames: `frames/0008_01-08.jpg`, `frames/0013_02-30.jpg` (James
inspecting it in devtools).
The desktop pill (`TopBar.jsx:40–51`) is `bg-surface border border-line`
holding a magnifier + the word **Search** + a bordered `⌘K` kbd — the
"double box" he's reacting to (border on the button *and* on the kbd).
Target: minimalist — magnifier + `⌘K`, drop the "Search" label, shed
the heavy surface/border so it reads as a light affordance next to the
"Admin" label, not a chunky button. The phone-only icon button
(`:52–58`) already approximates this.

---

## "Just a thought" capture

### F4 — Trigger icon should signal *authoring*, not a lightbulb  ·  S  ·  `[ ]`
> "not a bell, a light bulb… it would be better if it wasn't a light
> bulb and was more indicative that it's something being authored… this
> notebook pen icon would be a nice use." — [04:07]–[05:00]

Frame: `frames/0026_04-15.jpg`, `frames/0029_05-00.jpg` (he opened the
Lucide icon picker in a second tab).
`ThoughtCapture.jsx:2,57` uses `Lightbulb size={16}`. Swap for a
notebook/pen Lucide glyph — `NotebookPen` is the literal match to his
words; `PenLine` / `SquarePen` are alternates. Pick at triage.

### F5 — Placeholder text is misleading  ·  S  ·  `[ ]`
> "this placeholder text… is a little bit misleading… this needs to not
> imply that it's not a project when reality very well might be… just
> explain that thoughts captured here end up in an inbox for later
> prioritization." — [05:16]–[06:07]

Frames: `frames/0030_05-16.jpg`, `frames/0037_06-07.jpg`.
Current (`ThoughtCapture.jsx:76`): *"Anything worth not forgetting. It
lands in the Inbox — not a project, not a chore, just captured."* The
"not a project, not a chore" half wrongly implies the thought is
disqualified from becoming one — when the whole point is that Inbox
items get promoted into projects/chores/events later. Reword to convey
"lands in the Inbox for later prioritization; anything worth not
forgetting belongs here." Draft copy at triage.

### F6 — After capture, surface a link to the saved thought  ·  M  ·  `[ ]`
> "It would be nice if this interface then showed me a link that I could
> click to open this thought wherever it lives… rather than me having to
> go find it." — [03:12]–[03:24]

Frames: `frames/0018_03-12.jpg`, `frames/0019_03-18.jpg`.
On save, the popover shows "Captured ✓" (`frames/0018`) but no way to
jump to the item. Add a "View in Inbox" link (or make "Captured ✓"
itself the link) routing to `/inbox`, ideally focused on the new row.

---

## Inbox

### F7 — "Red on red" on a row action  ·  S  ·  `[ ]`  ·  *verify*
> "Red on red, pin to drop. What does that say? Pin to top." — [03:30]

Frame: `frames/0021_03-30.jpg`.
Reading the inbox row actions (check / pin / event / project / archive
on `src/pages/Inbox.jsx`), he hit a red-on-red contrast spot — likely a
hover or tooltip state the static frame doesn't capture. Low confidence
on the exact element; reproduce live at triage, then fix the contrast.

### F8 — Inbox row actions are unlabeled / unclear  ·  S  ·  `[ ]`  ·  *clarify*
> "Promote to event, project. Nice. That works too. Where's that file
> uploading? I don't even know." — [03:43]–[03:58]

Frame: `frames/0022_03-43.jpg`.
He decoded the icons only by hovering for tooltips, and one action's
purpose ("file uploading") was opaque — `ThoughtCapture` has no file
upload, so this is about an Inbox row icon reading as something it
isn't. Clarify intent at triage (tooltips on all actions? a label on
the ambiguous one?). Possibly folds into F7.

---

## Confirmed working — no action

- **Farm map** at this resolution: "This looks good… Everything appears
  how it should." — [00:17]–[00:30] (`frames/0002`, `0003`).
- **Sign-in / sign-out flow** works. — [00:00].
- **⌘K capture hotkey** is captured correctly. — [03:06].
- Inbox **pin-to-top / promote-to-event / promote-to-project** all work.
  — [03:43].
- **Notifications** headed under "Automations" — "I like that"; **scroll
  behavior works as expected**; **background sync** confirmed
  ("that was syncing in the background, that's good"). — [06:30]–[06:55].
  (He flagged the notification *delivery mechanism* as a separate,
  later conversation — not a finding here.)

## Non-findings (retracted on tape)

- Capture textarea "styling doesn't match" → he immediately realized it
  was just the focus state: "oh, it's focused… never mind, that's
  fine." — [06:15].

---
---

# Clip 2 — Now screen + Farm map

Source: `walkthrough-2-2026-06-04.mov` (4:34, 41 segments).
Processed: `audits/2026-06-04/processed/walkthrough-2-2026-06-04/`.

## Now screen

### F9 — Redundant chevron on the "Up Next" banner  ·  S  ·  `[ ]`
> "The play arrow's good here. This one is not necessary. That should be
> eliminated." — [00:11]

Frame: `frames/0003_00-11.jpg`.
The green "Start morning rounds" banner has both a play icon (left) and
a `>` chevron (right) — `src/pages/Now.jsx`. The whole banner is already
clickable, so the trailing chevron is redundant. Keep the play arrow,
drop the chevron.

### F10 — Overdue should roll over at midnight  ·  M  ·  `[ ]`  ·  *discuss*
> "because it is at the current time, 4:33 in the morning, this overdue
> task was assigned the prior day… anything in the overdue category for
> that day is no longer overdue. The day should just reset and roll over
> at midnight." — [00:30]–[00:53]

Frame: `frames/0008_00-47.jpg`.
"Move to pasture — Batch 3" (an automation-created chore, asterisked)
sits under OVERDUE at 4:33am, carried from the prior day. James's model:
overdue is a *same-day* concept — at midnight the day resets and
yesterday's unfinished items shouldn't read as "overdue" against today.
Needs a triage discussion on the intended rollover semantics (drop?
re-queue? "missed yesterday" bucket?) before touching the overdue query
in `src/lib/chores.js`.

## Farm map

### F11 — Done vs to-do zone colors aren't distinct enough  ·  S  ·  `[ ]`
> "I would like these colors to be a little bit different to better
> clarify which areas are done and which have to-do remaining." — [01:06]

Frames: `frames/0011_01-06.jpg`, `frames/0012_01-13.jpg`.
The to-do / all-done greens on the map zones read too similarly. Widen
the contrast between them. (He checked the overdue swatch against the
legend and confirmed *that* one's consistent — not a finding.)

### F12 — Farm-map search row is vertically misaligned  ·  S  ·  `[ ]`
> "the alignment is off… if you trace the blue lines, it's intersecting
> 'North Foster Farm'… it's set to align-items start, it should be
> center… it is not the end of the world so severity is much less." —
> [01:36]–[02:24]

Frames: `frames/0016_01-36.jpg`, `frames/0019_01-55.jpg`.
The header row holding the `North Foster Farm` h1 + the search input +
EDIT PLACES is `align-items: start`; the input baseline doesn't line up
with the heading. `src/pages/MapPage.jsx`. He flagged it low severity.

### F13 — Search placeholder "code" is unclear; scope is misleading  ·  S  ·  `[ ]`
> "I'm not sure what is meant by 'code' in this placeholder… you're not
> able to search by chores from this search area." — [02:30]–[03:14]

Frames: `frames/0024_02-30.jpg`, `frames/0030_03-14.jpg`.
Placeholder reads *"Find a place, code, or animal batch."* — "code" is
opaque, and James probed what's actually searchable (places + animals,
not chores). `src/components/PlaceSearch.jsx`. Reword to match real
scope; settle exact copy at triage.

## Confirmed working — Farm map / Now (clip 2)

- Now header + "Up Next · sunrise · 2h" banner: "This looks good… I like
  that." — [00:00]–[00:05].
- Overdue section + automation asterisk decoration: "generally good… I
  like that it's decorated with this asterisk." — [00:18]–[00:24].
- Map look/feel, "quiet" swatch, EDIT PLACES placement ("keep it
  there"), and the zoom-state-aware help text all endorsed. —
  [03:21]–[04:23].

---
---

# Clip 3 — Dashboard + Broilers widget

Source: `walkthrough-3-2026-06-04.mov` (13:17, 127 segments).
Processed: `audits/2026-06-04/processed/walkthrough-3-2026-06-04/`.
Most widgets live in `src/pages/Overview.jsx`. This clip is design-heavy
with two real functional bugs (F16, F17).

## Dashboard composition

### F14 — Strip widgets that belong on Now or aren't built yet  ·  M  ·  `[ ]`
> "current conditions really should live on Now… schedule-at-a-glance
> belongs to Now… active projects and activity really don't belong on
> this screen, I'd rather omit it… open orders and in-progress farm
> updates… strike these from the dashboard for now, we can re-implement
> down the road." — [00:22]–[01:27]

Frames: `frames/0004_00-22.jpg`, `frames/0007_00-40.jpg`,
`frames/0011_01-00.jpg`.
Trim the Dashboard to what's earned: remove **active projects** and
**activity**; strike **open orders** and **in-progress farm updates**
(undelivered/placeholder features) for now. **Current conditions** and
**schedule-at-a-glance** are tied up in F15 below.

### F15 — Consolidate Now + Dashboard into one screen  ·  L  ·  `[ ]`  ·  *design*
> "I wonder if we can consolidate the Now and the Dashboard screens…
> maybe we get rid of the Now screen, fold it into the Dashboard, put
> the 'start morning rounds' button at the top-left, overdue chores
> below it just like Now, then slide upcoming chores down so they're
> present but not prioritized the same way." — [02:18]–[03:30]

Frames: `frames/0024_02-18.jpg`, `frames/0028_02-43.jpg`,
`frames/0034_03-19.jpg`.
A structural proposal, not a quick fix: merge `Now.jsx` into
`Overview.jsx` — morning-rounds CTA top-left, overdue stack beneath it,
upcoming-chores box demoted lower. He praised the collapsible chore
groups as the right interaction to carry over. Park for a design pass at
triage; it reshapes F14 and F18.

## Schedule at a glance — bugs

### F16 — Undated / future-dated projects show as "All day · today"  ·  ?  ·  `[ ]`  ·  *bug*
> "this 'testing' project, no date was assigned, however it's popped up
> as all-day testing in progress. The processing-day-prep projects had
> dates in the future, however they still show up… as all-day tasks for
> today. That's not working correctly." — [04:36]–[05:06]

Frames: `frames/0046_04-42.jpg`, `frames/0049_05-00.jpg`.
In Schedule-at-a-glance → TODAY, an undated project (*testing*) and a
future-dated project (*Processing day prep — Broil…*, 0/6 steps) both
render under TODAY / "All day." The automation that turns
processing-day-prep into a dated project, plus the schedule's
date-window filter, is mis-bucketing undated and future projects into
today. Likely `src/lib/projects.js` + the Overview schedule query — diagnose
at the fix session. Severity TBD pending repro.

### F17 — Schedule-at-a-glance is stale after a chore-block rename  ·  ?  ·  `[ ]`  ·  *bug*
> "we don't have a morning/afternoon block anymore… but yet afternoon
> chores still show up here, so that isn't updating correctly… I know
> it's not accurate because we just reset sunrise / renamed these
> things recently." — [04:00]–[04:19]

Frames: `frames/0040_04-06.jpg`, `frames/0041_04-13.jpg`.
Block definitions were renamed/reset in Chores, but Schedule-at-a-glance
still lists the old blocks (e.g. "Afternoon chores · 24 items") and a
possibly stale sunrise time. Points at cached/denormalized block data
the schedule reads. Confirm against current `chore_blocks` at triage.

### F18 — Move "Sunrise in N min" out of the schedule list  ·  S  ·  `[ ]`
> "because morning chores are now scheduled around sunrise, we can omit
> this 'sunrise in 31 minutes' from schedule-at-a-glance, or move it up
> into current conditions where it really belongs — that's ambient
> data." — [05:53]–[06:15]

Frame: `frames/0059_06-05.jpg`.
Relocate the sunrise readout from the SCHEDULE AT A GLANCE header to
CURRENT CONDITIONS (ambient). Ties into F14/F15. The per-block item
counts ("20 items" etc.) he endorsed — keep those.

## Broilers widget

### F19 — Show days alongside weeks  ·  M  ·  `[ ]`
> "there's a difference between a batch that just crossed into week two
> today versus one with one day left in week two… I'd like a day count
> as well. Doesn't have to be prominently featured." — [06:47]–[07:28]

Frames: `frames/0067_06-56.jpg`, `frames/0070_07-14.jpg`.
The widget shows "week 4 / week 2" only. Add a day count (e.g. "week 2 ·
3d") since a few days swing the growth stage a lot. `BatchMetrics.jsx` /
`Overview.jsx`. Secondary emphasis is fine.

### F20 — De-emphasize the week/date label  ·  S  ·  `[ ]`
> "this breeder text… like this '2 PM' label is a bit more subdued —
> that would be a good way to de-emphasize the date." — [07:30]–[07:42]

Frame: `frames/0074_07-36.jpg`.
Mute the "week N" label styling to match the subdued time labels (e.g.
the "2 PM" in the chore list) rather than competing with the batch name.

### F21 — "not yet arrived" → "arrives <date>", drop the year  ·  S  ·  `[ ]`
> "instead of 'not yet arrived' it said 'arrives June 24th'… this date
> format does not need the year appended. These broilers run in a very
> seasonal window, no need to disambiguate years — omit it completely."
> — [08:00]–[08:28]

Frames: `frames/0078_08-00.jpg`, `frames/0081_08-22.jpg`.
Left cell currently reads "not yet arrived"; replace with the arrival
date and strip the year (`Jun 24, 2026` → `Jun 24`). `BatchMetrics.jsx`.

### F22 — Put arrival on the left; blank the right pre-arrival  ·  S  ·  `[ ]`
> "move 'arrives June 24th' to the left side… and then weeks-to-
> processing doesn't have a value at that point, perhaps make more sense
> to be left blank." — [09:43]–[10:00]

Frames: `frames/0095_09-43.jpg`, `frames/0098_10-00.jpg`.
For not-yet-arrived batches, show the arrival date in the left column
and leave the right ("weeks to processing") blank instead of repeating
the date there. Pairs with F21.

### F23 — Clicking "weeks remaining" should open the processing event  ·  M  ·  `[ ]`
> "six weeks remaining, click on that — that should open up this
> processing event directly, rather than the extra clicks I just did
> [batch page → processing details]." — [08:30]–[09:28]

Frames: `frames/0090_09-14.jpg`, `frames/0091_09-21.jpg`.
Today the right-column link routes to the batch page, from which the
processing event is several clicks away. Make "N weeks remaining" deep-
link straight to that batch's processing event.

### F24 — Make the batch link look clickable  ·  S  ·  `[ ]`
> "the hyperlink for batch three is very hard to catch unless you hover
> over it… it should be decorated as a URL so you know it's clickable.
> Likewise '3 weeks remaining' should be clickable. Time-to-pasture does
> not need to be clickable — the chore is just labor, no data." —
> [12:15]–[13:17]

Frames: `frames/0119_12-15.jpg`, `frames/0122_12-35.jpg`.
Batch-name links only reveal themselves on hover. Give them persistent
link styling. Apply the same to "weeks remaining" (per F23). The
future "time to pasture" value (F26) stays non-clickable.

### F25 — Surface batch conflicts  ·  L  ·  `[ ]`  ·  *feature*
> "anything that conflicts between batches… two delivery events in a
> short window… birds in the brooder that need pasture but birds already
> on pasture not yet processed… tight windows where we've got to do this
> then that very quickly — there should be a way of flagging and
> highlighting that in the broilers summary." — [10:09]–[11:13]

Frames: `frames/0102_10-30.jpg`, `frames/0106_10-53.jpg`.
New capability: detect and flag scheduling conflicts across broiler
batches (overlapping deliveries; brooder-needs-pasture while pasture
still occupied/unprocessed; compressed move/process windows). Scope at
triage — likely its own roadmap item, not a same-day fix.

### F26 — Add weeks+days to pasture; richer batch columns  ·  M  ·  `[ ]`  ·  *design*
> "weeks and days until pasture… I'd like the batch name, the time it's
> been on the farm in weeks and days, the time until it goes on pasture
> in days, and the date it goes to processing — all reflected in this
> area." — [11:20]–[12:15]

Frames: `frames/0112_11-27.jpg`, `frames/0115_11-49.jpg`.
Target column set per row: batch name · time-on-farm (wk + d) · time-to-
pasture (days) · processing date. He acknowledged it's tight on space —
needs a layout pass alongside F19–F22.

## Parked by James (clip 3)

### F27 — A batch shows "not assigned"  ·  —  ·  `[ ]`  ·  *deferred*
> "this is not assigned, I wonder why… I'm going to put that one on hold
> and address it in a future video." — [09:30]–[09:37]

Frame: `frames/0093_09-30.jpg`. James explicitly deferred — logged so it
isn't lost; no action until he revisits.

## Confirmed working — Dashboard (clip 3)

- Collapsible chore groups: "a very, very on-target way of handling it…
  it's nice." — [02:00]–[02:18].
- Per-block item counts in schedule-at-a-glance: "seems fine… better
  than a blank space." — [05:06]–[05:45].
- Upcoming events: "I like how this is still showing up correctly… a
  processing day this week showing up correctly." — [06:15]–[06:30].
- Broilers widget landing at all: "Finally, this has landed. I'm very
  happy to see this… that's all correct." — [06:30]–[06:47].
- Clicking a batch row navigates to the right batch page (the *target*
  is correct; F23 is about reducing the click depth from there). —
  [08:30]–[08:51].

---
---

# Clip 4 — Metrics

Source: `walkthrough-4-2026-06-04.mov` (10:23, 96 segments).
Processed: `audits/2026-06-04/processed/walkthrough-4-2026-06-04/`.
The page (`src/pages/Metrics.jsx`) has three sections: broiler
batch-comparison, layer flock-comparison, and the metric-definitions
registry. James's through-line: too much explanatory *prose*; push the
provenance/definitions onto hover, and reclaim horizontal room for the
tables.

## Design directive — Metrics is a desktop surface
> "This is a perfect example of a page that we do not need to support on
> mobile… as long as it doesn't break completely, that's all we're
> asking. It doesn't matter if the entire table is truncated and
> overflowing… What matters is just that the page loads and doesn't
> completely fall apart. This is a page to be viewed on a desktop."
> — [01:53]–[02:24]

Not a bug — a scoping decision that shapes the fixes below. On mobile,
Metrics only has to *survive* (load, basic tap); horizontal overflow /
truncation there is acceptable. Optimize the layout for the
pointer-equipped desktop case.

## Explanatory prose → hover

### F28 — Expose provenance/definitions on column-header hover  ·  M  ·  `[ ]`
> "we should be able to hover over some of these headers and see in a
> tooltip some of this information… maybe a little question mark, or
> hover directly over the label. We hover over 'placed', a little
> tooltip pops up that says this is what placed means… and this is how
> it's calculated. Weeks on farm — this is where that value comes from."
> — [02:24]–[03:42], reiterated for the layers table at [07:18]–[07:30]

Frames: `frames/0026_02-30.jpg`, `frames/0030_02-49.jpg`.
Replace the standing explanatory text with per-column tooltips on both
comparison tables. Each column header (`Metrics.jsx` header arrays at
`:153` etc.) gets a hover affordance — either the label itself becomes
the trigger or a small `?` sits beside it — surfacing the definition
**and** the data source ("projected from feed schedules", "needs a
weigh-in", "recorded on the processing day"). This is the strategy that
lets F29/F30 delete the prose.

### F29 — Trim the intro paragraph  ·  S  ·  `[ ]`
> "this little paragraph up here… I would rather have this text maybe
> disappear completely. 'The math runs on what's been captured' — that
> doesn't really need to be said, it's obvious. Where the data comes
> from is not useless to know, however there's a better way to do that
> [hover]." — [01:11]–[01:53]

Frame: `frames/0013_01-11.jpg`. `Metrics.jsx:63–67`.
Cut "The math runs on what's been captured" (self-evident). The
provenance half ("weigh-ins and egg counts come from… feed is projected
from…") migrates into the F28 tooltips rather than sitting as body copy.
Likely removes the `<p>` entirely.

### F30 — Footnote repeats the feed-projection note  ·  S  ·  `[ ]`
> "we see feed eaten and cost are projected from feed schedules. So
> that's a bit redundant." — [00:24]–[00:30]

Frame: `frames/0005_00-24.jpg`. The under-table footnote
(`Metrics.jsx:191–194`) restates "Feed eaten and cost are projected from
the feed schedules," which the intro paragraph already says. With F28's
tooltips carrying this, drop the redundancy from the footnote.

## Table content

### F31 — "Weeks on farm" should be human-readable, not a decimal  ·  S  ·  `[ ]`
> "having a decimal to represent weeks on the farm is not the play. This
> would be much more useful if it said three weeks one day. Converted
> into a human-readable timestamp. For calculation we still want a
> decimal, but in this comparison chart it doesn't make sense."
> — [02:54]–[03:18]

Frame: `frames/0031_02-54.jpg`. `Metrics.jsx:172`
(`r.weeks.weeksOnFarm.toFixed(1)` → e.g. `3.1`). Render as
`3w 1d` / "3 weeks 1 day" in the cell; keep the decimal for any
sorting/derived math. Same treatment likely wanted for "weeks left."

### F32 — Tables overflow at 1440px with no "more →" affordance  ·  M  ·  `[ ]`
> "I can see from that one cut-off character that this table scrolls…
> there's no visible scroll bar and it's only overflowing by a small
> amount… when we're overflowing it needs to be more obvious that there
> is more data over here. This is 1440 wide and we're still seeing it
> get cut off — it should be representable in 1440 without being cut
> off." — [03:42]–[04:35], layers table same issue [09:08]–[09:30]

Frames: `frames/0044_04-16.jpg`, `frames/0046_04-30.jpg`,
`frames/0088_09-08.jpg`. The comparison tables sit in
`Metrics.jsx:335` `overflow-x-auto`; the rightmost column (`CUTS
ORDERED`) clips with no scrollbar/fade to signal it. Two parts: (a) add
a visible overflow affordance (edge fade / shadow / "→ more"), and (b)
tighten the layout so the full column set fits ~1440 (see F33/F34).

### F33 — Reclaim horizontal room: sidebar width + dead vertical space  ·  M  ·  `[ ]`
> "I suspect this sidebar is cutting into the available space a little
> bit. If we look at the sidebar there's a good amount of negative space
> in the middle that can probably be eliminated, which would buy us back
> some room." — [04:42]–[04:54]

Frames: `frames/0048_04-42.jpg`, `frames/0050_04-54.jpg`. The left nav
has loose vertical gaps between groups and a fixed width that eats into
the content pane. Tighten the group spacing and/or trim the sidebar
width so wide tables (F32) get more room. (Cosmetic-but-global — the nav
shows on every screen.)

### F34 — Confirm/raise the main-pane max-width cap  ·  S  ·  `[ ]`  ·  *verify*
> "our container limits, if any exist… the width of this main pane area
> — I don't know if I made the window larger whether it would stay
> capped here. That is a UI problem that should be resolved."
> — [05:00]–[05:13]

James suspects the content pane is max-width-capped, so a wider monitor
wouldn't help the overflowing table. Verify whether the app shell caps
main-pane width; if so, let data-dense desktop pages (Metrics) opt out
of the cap or widen it. Pairs with F32.

## Navigation (cross-cutting)

### F35 — In-page back link climbs the IA instead of returning to the previous screen  ·  M  ·  `[ ]`  ·  *pattern*
> "this pattern is all over the place. We click into a batch, we get a
> navigation link up here, and it doesn't return us to the screen we
> just came from — it navigates up through the information architecture.
> That's not what we want. The back button should reflect the actual
> navigation path… if we also wanted an 'all broilers' button that could
> be present too, but the primary back should return to the previous
> screen." — [05:30]–[07:09]

Frame: `frames/0057_05-36.jpg` (batch page header reads "← ALL
BROILERS"). The `BackToSpecies` link (`BatchPage.jsx:135, 309`) always
points to the species page, so arriving from Metrics and hitting it
dumps you on Broilers, not Metrics. Make the primary back honor history
(previous screen); optionally keep a secondary explicit "All broilers"
link. Flagged as an app-wide pattern, not just this page. (Note: the
*browser* back button did work — "[09:17] it'll take me back to the
right place" — so this is specifically the in-app back/breadcrumb link.)

## Layers / flock comparison

### F36 — Flock comparison should roll up to the coop/cohort, not the flock  ·  L  ·  `[ ]`  ·  *design*
> "the layers, like the broilers, cohabitate. We have no-bands,
> blue-bands and orange-bands all living together, so they're aggregated
> — we can't differentiate which batch laid an egg. The real comparison
> isn't between flocks, it's among roommates — laying cohorts, or
> mobile-coop to mobile-coop. That's the unit we measure food
> consumption and egg production on, regardless of flock… this
> information needs to roll up into the group level." — [07:50]–[09:08]

Frames: `frames/0078_08-07.jpg`, `frames/0082_08-30.jpg`. The table rows
by individual flock (No/Blue/Orange bands), but co-housed flocks share
one mobile coop and can't be measured apart — so the comparison unit
should be the coop/laying-cohort (the [[sites-concept]] mobile-coop
instance), with co-located flocks aggregated into it. James notes
they'll *try* for one-batch-per-coop going forward, but mixed coops will
persist for a while, so the roll-up is needed. Likely a metrics
data-model change (`src/lib/metrics.js`) — scope at triage.

### F37 — Drop the "8 batches" / "4 flocks" count labels  ·  S  ·  `[ ]`
> "we've got eight batches and four flocks — I don't know how valuable
> that information is. It's kind of just adding extra text to the UI that
> doesn't need to be there. That could be eliminated." — [07:37]–[07:50]

Frame: `frames/0073_07-37.jpg`. Remove the top-right count chips on both
comparison cards.

## Metric definitions

### F38 — Definitions section needs hierarchy / design attention  ·  S  ·  `[ ]`  ·  *design*
> "our metrics definitions — this is very good information to have, I
> like this. I think it could be slightly better organized in the UI
> here, a little more hierarchical. I don't have a great suggestion yet,
> it could just use some design attention." — [09:38]–[10:00]

Frame: `frames/0092_09-38.jpg`. The definitions registry
(`Metrics.jsx:281–287`, `useMetricDefinitions`) reads as a flat list;
give it grouping/hierarchy. No concrete spec from James — a design pass.

## Confirmed working — Metrics (clip 4)

- Clicking a batch row opens the correct batch page: "we click on the
  batch and we open up the batch — that is accurate." — [05:20].
- Metric definitions *content* is valued: "very good information to
  have, I like this." — [09:38].
- Browser back button returns to the right place from a batch.
  — [09:17].

---
---

# Clip 5 — Metrics (continued): definitions, targets, mortality

Source: `walkthrough-5-2026-06-04.mov` (3:27, 30 segments).
Processed: `audits/2026-06-04/processed/walkthrough-5-2026-06-04/`.

Scope of this clip: James stays on the Metrics page and refines a few
clip-4 calls — the comparison-card count chips, the two-column
definitions layout, how target bands are shown — plus flags a real
metric-correctness concern about layer mortality.

## Comparison cards

### F39 — Turn the count chip into a "Metric definitions" link  ·  S  ·  `[ ]`  ·  *refines F37*
> "rather than saying eight batches and four flocks, I think this right
> here could be a link to the metric definitions for broilers… we click
> on a link here that says metric definitions, or go to metric
> definitions… that should just scroll us right down the page to the
> broiler definitions." — [00:11]–[00:35]

Frame: `frames/0004_00-16.jpg`. The top-right chip is the Card
`subtitle` — `${rows.length} batch…` (`Metrics.jsx:146`) and
`${rows.length} flock…` (`:228`). F37 (clip 4) said *drop* these;
James now refines: instead repurpose each into a "Metric definitions →"
link that scrolls to the matching subsection of the definitions card
(broiler batches vs. layer flocks). Implies giving those two
definition columns anchor ids/refs to scroll to. Reconcile with F37 at
triage — this supersedes it.

## Metric definitions layout

### F40 — Stack the two definition columns vertically  ·  S  ·  `[ ]`  ·  *refines F38*
> "that would probably warrant the elimination of two columns here…
> Or you could still have two columns, but it would still be vertically
> separated so that you'd have broiler batches and their information
> first, and then below that you'd have layer flocks and their metric
> definitions." — [00:35]–[00:54]

Frame: `frames/0016_01-24.jpg`. The definitions card
(`Metrics.jsx:287`+) renders **Broiler batches** and **Layer flocks**
side by side as two columns. James wants them stacked — broilers first,
layers below — so each species' definitions read as one vertical block.
Pairs with F38 (definitions need hierarchy/design attention); this is
the concrete layout direction for that pass.

## Mortality correctness

### F41 — Layer mortality is computed per-flock; should roll up to the cohabit group  ·  ?  ·  `[ ]`  ·  *bug*
> "the mortality percent is the cumulative losses logged on the flock
> divided by the hens placed. This should actually be based on the
> global, the cohort, the group, the cohabit group." — [01:18]–[01:30]

Frame: `frames/0016_01-24.jpg`. The definitions card itself shows the
inconsistency on tape: **broiler** Mortality reads "Cumulative losses
logged on the **cohort** divided by birds placed," but **layer**
Mortality reads "Cumulative losses logged on the **flock** divided by
hens placed." Two things to fix together: (a) the layer mortality
*computation* in the flock-comparison table (`Metrics.jsx` flock
`rows.map`, MORTALITY column ~`:249`) should use the cohabit-group
denominator, not the single flock; (b) the seeded definition text
(`metric_definitions`, migration 0023) must match. Direct continuation
of F36 (flock comparison should roll up to the coop/cohort). Note: the
definition-text change is a **new additive migration** — parked for
James's return (prod), not done unattended.

## Target bands

### F42 — Move target bands behind an info icon, not floated inline  ·  S  ·  `[ ]`  ·  *design*
> "these targets are nice to have in here. I don't like how they're
> being incorporated into the UI, because it's just a little awkward. I
> would rather see something like… a little eye icon, like a little info
> icon… info, pasture-raised target is blah, blah, blah." — [01:38]–[02:10]

Frames: `frames/0019_01-45.jpg`, `frames/0022_02-10.jpg` (he pulls up
the Lucide `info` icon as the reference). `d.targetNote` is rendered as
right-floated green text — `text-[11px] text-accent-deep ml-auto`
(`Metrics.jsx:307–310`). James likes the *content and the green*, just
not the floated placement; surface it behind a small info/eye icon next
to the metric name that reveals the band on hover/click. Keep the
`text-accent-deep` green.

## Confirmed working — Metrics (clip 5)

- The green target text itself: "I like the small green text though,
  that's good." — [02:23]. (His objection is placement, not the text.)
- Targets are wanted: "these targets are nice to have in here."
  — [01:38].
- The rest of the metric data: "All the other information seems pretty
  good." — [01:30].

## Non-findings (retracted on tape)

- More-verbose FCR unit labels ("lb feed / lb gain"): he floats making
  them wordier, then talks himself out of it — "Not that here though,
  that's going to become hard to follow and make things cluttered. So
  we can stick with what we've got for now." — [02:30]–[03:13]. No
  change.

---
---

# Clip 6 — Schedule: day/week/month/agenda + New Event

Source: `walkthrough-6-2026-06-04.mov` (10:18, 96 segments).
Processed: `audits/2026-06-04/processed/walkthrough-6-2026-06-04/`.

Scope of this clip: a thorough pass over the Schedule page — the four
views (day/week/month/agenda), their filters, event/chore-block
rendering, the gold dot, drag behavior — and the New Event form, ending
on a meaty IA question about Locations. Source mostly in
`src/pages/Schedule.jsx` + `src/components/CalendarViews.jsx`. Whisper
mis-hears "chore blocks" as "tour blocks" throughout — same thing.

## Views & filters

### F43 — Make the agenda window configurable  ·  S  ·  `[ ]`  ·  *feature, low-pri*
> "next 12 months, huh?… It would be better if this was configurable,
> this window, so you could scope the amount of time you're seeing…
> that would be a low priority feature." — [00:07]–[00:30]

Frame: `frames/0002_00-07.jpg`. The agenda header label is hardcoded
"Next 12 months" (`Schedule.jsx:369`), but the range it actually builds
is "today → +3 months" (`Schedule.jsx:115`). Two things: (a) let the
user scope the window, (b) **verify** the label/range mismatch — the
label says 12 months while the code windows 3. James himself tags this
low priority.

### F44 — Shrink the filters into a compact dropdown  ·  M  ·  `[ ]`  ·  *design*
> "it could be a slightly smaller filters pane here, like if we laid
> these out, sort of like they were before, but just in a pane that
> drops down… rather than having them all stacked up vertically here
> and then having all this wasted space." — [02:06]–[02:20]

Frame: `frames/0017_01-48.jpg`. Expanding "Filters" opens a full-width
pane with the kind checkboxes stacked vertically + "UNCHECK ALL", which
pushes the calendar far down and leaves dead space. The collapsible
FiltersBar (`Schedule.jsx:431`+) should lay the kinds out as a compact
chip grid in a dropdown/popover, not a tall full-row pane.

## Day view

### F45 — Day view needs a design pass: click-to-create + cursor unclear, chore blocks inert  ·  M  ·  `[ ]`  ·  *design*
> "Day, this one is not really doing it for me… I would like this to be
> a little bit more user-friendly… more interactive… It's not clear to
> me that [a new event] was going to happen when I clicked on this, nor
> is it clear why my cursor is a plus button. I can't interact with any
> of the chore blocks from here. It's a little bit clunky." — [00:37]–[01:54]

Frame: `frames/0009_00-52.jpg`. Three concrete gripes on the day grid:
(a) clicking empty space creates a New event (`onCreateAt`,
`CalendarViews.jsx:14`/`DayColumn`) but nothing signposts that; (b) the
`+` cursor is unexplained; (c) the MORNING / MID-MORNING chore-block
bands are `pointer-events-none` (`CalendarViews.jsx:558`) so they can't
be clicked. Wants the day view to read as interactive and self-
explanatory. (He does credit it: "does a decent job of showing what we
have planned" — [01:42], see Confirmed working.)

## Events & chore-block rendering

### F46 — "Today" highlight is gray, reads as disabled  ·  S  ·  `[ ]`  ·  *design*
> "the current day is gray makes me feel like it's disabled or
> something, so I would like this indication to be more like… a brighter
> color outline." — [02:37]–[03:00]

Frame: `frames/0025_02-37.jpg`. Today is rendered as a gray fill —
header `isToday ? "bg-surface-alt"` (`CalendarViews.jsx:416`), day
column `isToday ? "bg-row-active-dim"` (`:549`), and the MonthCell
`isToday` tint. Gray reads as inactive; switch to a brighter accent
**outline/ring** instead of a dim fill. (Same gray-as-disabled theme as
F52.)

### F47 — The gold dot on events is unexplained  ·  S  ·  `[ ]`  ·  *clarify*
> "I'm not sure what this yellow, this gold dot is on here… this 3am
> batch two processing… there's actually a gold dot in here too. Does
> that have something to do with these automations?… it's not really
> explained." — [03:07]–[04:35]

Frames: `frames/0030_03-15.jpg`, `frames/0029_03-07.jpg`. The dot is the
`bg-warn` marker with `title="Overlaps a chore-block"`
(`CalendarViews.jsx:696`) — it means the event collides with a chore
band, **not** automation. (Automation events get a separate `Sparkles`
glyph, `:702`.) The `title` tooltip isn't discoverable; add a visible
legend/key on the Schedule, and make the dot and the Sparkles
distinguishable. His automation guess was wrong — that's the point.

### F48 — Invert the event hover: transparent by default, solid on hover  ·  S  ·  `[ ]`  ·  *design*
> "I like that this becomes a little transparent when I hover over it. I
> kind of would prefer the opposite behavior though, where you can see
> through this by default, and then if you hover over it… like hovering
> over a hyperlink… So I just know what's going to happen when I click
> it." — [03:30]–[04:00]

Frame: `frames/0033_03-35.jpg`. EventBlock is opaque with
`hover:opacity-90 transition-opacity` (`CalendarViews.jsx:678`). Flip
it: render events semi-transparent at rest and bring them to full
opacity on hover, so hover reads as the "this is what I'll click"
affordance.

### F49 — Drag-to-reschedule is too easy to trigger by accident  ·  M  ·  `[ ]`  ·  *discuss*
> "the hand makes sense because I know I can drag this around. I didn't
> want to though. In fact, I kind of feel like maybe you shouldn't be
> able to drag this stuff around because it's going to be easy to screw
> that up. I can leave that feature in for now though." — [04:00]–[04:30]

Frame: `frames/0038_04-08.jpg`. Drag-to-reschedule (`useDayDrag` /
`useGridDrag`, `CalendarViews.jsx:229`/`:324`) fires from the event
block; James worries about accidental reschedules of real, live events.
He parks it ("leave it in for now"), but flags: consider removing,
gating behind an explicit handle, or adding undo. Decision for triage.

### F50 — 5 AM band overflows the header; hour dividing lines are misaligned  ·  S  ·  `[ ]`  ·  *bug*
> "5 a.m. is overflowing into the header area. These lines are actually
> off slightly from one another. These dividing lines, I don't know why
> that's the case. So that I would like to see fixed." — [04:35]–[04:46]

Frame: `frames/0043_04-40.jpg`. Two layout bugs in the day/week rail
(`DayColumn`, rail/bands, `CalendarViews.jsx:466`+): the first band
(5 AM) bleeds up into the column header, and the hour rules don't line
up across the time gutter and the columns. Straightforward CSS/layout
fix.

### F51 — Chore blocks should carry more information  ·  S  ·  `[ ]`
> "the chore blocks, I would like them to be more valuable of
> information rather than them just saying morning or mid morning or
> whatnot." — [04:51]–[04:57]

Frame: `frames/0045_04-51.jpg`. Chore bands render only their band name
(MORNING / MID-MORNING / …) via `blockToBand` (`CalendarViews.jsx:477`).
Surface something more useful — e.g. the chore count or the chores
themselves — so the band earns its space.

## Month view

### F52 — Out-of-month days grayed reads as inactive  ·  S  ·  `[ ]`  ·  *design*
> "the day blocks of the week to also be slightly diminished in color so
> that it's obvious where in the schedule the next month begins rather
> than… why are these chores grayed out? Are they inactive?… the dark
> gray is not, in my mind, a good indicator of active, it's more of the
> opposite." — [05:07]–[05:43]

Frame: `frames/0050_05-21.jpg`. Month cells for the prev/next month are
dimmed gray (`buildMonthCells` / MonthCell `inMonth` styling,
`CalendarViews.jsx:762`/`:797`), which James reads as disabled. Rework
the month-boundary indicator so it's clearly "other month," not
"inactive." Same root reaction as F46 (gray == disabled).

### F53 — Month event titles truncate; want hover-to-expand  ·  M  ·  `[ ]`  ·  *design*
> "these titles are pretty hard to read… it would be better to see more
> at a glance… Maybe on hover, if these would overflow… the right edge
> of this right banner would unfurl and… allow me to read the whole
> title… in the case of one on the right edge of the screen, it would
> probably overflow outside of the window… we would need another way of
> handling that." — [05:50]–[06:34]

Frame: `frames/0089_09-00.jpg`. Event chips in month cells truncate
("9AM FOSTER FARME…", "4PM SUMMER MARK…"). Add hover-to-expand that
unfurls the full title, with an edge-aware variant (popover, not
clip-out-of-window) for cells on the right edge.

### F54 — Replace the "N chore blocks" bar with the actual blocks in sequence  ·  L  ·  `[ ]`  ·  *design*
> "five chore blocks, five chore blocks. Every single day… I don't think
> that's useful… on the week view it's definitely useful… instead of
> saying five chore blocks would actually put the chore blocks in
> sequence in each of these cells… interspersed with all the rest of
> these things… that would mean a lot of density… make each cell its own
> scrollable pane." — [06:40]–[08:14]

Frames: `frames/0065_06-45.jpg`, `frames/0073_07-30.jpg`. Every month
cell shows an identical beige "5 CHORE BLOCKS" summary bar (MonthCell,
`CalendarViews.jsx:797`) — noise, since chore blocks recur daily. James
wants the actual chore blocks rendered in time order inside each cell
(interspersed with events, like the week view already does), accepting
dense cells — possibly per-cell scroll. A real layout project, hence L.

## New Event form & Locations

### F55 — Locations (and event names) should be reusable entities for pre-fill  ·  L  ·  `[ ]`  ·  *design, needs James*
> "it would be very convenient to capture the locations and addresses…
> so that they can be easily pre-filled a second time. Same thing with
> event names… For instance, Warwick City Hall Plaza. That should be an
> entity of some sort… maybe it's the location… or its own top-level
> entity… a location like a customer might have locations, events have
> locations… trying to figure out how it ties into the overall
> information architecture… I'd like some input from you on that."
> — [08:30]–[10:00]

Frame: `frames/0089_09-00.jpg`. Re-typing the same location/address and
event names on every new event is friction. James wants Locations to
become reusable, autofill-able entities and is explicitly asking for IA
input: is "Location" its own top-level entity, an attribute of events,
or shared with customers (who also have locations)? This is a
data-model + IA design conversation to have with him directly — do not
spec unattended.

## Confirmed working — Schedule (clip 6)

- Week and month views are in good shape now: "Month, this view works
  reasonably well now" — [00:30]; "Week, this is looking a little bit
  better" — [00:37]; and on week: "This is pretty much exactly what I
  was looking for, so that's good." — [02:00].
- Day view still conveys the plan: "it does a decent job of showing us
  what we have planned for a given day, so that's okay." — [01:42].
- "Today" navigation works: "click on today, that shoots us back… it
  does bring us back." — [02:30]–[02:37].
- The hover-fade interaction is liked (just wants it inverted, see F48):
  "I like that this becomes a little transparent when I hover over it."
  — [03:30].
- New Event form + recurrence work: "New event. So this all makes
  sense… Recurrence, this stuff works well, I've messed with it."
  — [08:14]; "in terms of the recurrence rules and all the data, that
  works for me." — [10:00]–[10:18].

---
---

# Clip 7 — Schedule: Agenda view (timeline, conflicts, chore blocks)

Source: `walkthrough-7-2026-06-04.mov` (9:30, 72 segments).
Processed: `audits/2026-06-04/processed/walkthrough-7-2026-06-04/`.

Scope of this clip: James drills into the **Agenda** view specifically —
the window/label mismatch, his vision of it as a continuous timeline,
the consolidated chore-block bar (again), a conflict-detection feature,
event-row label hierarchy, and a real automation bug on batch-arrival
events. Source: `AgendaView` / `AgendaDay` in
`src/components/CalendarViews.jsx:183`+ and the toolbar in
`src/pages/Schedule.jsx`.

## Agenda window & header

### F56 — Agenda label, window and event count don't agree  ·  S  ·  `[ ]`  ·  *bug*
> "54 events, Thursday June 4th to Friday September 4th. So that window
> does not correspond to what's displayed right here… if it's the next
> 12 months, the number of events needs to be a count of events in the
> date reflected by the window." — [00:05]–[00:37]

Frame: `frames/0023_03-42.jpg`. The toolbar says "Next 12 months"
(hardcoded `Schedule.jsx:369`) but the subheader reads "54 EVENTS …
JUNE 4 → SEPTEMBER 4" — the actual range is "today → +3 months"
(`Schedule.jsx:115–121`). The label is a stale constant; derive it from
the real `fromDate/toDate` (or fix to ~3 months) so label, window, and
count are internally consistent. Concrete evidence for the verify note
on F43.

### F57 — Re-imagine Agenda as a continuous unified timeline  ·  L  ·  `[ ]`  ·  *design*
> "I always sort of envisioned this as a unified timeline so that these
> colored lines would actually touch one another… useful because we'll
> be able to create branching… if we had the date label on the left
> margin and then the timeline creates a continuous line built of these
> colored segments, I would like that." — [00:37]–[02:47]

Frame: `frames/0013_02-30.jpg`. Today the agenda is discrete day cards
(`AgendaDay`). James's north star: dates pinned to the left margin, the
events forming one continuous vertical line of touching colored
segments (a timeline), which later enables "branching." A real redesign
of `AgendaView` — capture the direction, scope at triage.

## Chore blocks in Agenda

### F58 — Unroll the consolidated chore-block bar; hide empty blocks  ·  M  ·  `[ ]`  ·  *design*
> "the chore blocks being consolidated like this… I don't like this.
> Not nearly as valuable as seeing them like you can on day or week
> view… 'Five chore blocks starting at 5:14 running till 8:50 PM' — this
> is not useful information… These need to be unrolled every day into
> the five different chore block rounds. However… days with no early
> afternoon chores should not show an early afternoon chore block. It
> should be dependent on the day's chores." — [02:57]–[04:26]

Frame: `frames/0023_03-42.jpg`. The agenda renders one beige bar per day
— `{blockSummary.count} chore-block round…` spanning 5:14 AM–8:50 PM
(`CalendarViews.jsx:961`, `AgendaDay`). James wants it (a) unrolled into
the individual blocks (morning/mid-morning/…), and (b) **suppressed for
blocks with no chores that day** — `resolveDayBlocks`
(`CalendarViews.jsx:782`) should filter to blocks that actually have
chores. Agenda continuation of F54 (month) / F51 (richer blocks). He
also notes the 5:14 AM–8:50 PM range reads as all-PM and is confusing.

### F59 — Chore-block label: show chore count + assignee, not the word "CHORES"  ·  S  ·  `[ ]`
> "having the word chores over here doesn't really help at all. We could
> do a count of the chores… Maybe assignments… So if this said 'morning
> chores' and then I was assigned that morning, I would like to see my
> name and an icon over here… Maybe a count of how many chores exist in
> that block." — [04:30]–[05:00]

Frame: `frames/0023_03-42.jpg`. The right-side label is just "CHORES".
Replace with the band name + the chore count, and surface the assignee
(name + avatar/icon) when the current user is on that block. Direct
continuation of F51.

## Conflict detection

### F60 — Conflict detection with a configurable minimum-gap threshold  ·  L  ·  `[ ]`  ·  *feature*
> "if this finishes at 8:59 a.m. and this next event starts at 9 a.m.
> that is too close and is going to be a conflict. There needs to be a
> visual representation when these conflict areas crop up… 8:59 is
> technically not later than 9, but there needs to be a threshold under
> which we consider the time too scarce… an option set in settings…
> a minimum amount of time allowed between two scheduled things… let's
> say 15 minutes. So now if this gap ever gets within 15 minutes… this
> needs to start glowing red and alert us." — [05:00]–[06:36]

Frame: `frames/0048_06-30.jpg`. Wants near-conflict detection: a
user-configurable minimum gap (a Settings value, e.g. 15 min) between
adjacent scheduled items; when the gap (including travel + setup time)
falls under the threshold the items glow red and alert. Distinct from
hard overlaps. Pairs with F25 (surface batch conflicts) and the
event-footprint/travel-time roadmap.

## Event rows

### F61 — Reverse the event-row label hierarchy: place over category  ·  S  ·  `[ ]`  ·  *design*
> "Scituate Rotary Farmers Market… Farmers markets at the Village Green.
> That's good. I think it should be reversed though. So that the Village
> Green is the prominent label and the event category is the less
> prominent label." — [06:42]–[06:55]

Frame: `frames/0023_03-42.jpg`. Each agenda row shows `kindLabel`
(FARMERS MARKETS) as the prominent right label and `location.name`
(Village Green) as the dim sub-label (`CalendarViews.jsx:1004–1008`).
Swap their emphasis — the place is what James scans for.

### F62 — Batch-arrival automation creates events with a bad/blank time  ·  ?  ·  `[ ]`  ·  *bug*
> "broilers batch five arrival. So there's no time associated with this
> event. In fact, there is. It's an inaccurate one. So that's a bug
> first of all that this automation is creating… This needs to be
> addressed so that these defaults make sense." … "The fact that no time
> shows up here is an indicator that there's some kind of a bug there.
> The fact this is divided… separated from the other items above it.
> That's a little confusing." — [07:07]–[08:28]

Frame: `frames/0064_08-30.jpg`. "Broilers — Batch 5 — arrival" (BATCH
MILESTONES, `Sparkles` = automation-created, `CalendarViews.jsx:991`)
renders with a blank time column yet carries an inaccurate underlying
time. The arrival automation should set an all-day/sensible default.
The "divided/separated" confusion is the in-day row divider placing the
no-time event apart from the timed events above it. Relates to F16
(undated events showing "All day · today").

### F63 — Dark-background event reads as an error; palette feels muted  ·  S  ·  `[ ]`  ·  *design*
> "this dark background color here… makes me feel like something is
> wrong with this item. I don't really like that. I would like it to
> just have a white background like the other events. In general, all of
> these colors seem like they're much more muted than I remember… We can
> refine that palette at some point." — [08:30]–[08:53]

Frame: `frames/0064_08-30.jpg`. Processing-days events render with a
dark/maroon fill that reads as an error state; James wants a white
background with just the category accent, like the other rows. Plus a
parked note: the whole category palette feels more muted than before —
a later palette refinement. Ties to F11 (zone color distinctness).

### F64 — Surface travel time on event rows  ·  M  ·  `[ ]`  ·  *feature*
> "summer celebration, marketplace/food trucks. This is fairly good
> information. I think we could potentially also have travel time
> reflected here. I think that would make sense." — [09:00]–[09:24]

Frame: `frames/0069_09-00.jpg`. Add travel time to the agenda event
rows. Feeds directly into the event-footprint / live travel-time
roadmap and the F60 conflict math (gap = travel + setup).

## Confirmed working — Schedule Agenda (clip 7)

- Agenda layout baseline is acceptable: "The layout is OK." — [00:37].
- The market events read well: "Scituate Rotary Farmers Market. That's
  good. Farmers markets at the Village Green. That's good." — [06:42];
  "summer celebration… This is fairly good information." — [09:00].

## Non-findings (retracted on tape)

- Em-dash → en-dash in event titles: he suggests an en-dash would save
  horizontal space, then immediately retracts — "I suppose the m-dash is
  fine." — [07:30]–[07:57]. No change.

---
---

# Clip 8 — Chores: Today tab (filters, blocks, Anytime, per-chore actions)

Source: `walkthrough-8-2026-06-04.mov` (8:24, 72 segments).
Processed: `audits/2026-06-04/processed/walkthrough-8-2026-06-04/`.

Scope of this clip: "a very important part of the site" — the Chores
**Today** tab. The header date, the person/Mine/All filter, the
jump-link strip, the "Anytime" bucket mis-filing automation chores, and
a wishlist of per-instance chore actions. Source mostly
`src/pages/Chores.jsx`. (Whisper hears "Chores" as "Chorus".)

## Header

### F65 — Show the date as a large bold header, like the Now screen  ·  S  ·  `[ ]`  ·  *design*
> "Thursday, June 4th, 2026 here is just… not really necessary. It says
> today, right here. I would prefer it to say the date up here, like it
> does on this now screen… this large text right at the top gives you
> the date. For the today tab in Chores, it should do the exact same
> thing… and we don't need the year specified." — [00:07]–[00:42]

Frame: `frames/0004_00-22.jpg`. The Today tab shows a small plain
`dateLabel` (`Chores.jsx` TodayTab, `today.toLocaleDateString`). Match
the Now screen: render the date as the big bold page header, drop the
year, and drop the redundant small "today" label.

## Person / scope filter

### F66 — Collapse Mine/All + person picker into one assignee dropdown (multi-select)  ·  M  ·  `[ ]`  ·  *design, low-pri*
> "by default, all should be selected… a better control would be to just
> eliminate mine altogether, and have this be a single dropdown toggle…
> the default option would be all, and then… pick James, Jim, or all…
> if there were more than two of us… a checkbox implementation so… I
> want to see Mo and Curly's chores… It may be worth implementing that
> pattern now, just so it's baked in, but it's not super high priority."
> — [00:49]–[01:55]

Frame: `frames/0010_01-00.jpg`. Today the toolbar has both a `UserPicker`
dropdown **and** a separate `Mine`/`All` toggle (`Chores.jsx:278–279`,
`USERS = ["James","Jim"]` `:56`). Fold them into one assignee control:
default "All," dropdown to pick a person, and a multi-select checkbox
list so 2+ farmhands can be shown at once. James flags it baked-in-now
but low priority.

## Jump-link navigation

### F67 — Make the block jump-links a scroll-spy  ·  M  ·  `[ ]`  ·  *design*
> "they're not filters, they're quick jump links, that's right. This is
> good, I like that. When we are jumping from one to the next, this
> should indicate which section we are currently in… commonly referred
> to as a scroll-spy component… as you start to scroll, you can see the
> active section you're currently in." — [02:00]–[02:43]

Frame: `frames/0010_01-00.jpg`. The MORNING / MID-MORNING / … pills are
`JumpNav` (`Chores.jsx:126`) — they scroll to a section but don't track
which is in view. Add scroll-spy: highlight the active block pill as the
user scrolls (IntersectionObserver against the section headers).

### F68 — Add a "back to top" button to the jump bar  ·  S  ·  `[ ]`
> "This jump bar also needs a to-top button included in it."
> — [06:07]–[06:16]

Frame: `frames/0010_01-00.jpg`. Add a top/up control to the `JumpNav`
strip so a long Today list can be scrolled back up in one click.

## "Anytime" bucket & automation chores

### F69 — "Anytime" mis-files time-specific automation chores; Brooder Cleanout needs a window recurrence  ·  M  ·  `[ ]`  ·  *bug + feature*
> "this Anytime section… this is not an Anytime task. There are rules
> around this Brooder Cleanout… it needs to work the same way that the
> power washing recurrence works — within a certain amount of time after
> the event is triggered… the birds have been moved out from the brooder
> last week, now you have up to the following Friday at sunset to
> accomplish the Brooder Cleanout… Move to pasture. This task is not an
> Anytime task either. This is a very specific time of day task."
> — [04:00]–[05:30]

Frame: `frames/0060_06-52.jpg`. The ANYTIME group (`blockKey ||
"anytime"`, `Chores.jsx:297`/`:349`) holds "Brooder cleanout — Batch 3"
and "Move to pasture — Batch 3" (both Sparkles = automation-created).
Neither is "anytime": Brooder Cleanout should use the **window
recurrence** that already exists for pasture chores (the "by sunset
Friday / 1 DAY LEFT" badges visible in `frames/0038_04-00.jpg`) —
event-triggered (birds moved out), due by the following Friday sunset.
Move to pasture is a time-of-day task. (b) is a real chore-definition +
automation change — additive, scope at triage; touches the protected
`chore_*` tables so **no unattended changes**.

### F70 — Let automation steps assign a target block to the chores they create  ·  M  ·  `[ ]`
> "this automation, these different things that have been created, we
> need to be able to assign a block arbitrarily to each of those
> automation steps in which they're creating chores and tasks. Now it
> says Anytime there." — [05:30]–[05:54]

Frame: `frames/0060_06-52.jpg`. Root cause behind F69: the lifecycle
automation creates chores with no block, so they fall to "Anytime." Give
each chore-creating automation step a block assignment. (Also the
"whole farm demo chores" inherit this.)

## Per-instance chore actions

### F71 — Clicking a Today chore should open its full detail, like All Chores  ·  M  ·  `[ ]`
> "if I click on one of these, I kind of would expect to see the full
> details of the chore… on All Chores… I can see the frequency, the
> start, all this good stuff. And if I edit it… you can see the
> recurrence rules… the full UI exists in this tab for chore. I think
> the same thing needs to be true of these chores as well."
> — [06:00]–[06:45]

Frame: `frames/0056_06-24.jpg`. The All Chores tab opens a full chore
detail (frequency / start / recurrence / edit); the Today rows don't.
Wire Today chore rows to the same detail/edit surface.

### F72 — Per-instance overrides on Today: re-time, delete/skip, reassign  ·  L  ·  `[ ]`  ·  *feature*
> "It would be useful to be able to edit these chores and override them
> on a specific basis. So let's say today… I needed to get this done by
> 7 p.m. no later. I would like to be able to click this, change that
> for this one task… Maybe we don't have to close the coops today. I
> would like to be able to delete this row by clicking the trash can…
> Changing assignment from myself to my dad. I want to be able to do
> that here." — [06:45]–[07:30]

Frame: `frames/0060_06-52.jpg`. Wants today-only overrides on each Today
row, without touching the recurring definition: change the deadline for
this one instance, delete/skip the row (trash icon), reassign to another
person. This is the `chore_modifiers` / per-instance override surface
(`useChoreModifiers`) exposed inline. Substantial — L.

## Data cleanup

### F73 — Delete the "Overnight brooder check" demo chore  ·  S  ·  `[x]`  ·  *data, parked*
> Done in Batch 41 (b0ff48f): both `demo_*` chores were dropped from the
> seeds and never existed as DB rows — no prod delete needed.

> "I do know that this demo chore needs to be completely deleted… The
> overnight brooder check, this was a placeholder demo. It has since
> been replaced by the process that wraps processing days. So this task
> does not need to exist as a demo anymore." — [07:43]–[08:24]

Frame: `frames/0060_06-52.jpg`. The "Overnight brooder check" under
WHOLE FARM ("Demo chore — peek at the brooders before sunrise") is a
leftover placeholder, superseded by the processing-days process. Remove
it. **Prod data + protected `chore_*` tables → parked for James; do not
delete unattended** (exact-id delete only, per the prod-delete rule).

### F74 — Question the "Whole farm" (place-less) chore concept  ·  —  ·  `[ ]`  ·  *discuss*
> "the whole farm, not tied to any one place. I'm trying to think of a
> situation where this actually is the case. I'm not sure I can think of
> any, but it doesn't mean it doesn't exist." — [07:30]–[07:43]

Frame: `frames/0060_06-52.jpg`. The "WHOLE FARM — not tied to any one
place" group (`Chores.jsx:493`/`:907`) currently only holds the demo
chore from F73. James can't think of a real place-less chore. Decide at
triage whether the bucket earns its place once the demo is gone.

## Confirmed working — Chores Today (clip 8)

- Tabs load correctly: "Chores, today, all chore blocks, performance,
  activity log. So that's correct… it's all working and loading."
  — [00:42]–[00:49].
- The jump links are liked: "they're quick jump links… This is good. I
  like that." — [02:00]. (Just wants scroll-spy + to-top, F67/F68.)
- Block rendering is good: "Morning starts at sunrise. Barn, one chore,
  fill water. Or brooders, six chores. Good. This is all good."
  — [02:43]–[02:50]; sticky notes "That is fine." — [02:50].
- Enclosures correctly filtered to occupied places: "filtered to the
  ones that are currently occupied, which is good. Pasture C shows up.
  Pastures A and B do not, because there are no chores there. That's
  correct, because this is the today page." — [03:36]–[03:56].

---
---

# Clip 9 — Chores: sticky notes, All Chores, chore form, gray theme

Source: `walkthrough-9-2026-06-04.mov` (11:00, 89 segments).
Processed: `audits/2026-06-04/processed/walkthrough-9-2026-06-04/`.

Scope of this clip: a glance at Do Rounds (declared a phone-only
surface), then deep into Chores again — sticky-note/comment bugs, the
All Chores tab sort modes, the chore edit + assignment-rules form, and a
firm cross-cutting complaint about dark-gray "active" backgrounds.
Source: `src/pages/Chores.jsx`, `src/components/ChoreMessageButton.jsx`,
`src/lib/data/useChoreMessages.js`, `AssignmentRulesEditor.jsx`.

## Sticky notes / comments

### F75 — Unify sticky notes with "Just a thought" into one comment/inbox system  ·  L  ·  `[ ]`  ·  *design*
> "this is not really the sticky note behavior. It has become a little
> diverged… we also have this 'just a thought' capture. It should be a
> single system. There should be a single inbox for all of these
> comment-based things… and if this is going to show a thread here, this
> UI needs to accommodate that — more than having this small modal
> that's going to resize as the comments grow." — [00:39]–[01:23]

Frame: `frames/0015_02-07.jpg`. The per-chore sticky-note popover
(`ChoreMessageButton.jsx`, `chore_messages`) has drifted from the
"Just a thought" capture (F6) and the Inbox (F7/F8). James wants one
comment/inbox substrate behind all of them (farm updates the lone
exception, deferred), and the thread surface to grow gracefully rather
than a small 320px resizing popover (`ChoreMessageButton.jsx:86`).

### F76 — Posting a sticky note creates a duplicate, in random order  ·  ?  ·  `[ ]`  ·  *bug*
> "if you spam that post button, it looks like it creates a duplicate…
> I just submitted '111' one time… it has shown up somewhere in the
> middle… I see two 111s in here. Something is wrong where these are
> being created too frequently… the fact that they are appearing at
> seemingly random is confusing. They need to be sorted in order of date
> posted." — [01:30]–[02:36]

Frame: `frames/0015_02-07.jpg`. Root cause: the local post path dedupes
by id (`useChoreMessages.js:75` — `prev.some(r => r.id === data.id)`)
and the POST button is guarded (`disabled={busy || !draft.trim()}`,
`ChoreMessageButton.jsx:140`), **but the realtime INSERT handler
prepends `payload.new` with no dedupe** (`useChoreMessages.js:20`). So
the optimistic insert + the realtime echo both add the row → a render
duplicate, and the prepend ignores `created_at` order. Fix: dedupe the
realtime INSERT by id and keep a stable `created_at` sort. **Verify**
whether real duplicate rows are also being written to the DB.

### F77 — Indicate comment count + unread/new on chore rows  ·  S  ·  `[ ]`
> "when there are comments on one of these chores, this should indicate
> how many comments there are… the UI needs to indicate that there's
> been discussion on this thing." … "we also need to have a visual
> indicator that there are unreads or new things here to review."
> — [02:36]–[02:54], [10:00]–[10:09]

Frame: `frames/0015_02-07.jpg`. The chore-message glyph
(`ChoreMessageButton.jsx`) doesn't show how many notes exist or whether
any are unread. Add a count badge (James floats red) and an unread/new
indicator so discussion is visible without opening each popover. (He
notes the top-bar notification badge debounces correctly — the inline
one is the gap.)

## All Chores tab

### F78 — "Time of day" sort should group into collapsible sections like "By place"  ·  M  ·  `[ ]`  ·  *design*
> "the time of day thing, I would like this to group together, just like
> 'by place' has the outline and the collapsing top level items. I would
> like time of day to do the same thing… This is the morning section,
> this is the mid morning section… Opening this up, this all looks good.
> This stuff is all very good." — [04:00]–[04:48]

Frame: `frames/0074_09-15.jpg`. The "time" sort
(`Chores.jsx:679`) correctly orders chores by block start time but
renders a flat list; the "place" sort (`:754`–`:767`) renders the nested
collapsible place-tree accordions James likes. Give "time" the same
treatment — collapsible outlined sections per block (Morning, Mid-
morning, …).

### F79 — "When" block dropdown must be sorted by time, ascending  ·  S  ·  `[ ]`  ·  *bug*
> "this 'when' dropdown always needs to be sorted by time in ascending
> order. So it starts with the earliest block and progresses earliest to
> latest. They shouldn't appear out of order like this." — [04:48]–[05:27]

Frame: `frames/0070_08-52.jpg`. The chore-form WHEN `<select>` maps
`activeBlocks` in storage/creation order (`Chores.jsx:1693`), so blocks
created later (early-afternoon, mid-morning) appear after end-of-day.
Sort the options by resolved block minutes ascending (the same
`resolveBlockMinutes` used by the time sort at `:686`).

### F80 — Drop the manual "Sort order" field  ·  S  ·  `[ ]`  ·  *discuss*
> "Sort order. I'm actually not sure what this means… I feel like there
> should be enough rules in place where we shouldn't be setting the sort
> order manually… that feels like it might not be necessary there."
> — [05:37]–[06:09]

Frame: `frames/0070_08-52.jpg`. The chore form exposes a numeric "Sort
order" input (`Chores.jsx:1407`/`:1720`, `sortOrder`). It's unexplained
and James doubts it's needed — ordering should fall out of block time +
rules. Decide at triage whether to remove it or document what it drives.

## Chore / assignment form

### F81 — Assignment section: typography signals the wrong hierarchy  ·  S  ·  `[ ]`  ·  *design*
> "this assignment subheading… 'Next seven days preview' and
> 'assignment rules' are nested under this assignment subheading, but
> the typography is indicating the wrong thing for the hierarchy. This
> seems like the stronger heading than this… either restyle the
> subheading throughout, or make it a little softer so it's clearly
> nested… or probably easier and better — simply eliminate the
> subheading and let 'next seven days preview' sit below 'assignment
> rules' without an explicit grouping heading." — [06:18]–[07:17]

Frame: `frames/0070_08-52.jpg`. The "ASSIGNMENT" parent label reads
weaker than the nested "ASSIGNMENT RULES (CHORE-SCOPE)" heading
(`AssignmentRulesEditor.jsx`). Fix the type scale so the parent
dominates, or drop the redundant "ASSIGNMENT" subheading entirely
(James's preferred option).

### F82 — Assignment-rule form is cramped + uses inconsistent controls  ·  M  ·  `[ ]`  ·  *design*
> "the days and assignees thing… there's not enough space there. I wish
> that was aligned slightly differently… better use of the space so
> these labels have a little more room to breathe." … "the animal field
> is this dropdown which is too wide… you have the radio buttons
> horizontally then this dropdown… this is not a radio button, it's a
> checkbox — having a label and then below it a series of checkable
> boxes might be a nicer UI pattern." — [07:17]–[09:00]

Frames: `frames/0070_08-52.jpg`, `frames/0066_08-20.jpg`. The DAYS /
ASSIGNEES rule editor is cramped (labels need breathing room + aligned
indentation consistent with the rest of the form). And the BELONGS-TO
scope mixes a too-wide "Animals" dropdown (`Chores.jsx:1564`+ radios at
`:1571`), horizontal radios, and a checkbox — unify on a "label + array
of checkable boxes" pattern.

## Cross-cutting color

### F83 — Replace dark-gray "active" fills that read as disabled  ·  M  ·  `[ ]`  ·  *design, cross-cutting*
> "this gray background color is used to indicate the active pane and I
> dislike this pattern. I would like it much stronger or more vibrant…
> still minimal — an outline around the pane, or if we tint it gray, a
> much lighter shade, because the dark color always makes me think
> disabled. And same is true for these 'one day left' labels and this
> active state. All of these dark gray background colors are not being
> used well." — [09:05]–[09:46]

Frames: `frames/0074_09-15.jpg`, `frames/0077_09-30.jpg`. The active-
pane gray fill, the "1 DAY LEFT" badges (`ChoreRemainingPill.jsx`), and
active states all use a dark gray that James reads as disabled. Move to
an outline or a much lighter tint / accent. This is the same reaction as
F46 (today highlight), F52 (out-of-month days), and F63 (dark event) —
worth a single design-system token decision applied everywhere.

## Confirmed working — Chores (clip 9)

- The thread popover scrolls the page to make room: "if the page scrolls
  up and it actually makes room to see that whole UI. So that's good."
  — [03:30].
- All Chores controls work: "search chores… working. Sort A to Z…
  working. Time of day… working. By place." — [03:40]–[04:00].
- "By place" grouping is the good pattern (the model for F78): "this all
  looks good. This stuff is all very good. The text here is a great
  explanation. I like that." — [04:42].
- Deadline-block default behavior is fine: "Deadline block. This is fine
  as well… if no deadline block is set, the latest possible deadline
  block should be midnight on the day of due." — [05:20]–[05:37].
- Next-7-days preview: "that is good and working well. I like it."
  — [09:00].
- Correct sticky notes now render: "the correct sticky notes showing up
  here which we are now seeing." — [09:55].
- A real chore reads well: "Fred in the high tunnel. Due today, that is
  good. I like the description." — [10:09].
- Blocks tab functionality: "This UI seems pretty good… functionality
  wise rock solid." — [10:19]–[10:42]. (Only the gray theme, F83,
  bugs him.)

## Non-findings / context (clip 9)

- **Do Rounds is a phone-only surface** — by design, not a bug: "this
  screen is specifically intended for use on a phone. There's not a
  situation in which this screen is useful on a desktop computer."
  — [00:10]–[00:20]. Don't optimize it for desktop.
- **Priority signal:** "It's really the today and all chores and block
  screens that are the most critical." Performance + Activity Log tabs
  are deprioritized — "I'm not super concerned about it at the moment."
  — [10:42]–[11:00].

---
---

# Clip 10 — Processes & Projects (domain model, step editor, expansions)

Source: `walkthrough-10-2026-06-04.mov` (11:00, 99 segments).
Processed: `audits/2026-06-04/processed/walkthrough-10-2026-06-04/`.

Scope of this clip: the **Processes** page (and the Projects concept).
James articulates the domain model and lands a big directive — *kill
"tasks" from processes; processes spawn chores* — plus a real expansion
bug, step-editor issues, and CRUD-pattern inconsistencies. Source:
`src/pages/Processes.jsx`, `src/lib/processes.js`,
`src/lib/data/useProcessRunner.js`, `src/pages/Projects.jsx`.

## Concept / model

### F84 — Add an explanatory intro to the Projects section  ·  S  ·  `[ ]`
> "Projects, we don't have any text up here to indicate what projects
> are meant to be. But projects are meant to be no more than groups of
> chores and tasks organized into a series… ad hoc, one-off or isolated
> from other recurring operations… a construction project… or literally
> 'throw away all the trash in the high tunnel'… a catch-all for stuff
> that takes an unknown amount of time, doesn't have a number of steps,
> isn't connected to a process." — [00:43]–[01:50]

Frame: `frames/0021_02-14.jpg`. Processes has an intro paragraph
(`Processes.jsx:34`); Projects (`Projects.jsx`) has none. Add the same:
Projects = the ad-hoc / one-off bucket of chores + tasks not tied to a
recurring operation. (This definition is itself a useful triage
artifact.)

### F85 — Kill "tasks" from processes; processes spawn chores only  ·  L  ·  `[ ]`  ·  *model*
> "processing day doesn't belong in [Projects]… tasks should not even be
> an option… by their very nature, events and the work related to them
> are recurring… it is still a chore, just one that only occurs one time
> when the event is triggered. So I want to kill the concept of tasks
> entirely from processes. Processes spawn chores, not tasks. Tasks
> belong to the bucket of projects, and they're not created by
> automation unless by event automation." — [01:50]–[03:50]

Frame: `frames/0057_06-14.jpg`. Today a process step has `kind: "task"`
or `kind: "chore_modifier"` (`Processes.jsx:257`/`:265`), and a "task"
becomes a one-time chore (`:275`, intro copy `:34–35`). James's
directive: drop the "task" concept from processes entirely — every step
is a chore (prep chore / follow-up chore / chore change). Rename the
step type + the "+ Task" affordance + the intro/help copy accordingly.
Tasks remain only in Projects. This is a model + terminology change
(touches `process_steps` / seeds) — large; scope carefully at triage,
**no unattended schema changes**.

## Chore-change step editor

### F86 — Chore-change picker should be searchable + scoped to day/animal  ·  M  ·  `[ ]`
> "'pick the chore to change'… this is a list of all chores… it
> shouldn't be all chores… it needs to be the chores for the day based
> on the value I've set (one day before the event)… it would be great if
> we could search rather than pick out of a list… the chore I want to
> change is fill feeders for broilers in particular." — [04:00]–[05:30]

Frame: `frames/0057_06-14.jpg`. The "Fill feeders" picker in the
chore-change row (`Processes.jsx` step editor, `isModifier` branch
~`:313`+) is a flat full-chore `<select>`. Make it a searchable
combobox scoped to the chores relevant to the step's offset day and the
process's animal association (F87) — not every chore on the farm.

### F87 — Processes need a species/animal association  ·  M  ·  `[ ]`  ·  *model*
> "Processing days have a specific animal association, which isn't
> reflected here… the only things we're processing are broilers at the
> moment… knowing it's broilers means we know we need to stage crates…
> 'pull feed from the birds' — which birds? the broilers, because
> they're associated with this event." — [05:30]–[06:14]

Frame: `frames/0057_06-14.jpg`. Give a process an animal/species
association (processing-day = broilers) so steps can say "the broilers,"
scope the F86 chore picker, and drive species-specific prep (stage
crates, pull feed from the right birds). Model attribute on the process.

### F88 — Sort process steps by their day-offset, not creation order  ·  S  ·  `[ ]`  ·  *bug*
> "we also want a button to re-sort these steps in order of days
> ascending… I hate when things are created in the UI sequentially and
> there's an obvious ordering attribute that isn't leveraged because
> it's sorted by create date. This should be sorted by days-before."
> — [06:38]–[07:15]

Frame: `frames/0057_06-14.jpg`. Steps render in creation order though
each has an `offsetDays` (`Processes.jsx:322`). Sort by `offsetDays`
ascending (and offer a re-sort control). Same "leverage the ordering
attribute" theme as F79/F80.

### F89 — Step offset needs days + hours + minutes  ·  M  ·  `[ ]`
> "this also is not granular enough. It's possible we might want to
> modify a chore within hours, or maybe even an hour. So this needs to
> be days, hours, and minutes. All three of those increments should be
> reflected in this change UI." — [07:15]–[07:42]

Frame: `frames/0057_06-14.jpg`. The offset is whole-days only
(`offsetDays`, `Processes.jsx:322`/`describeOffset` `:329`). Extend to
days + hours + minutes so a step can be "12 hours before" rather than
rounding to a day.

## Expansions

### F90 — Process expansion conflates a specific event with every instance  ·  ?  ·  `[ ]`  ·  *bug*
> "processing day prep expanded for broiler processing day on July 14th.
> Why did that expand?… June 2nd was the first processing day event we
> had since this automation was added. So… it picked up that we had a
> single processing day coming up and then expanded all of the
> processing day event prep because it conflated the specific event with
> every instance." — [08:00]–[08:43]

Frame: `frames/0021_02-14.jpg`. The EXPANSIONS list shows one process
expanding for Jul 14, Jun 2, Jun 23 batches all "expanded Jun 2." The
expansion runner (`useProcessRunner.js` / `processes.js`) fired against
every matching instance instead of the single triggering event. Real
automation bug — investigate the matching/expansion query.

### F91 — Remove the redundant "Got it" / "Dismiss" buttons  ·  S  ·  `[ ]`
> "there isn't a real purpose to dismissing these… having an activity
> log down here is a useful thing to have, so we don't need a 'got it'
> button. Dismiss is the same thing as got it. There's no difference in
> behavior… I would like to see both of those buttons removed."
> — [08:50]–[09:22]

Frame: `frames/0084_09-15.jpg`. The expansion cards carry both "Got it"
(`Processes.jsx:474`) and "Dismiss" (`:477`) with no behavioral
difference. Remove both; let the activity log be the record.

## New-process CRUD

### F92 — "New process" should open a right-side drawer, not an inline accordion  ·  M  ·  `[ ]`  ·  *design*
> "when I click new process, I was expecting it to pop out from the
> right, like the other event — there's another CRUD UI that's a drawer
> that comes from the right. Now this one creates an open accordion…
> this accordion does not have the gray tinted background pane… lighter
> gray, like I was talking about. So this is better. I still think it
> needs some color to be more of an active/focus indicator, like a
> colored outline." — [09:30]–[10:18]

Frame: `frames/0088_09-47.jpg`. `createProcess` then expands the inline
`ProcessEditor` accordion (`Processes.jsx:43`/`:138`), inconsistent with
the right-drawer CRUD pattern used for events. Move to a right drawer.
(Credit: this editor already uses the lighter gray James prefers — it
just still wants a colored focus outline, per F83.)

### F93 — New-process name field shouldn't be pre-filled  ·  S  ·  `[ ]`
> "that text should not be filled by default. It should be a blank text
> field with a placeholder." — [10:18]–[10:25]

Frame: `frames/0093_10-18.jpg`. `createProcess({ title: "New process" })`
(`Processes.jsx:43`) seeds the literal title "New process." Create with
an empty title and show a placeholder instead, so the field doesn't need
clearing.

## Confirmed working — Processes (clip 10)

- The Processes intro + auto-expand behavior is correct: "processes are
  what turn events on the schedule into work… Active processes expand
  automatically when a matching event comes in the range. This is
  correct." — [00:30]–[00:43].
- The chore-change modifier model makes sense: "skip it, replace it, add
  instruction or tighten its deadline. That makes sense." — [07:48].
- The step editor autosaves on click-off (works; minor: no explicit save
  affordance): "I don't see any save button, so I'm just gonna click
  off, and that has saved." — [06:30].
- The new-process flow reads well: "Active, expand automatically for
  upcoming events. Okay, that's good… Steps, chore change. Yep, this is
  all making sense and looks good." — [10:30]–[10:57].
- The new editor already drops the dark gray pane: "this accordion does
  not have the gray tinted background pane… So this is better."
  — [09:56]–[10:06].

---
---

# Clip 11 — Projects: detail page, notes/markdown, linking, phases/steps

Source: `walkthrough-11-2026-06-04.mov` (18:56, 140 segments).
Processed: `audits/2026-06-04/processed/walkthrough-11-2026-06-04/`.

Scope of this clip: a long, thorough pass over the **Projects** feature
— the project detail header/status/dates, the markdown notes, the
"Linked to" model, and the phase/step editor — with a side-trip through
the Processes/Projects filters. Source: `src/pages/ProjectPage.jsx`,
`src/components/ProjectBits.jsx`, `ProjectStepModal.jsx`,
`src/components/Markdown.jsx`, `src/lib/data/useProjects.js`.

## Project header & status

### F94 — Move the project name into the page header (Now-style)  ·  S  ·  `[ ]`  ·  *design*
> "I would very much like to see this project heading change to… like
> we've got 'now · date' up here in the now screen… 'project · project
> name' in the lighter weight font, as opposed to seeing it here down
> below the all projects back button… This project label can go away
> once the project name is moved up to the header." — [00:47]–[02:28]

Frame: `frames/0024_03-14.jpg`. The name renders as a "PROJECT" eyebrow
+ bold title under the "← ALL PROJECTS" link (`ProjectPage.jsx:95`).
Promote it into the page header styled like Now ("project · name,"
lighter weight, F65); drop the now-redundant "PROJECT" label.

### F95 — Inline description: fix placeholder + stop the focus/blur hitch  ·  S  ·  `[ ]`  ·  *bug*
> "this placeholder text needs to read 'click to add a description.'
> Clicking on it causes the height of the line to increase and when you
> click out it shrinks again — you see the UI hitch down and then hitch
> back up, which I dislike. I would like that to stay consistently
> sized." — [01:50]–[02:21]

Frame: `frames/0024_03-14.jpg`. The `EditableText` description
(`ProjectPage.jsx:101–103`) placeholder is "Add a one-line
description" — change to "Click to add a description," and keep the
control the same height in read vs. edit so it doesn't jump.

### F96 — Project status is confusing and inconsistent with the date-derived state  ·  M  ·  `[ ]`  ·  *bug*
> "not started. What does that mean? In progress. Is it started now?
> This is based solely on the date… I do not understand what this is
> telling me." … "it does say in progress now [on the old page]. It says
> not started here. So… I'm not sure about that." — [02:30]–[03:00], [10:30]–[10:49]

Frame: `frames/0024_03-14.jpg` shows it on tape: the status dropdown
reads **In progress** while the box below reads **Not started**. There
are two notions of status — the manual `project.status`
(`ProjectPage.jsx:109`, STATUS_OPTIONS `:37`) and a date-derived label
(`:145`) — and they disagree. Pick one source of truth (or clearly
separate "scheduled state" from "manual status") so it's legible.

### F97 — Move the project date range up near the status  ·  S  ·  `[ ]`  ·  *design*
> "this date range could be moved up here to the status bar somewhere…
> move it out of this 'not started' box and up near the status, maybe
> below it." — [10:49]–[12:12]

Frame: `frames/0024_03-14.jpg`. The start→target dates live inside the
"Not started" progress box (`ProjectPage.jsx:156–162`). Relocate them
beside/under the status control as the project's shorthand date range.

## Notes & markdown

### F98 — Markdown list bullets don't render in the notes preview  ·  S  ·  `[ ]`  ·  *bug*
> "it doesn't look like our list items are rendering correctly though…
> the ordered and unordered lists, the bullets do not render."
> — [04:00]–[04:17]

Frames: `frames/0026_04-00.jpg`, `frames/0095_12-53.jpg` (tables render,
list lines don't). The shared `Markdown` component
(`ProjectPage.jsx:191`, `Markdown.jsx`) drops `<ul>/<ol>` markers —
likely a Tailwind preflight list-style reset. Fix the markdown/prose
styles so bullets and numbers show.

### F99 — Unify the save pattern; project notes keep Save *and* save on blur  ·  M  ·  `[ ]`  ·  *design*
> "why does that save with a save button?… this is just a simple edit in
> place and on focus loss it saves, whereas this has a full blown edit +
> save button. That's strange to be mixing those patterns… I'd like it
> consistent across the application… saving on focus in and out makes
> more sense… For the project notes here, I'd like the save button —
> keep it — but it should also save on blur. If I switch to the preview
> pane and don't click save, I still expect it to save." — [04:30]–[06:24]

Frame: `frames/0095_12-53.jpg`. The `BodyEditor` (`ProjectPage.jsx:320`)
uses an explicit Edit/Save while other fields autosave on blur. Settle
one app-wide convention (autosave-on-blur default); for the long-form
notes, keep the Save button *and* also persist on blur / pane switch.

### F100 — Extend markdown support to other text areas (not the phone note)  ·  M  ·  `[ ]`
> "that markdown supported text area, I want that in more places…
> process 'what this process covers' should support markdown… the chore
> description… the sticky note field… the 'just a thought' capture… any
> notes field like this should support markdown. In the do-round
> screens, this note field does NOT need markdown because markdown makes
> no sense on a phone." — [06:30]–[08:10]

Frame: `frames/0046_06-44.jpg`. Reuse the `Markdown` component +
editor in: process description, chore description, sticky notes
(`ChoreMessageButton`), and the "Just a thought" capture. Explicitly
exclude the Do Rounds note (phone surface).

## Filters & cross-cutting (Processes/Projects detour)

### F101 — "Add chore" button on All Chores is a no-op  ·  ?  ·  `[ ]`  ·  *bug*
> "did that say add new chores, not implemented in prototype? This
> button right here does not work in chores, all chores." — [07:00]–[07:20]

Frame: `frames/0049_07-10.jpg`. The "+ ADD CHORE" button on the All
Chores tab does nothing ("not implemented in prototype"). Wire it up or
remove it.

### F102 — Unify the multi-select filter UI; drop the circular dot  ·  M  ·  `[ ]`  ·  *design*
> "I would like these filters to match the same UI from the schedule…
> I like the formatting of these [processes] better than the filters in
> the schedule page… this checkbox list — this circular dot in the
> centers, that's not necessary." — [08:23]–[09:38]

Frames: `frames/0061_09-20.jpg`, `frames/0062_09-30.jpg`. Three filter
UIs (Schedule, Processes, Projects) differ; standardize on one
multi-select treatment (James prefers the Processes formatting) and
remove the unnecessary centered dot in the checkbox glyphs. Pairs with
F44.

### F103 — Define event-type colors on the type and cascade them  ·  M  ·  `[ ]`  ·  *model*
> "these colors [farmers markets, pop up events] need to be defined on
> the event types themselves and then cascade through everywhere these
> are used in filters." — [10:07]–[10:22]

Frame: `frames/0068_10-15.jpg`. Event-kind colors are repeated per
surface; make the kind the single source of color and cascade to
filters, calendar, and agenda. Pairs with F11/F63 (color system).

### F104 — Uniform control height + padding, app-wide  ·  M  ·  `[ ]`  ·  *design*
> "this 'in progress' dropdown is actually not the same height as these
> two buttons here, it's narrower. Those controls should all be a
> uniform height, and consistent around the entire application… this
> search box… I should expect that this and this are the exact same
> height and the padding inside is the same as well." — [11:23]–[11:55]

Frame: `frames/0024_03-14.jpg`. The status dropdown, the archive/delete
buttons, and the search box render at mismatched heights/padding. Define
a shared control height + interior padding token and apply it
everywhere. Pairs with F3 (search control).

## Linking

### F105 — Click the notes body to edit (not a separate Edit button)  ·  S  ·  `[ ]`
> "the edit, that is just a bit weird to have to click up there to edit.
> I think just clicking on this directly should take you to the edit,
> just like this works up here. It's following that same Trello
> pattern." — [12:12]–[12:30]

Frame: `frames/0095_12-53.jpg`. The NOTES block has an "EDIT" affordance
top-right; clicking the rendered body itself should enter edit mode, to
match the inline description.

### F106 — "Linked to": link to chores + assets, never events  ·  L  ·  `[ ]`  ·  *model*
> "we want to be able to link to chores. We absolutely do not want this
> to link to events — projects and events are orthogonally separate. We
> do want these to link to batches of animals, places, equipment…
> products, orders, feed, customers… suppliers, machinery, trailers,
> equipment. All of those should be linkable from a project." — [12:36]–[14:30]

Frames: `frames/0024_03-14.jpg`, `frames/0095_12-53.jpg`. The "Linked
to" copy says "events and chores," but James wants the opposite on
events: a polymorphic link to chores + farm assets (animals/batches,
places, equipment, products, orders, feed, customers, suppliers,
machinery, trailers) and **not** events. Update the copy + the linkable
entity set (`useProjects` link model).

### F107 — Add-link picker should be search-first, and links need behavior  ·  M  ·  `[ ]`
> "having a search interface here… I want to add a link and search
> directly here rather than seeing a gigantic list, so I could search
> for batch four and then its chores show up." … "once this chore has
> been linked, it doesn't seem like there's any behavior associated with
> that. So we should probably look into that." — [14:30]–[15:36]

Frame: `frames/0130_17-12.jpg` (a linked "CHORE Dump leftover feed").
Two parts: (a) the ADD LINK flow should be a search box, not a full
entity list (same pattern as F86); (b) define what a link *does* — right
now it's inert (and clicking one unexpectedly navigated away).

### F108 — File attachments have no storage backend  ·  ?  ·  `[ ]`  ·  *investigate*
> "attaching files, I'm not sure where the file attachment back end
> lives. That needs to be interrogated because I haven't set up any
> remote / cloud storage." — [15:36]–[15:49]

Frame: `frames/0024_03-14.jpg` (FILES · Attach file). Confirm where
`uploadAttachment` (`ProjectPage.jsx:228`) writes — there's no
configured remote storage. Investigate before relying on attachments
(Supabase Storage bucket?). Don't wire prod storage unattended.

## Phases & steps

### F109 — Make phases/steps inline-editable like All Chores  ·  M  ·  `[ ]`
> "I would love to see that stuff inline, editable, just like… all
> chores, this UI where we can click on these things and change some of
> them. I like that a lot. And I like for the project steps to work the
> same way." — [16:00]–[16:48]

Frame: `frames/0130_17-12.jpg`. Steps open a right drawer
(`ProjectStepModal.jsx`); James wants the All-Chores-style inline
click-to-edit rows instead (or in addition).

### F110 — One generic capability set on every project node  ·  M  ·  `[ ]`  ·  *model*
> "I would like this stuff to be applicable to the phase level as well…
> to this checklist item we can also add another checklist and add
> details, attachments, dependencies. This is the generic set of stuff
> every step needs, whether top-level or nested." — [16:48]–[18:14]

Frame: `frames/0130_17-12.jpg`. The step drawer already has assignees /
dates / details / checklists / attachments / dependencies. Make that
same set (plus **links**, F106) available at every node — phase, step,
checklist item, any nesting depth — and make phase names selectable/
editable. (Drag-and-drop reorder already works — keep it.)

### F111 — Completion should roll up  ·  S  ·  `[ ]`
> "if I mark that [checklist item] as complete, it should mark the step
> complete. And… when everything is marked complete, this should
> automatically toggle to complete." — [18:14]–[18:56]

Frame: `frames/0130_17-12.jpg` ("0/1 steps complete"). Completion should
cascade: checklist item done → step done; all steps done → phase done;
all phases done → project auto-completes (feeding F96's status).

## Confirmed working — Projects (clip 11)

- Status/archive/delete + one-line description + linked + files + phases
  scaffolding all present and sensible. — [00:08]–[00:38].
- Markdown notes with preview are wanted: "Notes. This is good. I want
  this, especially since it supports Markdown and preview." — [03:14]–[03:30].
- Multi-select filters work and read well (Processes formatting
  preferred): "this does allow for multi-select, which is good… I like
  the formatting of these better." — [08:23]–[09:20].
- The step editor's generic fields (assignees/dates/details/checklists/
  attachments/dependencies) are the right model — just want them
  everywhere (F110). — [16:00]–[18:00].
- Steps are drag-and-drop orderable: "this is a drag and drop interface
  too. Interesting. Good." — [17:45].

## Non-findings (decided on tape)

- In-app back button on the filter/detail context: James floats adding
  one, then decides against it — "maybe there shouldn't be a back button
  in that context, it may be confusing. The browser back button is the
  smarter approach." — [09:45]–[10:07]. Rely on the browser. (Cf. F35.)

---
---

# Clip 12 — Animals (Layers / Broilers / Sheep) + Feed schedules

Source: `walkthrough-12-2026-06-04.mov` (24:30, 195 segments).
Processed: `audits/2026-06-04/processed/walkthrough-12-2026-06-04/`.

Scope of this clip: the longest of the set — the species/group pages
(Layers, Broilers, Sheep), the batch detail page, and the Manage-feed
schedules. Big themes: the flock/cohabitation model for layers, feed
stages holding multiple feeds, free-choice consumption tracking, and a
lot of cross-cutting UI consistency. Source: `src/pages/SpeciesPage.jsx`,
`src/pages/BatchPage.jsx`, `src/components/BatchMetrics.jsx`,
`BatchStatePill.jsx`, `src/pages/FeedSchedulesPage.jsx`.

## Layers — flock / batch model

### F112 — Replace card "#N" numbering with flock/cohabitation status; name flocks  ·  L  ·  `[ ]`  ·  *model*
> "these no bands numbered… number one, blue number two… I don't know
> that that's necessary. It's just confusing… what we need to see is the
> cohabitation status… a flock is a group of chickens housed, managed
> and raised together… flocks are derived from their cohabitation… we
> don't need UI for creating flocks. We DO need UI for naming flocks
> because we've given them monikers… these three would be 'the oldies'…
> there's no reason to separate flocks from batches — flocks are just
> wrappers around batches." — [00:25]–[04:23]

Frame: `frames/0003_00-25.jpg`. The group cards show `#{group.ordinal}`
(`SpeciesPage.jsx:394–396`) and "Shares MC2 with…" notes. Drop the
ordinal numbering; surface the flock (derived from shared coop) as the
organizing concept; add inline rename of a flock's moniker (e.g. "the
oldies"); auto-assign every batch to a flock (even a solo batch in its
own coop); don't split flocks from batches with separate filters.

### F113 — Layer lifecycle: arrival only, plus a "move out" action  ·  M  ·  `[ ]`  ·  *model*
> "layers arrive… and they're with us until we downsize by selling or
> culling, or they live their natural life. There's no pasture move, no
> processing, no brooder cleanup for layers… we only need to care about
> arrival. And if there's an event that causes them to leave in a large
> group, we need a move out button… it should capture the nature of how
> they moved out — culled or sold." — [05:00]–[06:13]

Frame: `frames/0184_23-08.jpg` (the broiler lifecycle box — layers
should NOT show pasture-move / processing / brooder). For layers, render
only arrival + a "move out" action (cull / sold / downsize), writing the
batch's end date. Suppress the broiler-only milestones.

### F114 — Layer batches with no arrival date can't derive status  ·  S  ·  `[ ]`  ·  *data*
> "orange bands are on farm… I'm not entirely sure why… oh, they haven't
> [an] arrival date. That's why we don't know when these guys showed
> up." — [04:23]–[05:00]

Frame: `frames/0003_00-25.jpg` (No bands / Blue bands show ARRIVED
"Unknown"). Missing arrival dates make age/status indeterminate.
Backfill the real arrival dates (prod data — parked for James) and add a
UI affordance nudging when arrival is unset.

## Batch detail page

### F115 — Surface sample/weight logging in the Do Rounds active-round screen  ·  L  ·  `[ ]`  ·  *feature*
> "weigh-ins record a sample. This is a very, very useful bit of UI…
> this recording of a sample is actually a chore… it needs to get itself
> into the rounds UI somewhere… in the active round screen we need a log
> button… recording a sample, logging weight… a top-level button that
> doesn't require tapping into sub menus… we'll want to add other
> actions like logging temperatures… egg log… these also need to happen
> in the rounds." — [06:37]–[09:25]

Frames: `frames/0055_06-45.jpg`, `frames/0063_08-21.jpg`. The
"RECORD A SAMPLE" weigh-in UI (`BatchPage.jsx` WEIGH-INS) and egg log
are good but live only on the batch page. Add them as top-level actions
in the Do Rounds active-round screen (weight sample, egg log, extensible
to temperature) since these are recurring round-time chores.

### F116 — A batch-page link uses a non-site typeface  ·  S  ·  `[ ]`  ·  *bug*
> "they're in the mobile coop since this date. This is a link. This
> typeface looks different than everything else on the rest of the
> site… I wish it was uniform and matched." — [09:36]–[09:58]

Frame: `frames/0184_23-08.jpg` (WHERE · "Brooder 1 ↗"). The
place/"since" link renders in a different font from the rest of the app
(`BatchPage.jsx` WHERE block). Normalize to the site typeface.

### F117 — Reorder the batch detail page  ·  S  ·  `[ ]`  ·  *design*
> "this information could go up at the top… arrival date, its current
> enclosure or place where it lives… those two facts up at the top,
> followed by the production, followed by the weigh-ins and egg log, and
> then the chores for the batch down at the bottom makes sense."
> — [10:00]–[10:45]

Frame: `frames/0184_23-08.jpg`. Order the page: arrival + current
enclosure (top), then production/performance, then weigh-ins + egg log,
then chores-for-this-batch at the bottom.

## Feed schedules (Manage feed)

### F118 — Feed Schedules UI is bespoke; consolidate to the app pattern  ·  M  ·  `[ ]`  ·  *design*
> "the fact that there's an edit button rather than the ability to just
> click on one of these or having a pencil icon… layers, new schedule —
> this is an action link, a button not represented elsewhere. Nor is
> this hover state. This whole thing has been implemented without respect
> to any of the other existing UI. I really would like to consolidate
> the UI in a singular pattern." — [10:45]–[11:56]

Frame: `frames/0094_12-00.jpg`. The Manage-feed page uses bespoke "New
schedule" action links (`FeedSchedulesPage.jsx:52`), a pencil-edit
toggle, and one-off hover states. Bring it in line with the app's
standard inline-edit / drawer pattern (cf. F92, F99, F109).

### F119 — Reword the confusing feed-projection help text  ·  S  ·  `[ ]`
> "metered amounts project. Free choice and [free-choice] stages
> project… okay, that text is a bit confusing. Specifically this part. I
> know what it's saying." — [11:17]–[11:30]

Frame: `frames/0094_12-00.jpg`. The intro line "metered amounts project;
free-choice and TBD stages can't" (`FeedSchedulesPage.jsx:35`) is
confusing — rephrase so the metered-vs-free-choice projection
distinction reads plainly.

### F120 — Feed entries need product name + form attribute + supplier  ·  M  ·  `[ ]`  ·  *model*
> "'standard layer feed' is not really a good description. What it is is
> a layer pellet, 50 pound bag… the name should be the exact product
> name we're ordering. The fact that it's pelletized should be an
> attribute, whether pelletized or mash. And the vendor… should exist in
> our resources under suppliers — we should be picking those two values,
> at least the vendor from a list of existing vendors." — [12:00]–[13:30]

Frame: `frames/0094_12-00.jpg`. Model a feed as: exact product name, a
form attribute (pellet / mash), and a vendor picked from Suppliers
(`resources`). Rename the placeholder "Standard layer feed."

### F121 — A feed stage should hold multiple feeds  ·  L  ·  `[ ]`  ·  *model*
> "we don't need to add a stage. What we need is… within a stage,
> specify multiple different feeds… stage name 'layer feed ongoing'…
> it's layer feed. Same stage… add an additional feed: grit — a
> different feed, from somewhere else, costs a different amount,
> reflected separately… grit and oyster shell supplemented separately."
> … (broilers) "I want to specify feed for multiple different types of
> feed within the same stage." — [13:30]–[15:00], [18:12]–[18:30]

Frame: `frames/0094_12-00.jpg`. A stage currently names one feed
(`FeedSchedulesPage.jsx` StageRow/StageEditor). Let a stage hold
multiple feeds (main feed + grit + oyster shell), each with its own
vendor/cost, tracked separately. Applies to layers and broilers.

### F122 — "Fill feeders" chore should show the scheduled amount inline  ·  M  ·  `[ ]`
> "this fill feeders chore should say, if there's a feed schedule with a
> set amount of food, that amount should be represented right here on
> this fill chore… so I can see exactly what I'm supposed to be weighing
> out without referencing the schedule. If they're on free choice, it
> should say free choice." — [16:30]–[16:56]

Frame: `frames/0094_12-00.jpg`. Pull the stage's metered amount (or
"free choice") onto the fill-feeders chore row so the value is visible
at do-time without opening Manage feed.

### F123 — Free-choice feed-consumption tracking via 50-lb-bag logging  ·  L  ·  `[ ]`  ·  *feature*
> "free choice stages can't be projected. The feed page won't know to
> reorder from this stage… we're moving more birds to free choice soon…
> we'll have to have infrastructure for tracking feed consumption by
> weight… the easiest way… is to log when a 50 pound bag has been
> consumed… there should be a prompt down here to record when a 50 pound
> bag has been used up… logging those bags gives us a graph we can plot…
> extend that line, that gives us the projection." — [15:00]–[17:46]

Frames: `frames/0119_15-05.jpg`, `frames/0134_17-00.jpg`. Free-choice
feed can't be metered-projected, so add consumption tracking: a
round-time prompt to log an emptied 50-lb bag, accumulate the log, and
derive usage/cost/reorder projection from the consumption curve. Feeds
the reorder math the metered path already drives.

### F124 — Duplicate a feed schedule  ·  S  ·  `[ ]`
> "the ability to duplicate one of these would be a very useful feature
> to have… just the ability to duplicate is good." — [17:46]–[18:00]

Frame: `frames/0094_12-00.jpg`. Add a "duplicate" action on a feed
schedule (`FeedSchedulesPage.jsx`).

### F125 — Delete the sheep feed schedule  ·  S  ·  `[ ]`  ·  *data, parked*
> "the sheep… is on hiatus right now. We are not feeding them… we can
> just delete this. We're not going to support this anymore. Delete that
> outright." — [18:30]–[18:56]

Frame: `frames/0147_18-47.jpg`. Remove the sheep feed schedule — sheep
are on summer hiatus and won't be supported. **Prod data → parked for
James** (exact-id delete). Layers/broilers later confirm sheep "don't
need one at the moment." — [24:15].

## Animal-page chores, tags, tabs

### F126 — Animal-page recurring chores: group by block, editable, filter/search by tag  ·  M  ·  `[ ]`
> "chores, recurring chores… I like the tags in this UI… however, these
> need to be organized by time of day, by the blocks, just like on the
> Chores page. Everything collapsible… These are not editable here… I
> would like to be able to click on one of these or edit it, jump to an
> edit screen from here… these tags would also be nice if we could
> filter by them… and search by these tags." — [19:08]–[20:27]

Frame: `frames/0151_19-17.jpg`. The species CHORES tab
(`SpeciesPage.jsx` chores tab) lists recurring chores flat. Group them
by block, collapsible, with the Chores-page sort (F78); make each row
jump-to-edit; add tag filter + search.

### F127 — Escape key doesn't close the search overlay  ·  S  ·  `[ ]`  ·  *bug*
> "there's a bug. The escape key does not work. The escape key does not
> close this window… clicking out does." — [20:30]–[20:42]

Frame: `frames/0163_20-36.jpg`. The search/overlay only closes on
click-out; wire up Escape to dismiss it.

### F128 — Chore tags need unique colors + surfaced as filters  ·  S  ·  `[ ]`  ·  *design*
> "I would like these tags to each have a unique color, like our filters
> in the schedule, and the filters to be represented up here so we could
> look through them by specific category type." — [20:42]–[21:00]

Frame: `frames/0165_20-49.jpg`. Give chore tags distinct colors and
expose them as a filter strip. Pairs with F102/F103 (filter + color
system).

### F129 — Remove the "More info" tab from all animal pages  ·  S  ·  `[ ]`
> "that activity log, more info — we can kill this more info tab
> completely. We don't need this anymore. That's true for all of these
> groups. More info doesn't need to exist." — [21:00]–[21:22], [24:22]

Frame: `frames/0003_00-25.jpg` (the MORE INFO tab). Drop the "More info"
tab (`SpeciesPage.jsx:59`/`:94`, `MoreInfoTab`) from every species page.

## Broilers — batch state & metrics

### F130 — Color-code batch-state labels  ·  S  ·  `[ ]`  ·  *design*
> "I would like these labels to be different colors depending on the
> state that they're in. On-farm seems like it should be green. Arriving
> maybe a different color… but I would like it to be more visible."
> — [21:30]–[21:47]

Frame: `frames/0172_21-36.jpg`. `BatchStatePill.jsx` should color by
state — on-farm = green, arriving = a distinct, more visible color, etc.
Pairs with F103 (cascade from a defined palette).

### F131 — Restate "weeks remaining" / "week N of processing"; fix the gray box  ·  S  ·  `[ ]`  ·  *design*
> "weeks remaining… needs to be represented as days and weeks, not as a
> decimal… 'week four of scheduled processing' — that's an awkward
> sentence… I would like this to say… under the arrival date in this box
> (which I don't like the dark gray backgrounds)… it should say 'week
> [N]', whatever they're on, just like on the dashboard schedule at a
> glance." — [21:47]–[23:24]

Frame: `frames/0184_23-08.jpg` ("WEEKS REMAINING 2.7 · week 4 of
scheduled processing"). Show weeks+days not a decimal (F19/F31), restate
the awkward "week 4 of scheduled processing" as a clear "week N" age
under the arrival date (matching the dashboard schedule-at-a-glance),
and lighten the dark-gray lifecycle box (F83). `BatchMetrics.jsx`.

### F132 — Make the milestone (arrival/processing) links visibly clickable; drop "short"  ·  S  ·  `[ ]`
> "processing is a link, arrival is a link. Those need to be underlined
> or there needs to be some indication that those are clickable, maybe
> with a little arrow icon pointing away. The word 'short' does not need
> to exist here. Today is a reasonable thing to put down there."
> — [23:30]–[23:55]

Frame: `frames/0184_23-08.jpg`. The lifecycle milestone names open the
event editor (`BatchPage.jsx:25`/`:148`) but don't look clickable —
underline or add an external-arrow icon. Remove the stray "short" label.
Pairs with F2/F24 (link affordances).

## Confirmed working — Animals & Feed (clip 12)

- The card CSS-grid layout is liked: "our cards here with our layer
  groups… we're gonna follow the same UI pattern. The CSS grid looks
  nice." — [00:00]–[00:12].
- The batch owns its milestone dates; editing one moves the event: "the
  batch owns these dates. Editing one here moves the underlying event.
  That makes sense." — [06:06]–[06:13].
- The weigh-in "record a sample" UI itself is valued (just needs to also
  live in rounds, F115): "this is a very, very useful bit of UI."
  — [06:45].
- Recurring-chore tags read well: "these are good. I like the tags in
  this UI. This makes sense." — [19:17]. Broiler past-batches collapse:
  "collapsed group now. Great. These tags are good as well." — [21:30].
- Hover-for-definition wish recurs on the animal metrics (reinforces
  F28): "having the ability to hover over these labels to see more about
  what those metrics are would be useful." — [06:30], [24:00].

## Non-findings / cross-references (clip 12)

- Layer metric-label hover, broiler "weeks remaining" decimal, and dark-
  gray backgrounds are restatements of F28, F19/F31, and F83
  respectively — folded above, not new findings.
- Sheep page: "all the same things apply here that I was saying before"
  — F126 (chores), F129 (more info), F125 (no feed schedule). — [24:07]–[24:30].

---

---

# Chores-verification pass — new block-model chores (2026-06-04, eve)

Source: `Screen Recording 2026-06-04 at 10.49.14 PM.mov` (6:26, 62
segments). Processed:
`audits/2026-06-04/processed/chores-verify-2026-06-04/`.

Scope: a targeted re-walkthrough recorded after the Batch 41 chores
rebuild shipped — the top bar reads `v0.10.41-alpha`, so this is the new
bundle. James verifies the block model on `/now`, `/rounds`, and
`/chores`, confirms most of it works, and flags six follow-ups.
Findings continue from F132.

## Now page

### F133 — Collapse the Now overdue chore list by default  ·  S  ·  `[x]`  ·  *design*
> Done 2026-06-04 (commit 3a0477a): overdue list rolls up behind a
> warn-toned "N overdue" summary, expands on tap, like "N done today".

> "There's a ton of chores in here. By default, let's fold all of these
> items up. And if there's overdue stuff, let's show it collapsed just
> like 12 done today… let's roll it all up unless there's a good
> reason." — [00:13]–[00:30]

Frame: `frames/0003_00-13.jpg`. `src/pages/Now.jsx` renders the overdue
chore tree fully expanded — place group after place group (Mobile
Brooder, House, Cold Storage, Pasture C → Mobile Coop 1/2…). Collapse
the overdue section by default into a one-line summary (mirroring the
existing "12 done today" collapse) with click-to-expand drill-down.
Keep the same row styling.

### F134 — Clarify the per-chore-row iconography on Now  ·  S  ·  `[ ]`  ·  *design, clarify*
> "The iconography is a little bit confusing. It's not clear what these
> symbols represent." — [00:06]

Frame: `frames/0003_00-13.jpg`. Each row trails a cluster of small
glyphs (anchor / occupancy / assignee markers — e.g. the figures + sun
after "Fill feeders") whose meaning isn't legible at a glance. Add
tooltips or labels, or reduce to a single clear indicator. Pairs with
the F28 hover-for-definition theme.

## Rounds

### F135 — Rounds runner opens straight to a "DONE" screen and reads as broken  ·  ?  ·  `[ ]`  ·  *bug*
> "We're gonna start the rounds. Uncheck any chore, morning done. So
> this is weird… Start morning rounds. Okay, so this is not working
> anymore. There are no errors… none of these rounds screens are working
> at this point." — [00:44]–[01:22]

Frame: `frames/0010_01-00.jpg`. Launching the mid-morning round drops
straight onto the completion screen — "MID-MORNING DONE / 1:00:00 / Ran
12h 50m past the window / Un-checking any chore in this block will
reopen the run / CLOSE". Because every chore in the block is already
checked, `onAutoDone → endRun` (`src/pages/Rounds.jsx:231`) flips the
run to `done` the instant it opens, so there's no apparent way to *run*
it — it looks dead. The same flow worked later in the clip ([05:15]
"this one did work… not sure why"), so it's intermittent. The runner
should open in a runnable state (or make the done-screen obviously
re-openable) rather than a dead-end. Tightly coupled to F138.

## Chores

### F136 — Restore some indentation in the block → place chore nesting  ·  M  ·  `[ ]`  ·  *design*
> "We've got the morning main group directly positioned above the first
> sub item with no indentation. And the first sub item under barn
> positioned without any indentation either… visually it doesn't work,
> it's hard to parse. I'd much rather sacrifice the space, or use some
> coloration to… see where the parent items are." — [02:00]–[02:38];
> reiterated "the nesting, I'd like to see it reverted a little bit" —
> [06:12]

Frame: `frames/0018_02-06.jpg`. On Chores → Today the block header
(MORNING) and the top-level place group (BARN / BROODERS / PASTURES) sit
at the same left edge with no indent step, so the hierarchy
block → place → sub-place → chore is hard to read. Re-introduce an
indentation step per level and/or color/rule the parent rows. The
explicit ask is to trade the space-saving back for legibility.

### F137 — Surface chore meta (anchor, block, timeframe) on Today rows and every chore list  ·  M  ·  `[~]`  ·  *design, pattern*
> Partly done 2026-06-04 (commit bde196c): Today rows now show
> `describeChoreAnchor · block (time) · frequency`. Remaining: extend the
> same meta to the Now overdue rows and the species-page chore lists.

> "The today screen under Chores, each chore only has the name and the
> deadline and a message icon. All Chores on the other hand shows what
> the chore is related to, which group of animals, when it's supposed to
> be done, what block, and the timeframe for completing it. That
> information is important to surface on this today page and pretty much
> anywhere else where we have a list of chores." — [03:00]–[03:29]

Frames: `frames/0027_03-05.jpg` (Today, sparse) vs `frames/0028_03-11.jpg`
(All Chores, rich). All Chores rows carry a meta line — "Brooders ·
occupied · Mid-Morning (10 AM) · Every day" — while Today rows show only
the name + "by the next block" + comment icon. Render the same
`describeChoreAnchor` + block + timeframe meta on the Today rows, and
standardize it across every chore list (Now, Rounds, Species pages).

### F138 — Make Rounds start/stop/cancel conventional; one person ends the round for everyone  ·  L  ·  `[ ]`  ·  *design, bug*
> "When someone has joined a round of chores and one person wants to end
> those chores, one person needs to be able to end the chores for
> everybody… that's completely opposite of what I described initially,
> but… somebody's going to put their phone back in their pocket… The way
> we start rounds, cancel rounds, stop rounds, all of that UX doesn't
> feel very good… I'd like just the start and stop and cancel
> interactions to be more conventional… so that when you stop the round,
> the thing happens that you think is going to happen." — [04:20]–[05:58]

Frames: `frames/0042_04-30.jpg`–`frames/0056_05-52.jpg`. James reverses
his earlier multi-client design: ending a round should close it for all
participants from any one phone — it "doesn't have to play with state on
both clients," just be effective and predictable. Rework the
start/finish/cancel flow in `src/pages/Rounds.jsx`
(`startRun`/`endRun`/`finishRun`/`cancelRun`, the `ColdOpen` launcher,
and the done-screen) into conventional single-actor controls with
obvious outcomes. This is the headline ask of the clip; it subsumes
F135.

## Confirmed working — new block-model chores

- Deadline-by-next-block displays on the Today rows: "we've got our
  deadlines over here by the next block. That makes sense." — [01:45].
  (The Batch 41 block-deadline engine reads correctly.)
- The place-grouped block model renders end-to-end on `/now` and
  `/chores` — Cold Storage, Brooders, and Mobile Coops all present and
  populated (frames 0003, 0018, 0028).
- Overall: "that's pretty much all I've got for the new chores
  implementation. Seems to be working pretty well otherwise." —
  [06:19]–[06:26].

## Cross-references / parked (chores-verification pass)

- Schedule still shows "5 chore blocks" not interleaved — "same problem
  as I've done before… we'll address that down the road" — [01:30].
  Restates **F54** (replace the N-blocks bar with the blocks in
  sequence); not a new finding.
- Processes page still shows "tasks": "we can still see that tasks are
  in here… we're going to address this pretty soon" — [03:43]. Restates
  **F85** (kill tasks from processes).
