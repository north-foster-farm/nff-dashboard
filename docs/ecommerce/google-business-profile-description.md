# North Foster Farm — Google Business Profile Description

_Working doc. Drafts for the "From the business" section of the NFF Google Business Profile._

---

## The brief

Google asks for a brief description of the business that appears in the **"From the business"** section of the Business Profile.

**Info to include:**

- What you offer
- What makes you special
- How long you've been in business
- Anything else that's helpful for customers to know

**Things to avoid:**

- No URLs or HTML code
- Do not exceed 750 characters
- Focus on details about the business rather than promotions, prices, or sales

**Google's example:**

> We're an independent ice cream shop located steps from the center of town. We're proud to be the favorite for locals to meet friends for a cone or call for a fresh pizza, delivered straight to their home. We serve 35 flavors of homemade, hand-churned ice creams and sorbets year-round. The pizza oven turns out New York-style pies every day from midday until close. Come visit us today!

Reference: Google's guidelines for representing your business (support.google.com — Business Profile description guidelines).

---

## Draft A — plain and informative

**685 characters**

> North Foster Farm is a small family farm in Foster, Rhode Island, run by a father-and-son team. We raise chickens on grass: pasture-raised, non-GMO, moved to fresh pasture regularly, and never given hormones or antibiotics. We sell fresh eggs by the dozen alongside whole chickens, Cornish hens, boneless breasts, bone-in thighs, drumsticks, wings, and sausage. You'll find us every week at three Rhode Island farmers markets — Wednesdays in Exeter, Saturdays in North Scituate, and Sundays in Foster — plus pop-up events around Warwick through the summer. We also offer local delivery on Thursdays to towns across Rhode Island and eastern Connecticut. Come by the stand and say hello.

---

## Draft B — with more of the NFF voice

**731 characters**

> We're North Foster Farm, a family farm in Foster, Rhode Island. Our chickens live outside on grass, get moved to fresh pasture regularly, and eat non-GMO feed with no hormones or antibiotics. The hens are our hardest-working employees, though we only pay them minimum chicken wage. We offer fresh eggs by the dozen, whole chickens, Cornish hens, boneless breasts, bone-in thighs, drumsticks, wings, and sausage. Find us at three weekly Rhode Island farmers markets in Exeter, North Scituate, and Foster, at summer pop-up events around Warwick, and through local delivery on Thursdays across Rhode Island and eastern Connecticut. If you've never tasted pasture-raised chicken, come find out what you've been missing.

---

## Open item: how long you've been in business

Neither draft satisfies this requirement — there's no founding year on hand, either for the farm itself or for the point where it went from hobby farm to business.

| Draft | Length | Headroom to 750 |
|---|---|---|
| A | 685 | 65 characters |
| B | 731 | 19 characters |

Draft B's 19 characters is too tight to work anything in. Draft A's 65 characters would accommodate a sentence along the lines of "We've been raising birds here since 2019."

**Decision needed:** the year, and whether to date the business from the hobby years or from the commercial launch.

---

## Judgment call: which draft

Draft B's minimum-chicken-wage joke is very on-brand — it's a running bit in the website updates and sits squarely in the established NFF voice. But a Google Business Profile is often a customer's first-ever contact with the farm. The joke reads as charming to someone already inclined to like you, and slightly odd to someone who is just scanning for "do they have eggs."

- **Draft A** — safer first impression, information-forward
- **Draft B** — more distinctly North Foster Farm

---

## Notes for future revisions

- Both drafts avoid prices and promotions, per Google's guidance.
- Neither contains URLs or HTML.
- Market days and towns are included as customer-useful detail; if the market schedule changes seasonally, this description will need a refresh.
- Sausage is listed generically. Update if the lineup firms up or expands.

---
---

# Second treatment (Claude Code, 2026-07-28)

_A second pass over the same brief, working from the repo and the sibling
website repo rather than from chat memory. Everything below is additive —
Drafts A and B above are left untouched._

## How I worked

The first agent drafted from what it remembered about the farm. I went
looking for primary sources instead, which turned up three things that
change the drafts:

1. **`copy.html` is not lost.** The voice guide cites "28 versions of the
   homepage update copy, May 2024 – Feb 2026" as its source. That file is
   alive in the sibling repo —
   `/Users/james/Code/north-foster-farm/layouts/partials/home/copy.html` —
   with 29 commits of history. That's the farm talking in its own words
   across two years, and it settles several open questions.
2. **The pricing worksheet is the authoritative product list** —
   `docs/ecommerce/proposed-prices-summer-2026.md`.
3. **`src/data/nff-data.json` holds real husbandry facts** — breeds, flock
   counts, the pasture-raised threshold, where processing happens.

Sources consulted: the website repo's full `copy.html` history; the
pricing worksheets; `docs/ecommerce/markets-and-popups-2026.md`;
`src/data/nff-data.json`; `public/style-guide/voice-guide.md`;
`north-foster-farm/data/company.yaml` and `config/_default/hugo.toml`.

## What I found that changes the drafts

### 1. The founding-year question is answerable — 2024

The doc above calls this an open item. It isn't, quite. From the
2024-10-12 revision of `copy.html` (commit `67d9b23`), written at the
close of that season:

> "October 5th was the final day of the Scituate Rotary Farmers Market
> 2024 season. Thank you to everyone who stopped by our booth and **made
> our first farmers market experience so successful!**"

Corroborating: the website's initial commit is 2024-05-26, the launch
commit 2024-06-01, and `hugo.toml` carries `copyright = 2024`.

So **2024 is the first selling season**, defensible and documented. What
is *not* documented anywhere is any hobby-farm period before it — so if
James wants to date the farm earlier than the business, that number has
to come from him.

My phrasing preference is **"We sold our first eggs at a farmers market
in 2024"** rather than "in business since 2024." It satisfies Google's
requirement, it's an origin story rather than an admission of newness,
and it's the kind of concrete specific the voice guide says builds trust.

### 2. There is no farm stand — Draft A has a factual error

Draft A closes with "Come by the stand and say hello." NFF has no farm
stand and no advertised on-farm retail. (`farm_pickup` exists as an
internal sale-channel enum in `src/lib/productCatalog.js`, but no
customer-facing copy has ever offered it.) They sell from a **booth** at
markets and a **tent** at pop-ups — and "booth" is the farm's own word,
used in `copy.html` repeatedly. Fix: *"Stop by our booth and say hello."*

Bonus: this also moves the closer on-voice. The voice guide's
"This, not that" table lists "Come find us." as off-voice against "We
hope to see you there!" / "Stop by our booth…".

### 3. The product list is missing two items

Per the summer 2026 price sheet, the full lineup is: eggs (large /
medium / pullet), whole chicken, Cornish hens, boneless breasts, bone-in
thighs, **tenders**, drumsticks, wings, chicken sausage (maple breakfast
/ sweet Italian), and **livers**. Both drafts omit tenders and livers.

Tenders should go in — it's a mainstream cut and its absence is
conspicuous. Livers I'd leave out: high signal for a small audience,
and the characters are better spent elsewhere. "Sausage" should become
**"chicken sausage"** (it's chicken, not pork, and that's a
differentiator worth two words); naming the two flavors costs ~35
characters and isn't worth it here.

### 4. The market schedule is seasonal — the drafts read as year-round

The three markets run **June–October**, not year-round (Tilted Barn
Jun 3–Aug 26; Scituate Jun 6–Sep 26; Foster Jun 7–Oct 25). Winter is
Saturday-morning egg drops at the Scituate site, 10–11 AM.

Draft A says "You'll find us **every week** at three Rhode Island
farmers markets." From November to May that's false — and a Google
description is the one piece of copy nobody remembers to update. The
existing doc flags this as "will need a refresh"; I'd rather it not
need one. **Adding "in season" costs 10 characters and makes the
sentence true all year.** Strong recommendation, regardless of which
draft wins.

### 5. Draft B has 35 characters of headroom, not 19

Recounted: Draft A is 685 (matches), Draft B is **715**, not 731. The
conclusion drawn above — "Draft B's 19 characters is too tight to work
anything in" — was based on the overcount. 35 characters is enough for
"We started in 2024." if B is the one that ships.

### 6. Unused assets the first pass left on the table

- **The mobile coop.** The evergreen "We love eggs." block — unchanged
  since the first commit, the canonical brand story — describes the
  actual mechanic: hens closed into a secure mobile coop at night, out
  on grass by day, and "After about a week, when the 'good stuff' begins
  to dwindle, we move them (coop and all) to a new spot in the pasture."
  This is the single best unused sentence available. See the argument
  below.
- **APPPA.** The farm are members of the American Pastured Poultry
  Producers Association, and the logo is on the website's contact card.
  It is the *only* third-party affiliation that exists — no organic, no
  Certified Humane, no Non-GMO Project verification. For a skeptical
  first-time buyer it is the only outside validation on offer.
- **"Pasture-raised chicken tastes like *chicken!*"** (Feb 2026) and
  "If you're old enough to remember chicken before it became a
  'manufactured' product, you probably know what I mean." Draft B's
  closer ("come find out what you've been missing") is a generic
  substitute for a much better line the farm already wrote.

### 7. A caveat worth knowing about, if not including

CT delivery is **meat only** — RI gets meat and/or eggs. There's also a
$50 order minimum. Neither draft mentions this, and "delivery across
Rhode Island and eastern Connecticut" could set up a bad first
experience for a Connecticut egg buyer. A parenthetical
"(chicken only in Connecticut)" costs 30 characters. My call: leave it
out of the description — it's a fulfillment detail that belongs on the
website order page, not in a 750-character introduction — but it's a
deliberate omission, not an oversight.

---

## Draft C — recommended

**745 characters**

> North Foster Farm is a small family farm in Foster, Rhode Island, run by a father and son. We sold our first eggs at a farmers market in 2024. Our hens spend their days out on grass and their nights in a secure mobile coop — and every week or so we move the whole thing, coop and all, to a fresh patch of pasture. Non-GMO feed, never any hormones or antibiotics. We sell eggs by the dozen alongside whole chickens, Cornish hens, boneless breasts, bone-in thighs, tenders, drumsticks, wings, and chicken sausage. In season you'll find us Wednesdays in Exeter, Saturdays in North Scituate, and Sundays in Foster, plus summer pop-ups around Warwick and Thursday delivery across Rhode Island and eastern Connecticut. Stop by our booth and say hello!

## Draft D — credibility variant

**710 characters.** Trades the coop image for the APPPA affiliation.
Use this one if the audience you're most worried about is the shopper
comparing you against a supermarket carton that also says
"pasture-raised."

> North Foster Farm is a small family farm in Foster, Rhode Island, run by a father and son. We sold our first eggs at a farmers market in 2024. Our hens are out on grass by day and closed into a secure mobile coop at night; every week or so we move the whole thing to fresh pasture. Non-GMO feed, and never any hormones or antibiotics. We're members of the American Pastured Poultry Producers Association. We sell eggs by the dozen alongside whole chickens, Cornish hens, boneless breasts, bone-in thighs, tenders, drumsticks, wings, and chicken sausage. In season, find us at farmers markets in Exeter, North Scituate, and Foster, and on our Thursday delivery route across Rhode Island and eastern Connecticut.

## Draft E — voice-forward (the replacement for Draft B)

**731 characters.** For if the farm's own voice matters more than the
safe first impression. This is what I'd run *instead of* B: it keeps a
joke, but a joke that also sells the product.

> North Foster Farm is a small family farm in Foster, Rhode Island, run by a father and son. We sold our first eggs at a farmers market in 2024. Our hens spend their days out on grass and their nights in a secure mobile coop — and every week or so we move the whole thing, coop and all, to a fresh patch of pasture. Non-GMO feed, never any hormones or antibiotics. Eggs by the dozen, plus whole chickens, Cornish hens, boneless breasts, bone-in thighs, tenders, drumsticks, wings, and chicken sausage. If you're old enough to remember what chicken used to taste like, come find us: Wednesdays in Exeter, Saturdays in North Scituate, and Sundays in Foster in season, plus Thursday delivery across Rhode Island and eastern Connecticut.

## Draft A′ — minimal line-edit of Draft A

**731 characters.** If you like Draft A and just want it correct: adds
the 2024 line and tenders, fixes "stand" → "booth", adds "In season",
"sausage" → "chicken sausage". Everything else is A verbatim.

> North Foster Farm is a small family farm in Foster, Rhode Island, run by a father-and-son team. We sold our first eggs at a farmers market in 2024. We raise chickens on grass: pasture-raised, non-GMO, moved to fresh pasture regularly, and never given hormones or antibiotics. We sell fresh eggs by the dozen alongside whole chickens, Cornish hens, boneless breasts, bone-in thighs, tenders, drumsticks, wings, and chicken sausage. In season you'll find us at three Rhode Island farmers markets — Wednesdays in Exeter, Saturdays in North Scituate, and Sundays in Foster — plus pop-up events around Warwick through the summer. We also deliver on Thursdays across Rhode Island and eastern Connecticut. Stop by our booth and say hello.

---

## Reasoning: why Draft C

**The central argument is show-the-mechanic, don't recite-the-label.**

Drafts A and B both spend their opening on a list of claims:
pasture-raised, non-GMO, moved to fresh pasture, no hormones or
antibiotics. Every one is true and every one is also printed on cartons
at Stop & Shop. A shopper who has been burned by "free-range" and
"cage-free" — which is the exact shopper the "We love eggs." block was
written for — reads a claim list and discounts it, because claim lists
are what the industrial producers use too.

The coop sentence does something a claim list can't: it describes a
thing a person can picture, and that a factory farm demonstrably cannot
do. *"Every week or so we move the whole thing, coop and all, to a fresh
patch of pasture"* is not a label. It's a chore someone has to actually
go outside and perform. It proves the claim instead of asserting it, and
the reader does the concluding themselves.

This is also what Google's own worked example does. Their ice cream shop
doesn't say "high-quality artisanal ice cream" — it says "35 flavors of
homemade, hand-churned ice creams and sorbets." Specificity is the whole
technique. NFF has better raw specifics than either draft used.

**On the humor.** The doc above frames the choice as "A = safer, B = more
NFF," and that framing is fair as far as it goes. But I think it
undersells a third option. The minimum-chicken-wage joke is genuinely
signature — the voice guide calls the employee gag the signature running
bit — and it's the funniest thing in the corpus. It's also, in a
750-character first contact, the *least productive* 90 characters
available: it's an in-joke that lands for people who already know the
farm, and it does no selling. The "old enough to remember what chicken
used to taste like" line (Draft E) is the better trade: it's still dry
NFF humor, and it simultaneously makes the strongest product argument
the farm has. Save the wage joke for the newsletter, where it has room
to be charming and nothing else to do.

Draft C, my recommendation, doesn't use either joke. That's deliberate.
The warmth is carried by the concrete detail and the closer, and I'd
rather spend the characters on the coop and the full product list. If
that reads as too buttoned-up for the farm's taste, **E is the answer,
not B.**

**On "father and son" vs "father-and-son team."** Dropped the hyphens
and "team" — the voice is a family talking to neighbors, not an org
chart. Minor, but the voice guide is explicit that this is "a real
family, not a brand."

**Ranking:** C > E > D > A′ > A > B.

---

## Still open

- **Was there a hobby period before 2024?** Nothing on disk says so. If
  the farm existed as a hobby before it sold anything, that year is
  James's to supply — and it would strengthen every draft above.
- **The phone number in `north-foster-farm/data/company.yaml` is a
  placeholder** — `(401) 555-5555`, unchanged since the initial commit.
  Not a description issue, but if the Google Business Profile is being
  set up now, the real number needs to land in both places.
- **The GBP has structured fields** for products, service areas, and
  hours that the description shouldn't duplicate. Market locations
  aren't well representable there for a vendor with no storefront, which
  is why they stay in the description — but the delivery zip list and
  the product catalog are better entered as structured data than
  compressed into prose.
- **Refresh trigger:** with "in season" in place, these drafts stay
  accurate year-round. They'd need revisiting if a market is added or
  dropped, or if the product lineup changes.
