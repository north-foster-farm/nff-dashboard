# North Foster Farm — Voice & Tone Reference (v0)

_Descriptive, not prescriptive. Drawn from 28 versions of the homepage update copy (`copy.html`), May 2024 – Feb 2026. This is the seed the enforceable style guide — and eventually the in-app content checks — should grow from. Every example below is pulled verbatim from a past update._

---

## The voice in one line

A small family farm talking to its neighbors: warm, plainspoken, lightly funny, and scrupulously honest.

---

## Core traits

**1. "We," sometimes "I." A real family, not a brand.**
The default is *we / our*, but it slips into first-person singular for personal asides, and that's part of the charm:
> "I'm sure I say it every year, but I can't believe fall is here already."

**2. The flock are "employees." This is the signature running joke.**
Hens are personified as staff across years of updates — keep this alive:
> "We'll soon be heading to Pennsylvania to pick up 100 new employees."
> "Until then, we only pay them minimum chicken wage."
> "…the experienced employees will do their best to keep up with demand."
> "Our new help is on the farm settling in."

**3. Dry, understated humor — never zany.**
The wit rides along inside otherwise practical sentences:
> "We may be wearing long johns, but the Foster Farmer's Market will be hanging on until October 26th."
> "They taste just as good when there's snow on the ground!"

**4. Teach, don't preach.**
Updates routinely explain the *why* — molting, pasture rotation, ready-to-lay pullets — often with a parenthetical or em-dash definition:
> "our chickens are molting—the time of year when hens slow or stop egg production and focus their energy on replacing feathers."
> "100 'ready-to-lay' hens in April that aren't quite ready to lay…"

**5. Skeptical quotes around industry labels.**
Marketing-speak they distrust gets visibly held at arm's length:
> 'eggs called "free-range", eggs called "cage-free"… chicken before it became a "manufactured" product. Pasture-raised chicken tastes like *chicken!*'

**6. Radical honesty about the hard stuff.**
Bad news is named plainly, explained, and — where warranted — apologized for. Prices come with exact figures and rationale:
> "Sadly, we have recently lost several hens to predation by the local hawk population."
> "Our price will increase 17 cents per egg to $7.00 per dozen, beginning February 8th. This modest price increase will allow us to provide the highest quality product we can."
> "We are sorry for the inconvenience and appreciate your understanding."

**7. Gratitude, every time — and it closes the update.**
Nearly every post thanks customers, often nudging them to spread the word:
> "As always, we can't say 'thank you' enough."
> "Thank you, as always, for supporting North Foster Farm and all of our local farmer friends."

---

## Signature structural moves

- **Seasonal titles.** Every update is named by season or month: _Spring Update_, _Mid-Fall Update_, _Late-Fall Update_, _Mid-Winter Update_, _June Update_. The new one should follow suit (e.g., _June Update_ or _Season Opener_).
- **Bold lead-in labels for multi-item news.** When there are several updates, each gets a bolded inline label: **New employees.** … **Farmers markets.** … **Non-GMO.** … **Pasture-raised.** …
- **Event blocks** use a fixed shape: **When:** / **Time:** / **Where:** with the full address.
- **Concrete specifics build trust** — exact dates, addresses, flock counts ("100 new hens"), even dimensions ("16′ × 50′ high-tunnel greenhouse").
- **The standing footer** appears on every update: the note that schedule changes are posted to the site, plus the email-list signup line.
- **The evergreen "We love eggs." block** has run unchanged since the first commit — it's the canonical brand-story section, not something to rewrite per update.

---

## Mechanics

- **Person:** first-person plural default; first-person singular allowed for warmth.
- **Punctuation:** em-dashes for asides and definitions; ellipses for the occasional comic beat. Smart/curly quotes and apostrophes throughout (' ' " ").
- **Sentence rhythm:** complete, flowing, conversational sentences in paragraphs of 3–5. This is a newsletter from a person, *not* clipped ad copy.
- **Value-prop drumbeat:** pasture-raised, non-GMO, moved to fresh grass daily, never any hormones or antibiotics, humane. "Pasture-raised" stays hyphenated; "non-GMO" keeps that exact casing.
- **Closing:** end warm — thanks, and an invitation to come by or spread the word.

---

## This, not that

| Off-voice (too "brand") | On-voice (North Foster Farm) |
|---|---|
| "Eggs and meat, the way they're supposed to taste." | "Pasture-raised chicken tastes like *chicken!*" |
| "Come find us." | "We hope to see you there!" / "Stop by our booth…" |
| "New arrivals." | "Our laying flock will be welcoming another group of new recruits." |
| Clipped one-line fragments for punch | Full, conversational sentences that explain and invite |

---

## For the eventual CI backend

When the in-app checks become real, these traits split into two buckets:

- **Mechanically enforceable (lintable):** smart quotes required (no straight quotes); "pasture-raised" hyphenation; "non-GMO" casing; seasonal-title pattern present; standing footer present; a gratitude line near the close.
- **Editorial (human judgment):** the employee gag, the dry humor, the teach-don't-preach explanations, the honesty about hard news. These can be *prompted for* and *flagged if absent*, but not mechanically verified.

That distinction is the spec for what the content-checker can automate versus what it should surface for a human pass.
