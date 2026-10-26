# North Foster Farm — Voice & Tone Reference (v0)

_Descriptive, not prescriptive. Drawn from 28 versions of the homepage update copy (`copy.html`), May 2024 – Feb 2026. This is the seed the enforceable style guide — and eventually the in-app content checks — should grow from. Every example below is pulled verbatim from a past update._

---

## Read first: the rules that came after this guide

This guide is v0, written from the update posts. Since then James has set rules for the site's copy (on north-foster-farm's issues, mostly #192, #211, #224, #233 and #267), and he keeps rejecting patterns as he reads drafts. Where a rule here contradicts a section below, the rule wins.

**The standing rule (north-foster-farm #379):** every new pattern James rejects is folded in the same way, at once: a numbered entry in "Patterns James has rejected" below, with his example, and a check in the site's wording test (e2e/wording.spec.mjs in the north-foster-farm repository) wherever a regular expression can catch it. The judgment patterns stay here alone, so the list is the record and the test is the net.

Two overrides to know straight away:

- **No em dashes in site copy.** "Mechanics" below allows them for asides and definitions; the house rule since September 2026 does not. The one exception is James's own sign-off, "— James and Jim" (#211).
- **The employee joke, seasonal titles and the standing footer** belong to the farm-update voice. They suit a news post, not checkout, the account pages or transactional email.

### The rules James has set

- **Q8: nothing unbacked ships.** "The release waits until every sentence in customer copy that no code or doc backs up has been either confirmed or cut." Agents add no facts. Customer-facing words are James's; what an agent writes is a draft and is marked as one.
- **Q10a and Q10d: no precision we don't track.** "Frozen" is fine, with no claim about how soon. Eggs reach the carton "within days of being laid": "No 'two days', no 'about two days', no '48 hours'. The moment a number is in the copy, it's a standard someone can hold us to."
- **Q10b: say the strong true thing plainly.** "The birds are processed at a USDA-inspected plant. That claim can be made plainly in the copy."
- **Q10c: seasonality is a selling point, not a caveat.** "Golden yolks from the pasture in season, quality maintained deliberately through the winter. Not 'colour varies, results may differ.'"
- **Q1: "pasture-raised" leads.** "'Pasture-raised' is the strongest thing we can say. It leads." The hero line is "Proudly pasture-raised in Foster, Rhode Island."
- **Q6, Q4a, Q4b: two people, named.** The sign-off is "— James and Jim" everywhere a sign-off appears. Jim is "Jim", never a longer form. "A two-person farm shouldn't sign as a team."
- **Q2: the market is a pleasure, not a problem.** "A lot of our customers love going to the farmers market. We shouldn't write copy that quietly insults the thing our best customers enjoy." Ordering online is how you keep buying from us when there's no market on.
- **Q3: the order page is a conventional checkout for anyone.** Copy must not assume the visitor already knows the farm, and an instruction stays only if it explains something the page doesn't already teach by being used.
- **W26: no jargon a buyer would have to look up.** "Chicken tractor" became "one of the moveable pens the birds live in": a description can afford the words.
- **W17: subjects are plain, about the thing, no riddles.** The launch email's subject is "Order our chicken and eggs online 🐓 🥚".
- **Welcome and list email:** "short and in the farm's voice, not a marketing welcome sequence."
- **Q4c and R-POST: James writes his own story.** He writes the About people section and the rewrite of the tour post. Agents don't pre-draft another version, and no placeholder copy ships in a section's place.
- **Fixed words:** you **pay** on the order page and the order is **placed**; "the drop site", with Scituate only as the place; "pasture-raised" hyphenated; "non-GMO" in that casing; "farm news" lowercase; American English (favorite, color, flavor); no semicolons in prose; "email address" when it means the address.

### Patterns James has rejected

Numbered so a flag can cite one ("A7"). The ones marked **(test)** are matched by the site's wording test (e2e/wording.spec.mjs in the north-foster-farm repository); the rest are judgment.

- **A1. A claim nothing backs up (Q8).** "Frozen the same day" or "frozen within 24 hours". Q10a: "I'd rather say less than say something I can't stand behind." Confirm it or cut it.
- **A2. A number we don't measure (Q10d).** "In the carton within about two days" became "within days of being laid".
- **A3. A caveat where a selling point belongs (Q10c).** "Colour varies, results may differ" (his own example). Write "a bright golden orange all season" instead.
- **A4. A riddle or reversal pivot (W17).** "The market's closing. The chicken isn't." James: "Implying the chicken could 'close'? that makes no sense." The masked forms are out too: "This isn't X. It's Y.", "Not X but Y."
- **A5. Copy that knocks the market (Q2).** "The farmers market, minus the parking lot."
- **A6. A slogan that describes the farm where the section needs to say something else (Q2).** "From our pasture to your table" as the title of a section about ordering.
- **A7. Brand-deck clichés (test).** "Ethically raised", "raised the right way", "as nature intended", "natural behaviors", "fresh air and sunshine", "stress-free life", "healthy land, healthy animals", "regenerative", "know where your food comes from", "farm to table" and its variants, "higher standards", "the finest", "nutrient-dense", "clean" as a food word, "Stay connected to the farm". This guide's own example: "Eggs and meat, the way they're supposed to taste." The test matches all but "clean" and "premium": "premium" is on the copy lane's list, but About's "We raise a premium chicken" is James's own line.
- **A8. A corporate voice for two people (Q6) (test).** "The NFF team" or "The North Foster Farm team".
- **A9. Retired words (north-foster-farm #150) (test).** "Invoice(s)", "payment link", "Pay to confirm", "the Scituate drop site", "market pickup".
- **A10. Instructions the page already teaches (Q3).** "Pick what you'd like, choose how to get it, and pay right here" at the top of the order page.
- **A11. Copy that assumes the reader knows us (Q3).** A farmers-market framing on the order page "assumes a relationship the visitor may not have".
- **A12. Jargon (W26).** "Chicken tractor".
- **A13. Words that misdescribe the catalog (Q3).** "Every bird here" on a page that also sells eggs, and cuts most people don't think of as a bird.
- **A14. Em dashes in site copy (test).** "Molting—the time of year when…" Use a comma, colon or period instead. The sign-off keeps its dash.
- **A15. A fragment after a fragment, or one sentence split into a sentence plus a fragment.** "Fresh grass. Every day." This guide agrees: clipped one-line fragments for punch are off-voice.
- **A16. Filler transitions and scene-setting (test).** "At its core", "That said", "Ultimately", "In today's world", "It's important to note".
- **A17. Meta talk about the page.** "On this page you'll find…", or a section that describes the page before the page begins.
- **A18. Decorative threes and padding for balance.** "Fresh, local, and sustainable" used for rhythm, not meaning.
- **A19. Repeated words within a line (Q1).** "Pasture-raised… proudly raised" was rejected for saying "raised" twice.
- **A20. Restating, summing up, or guiding the reader's feelings.** A closing line that repeats the paragraph's point.
- **A21. A phrasing James doesn't like, even when it's accurate (2026-10-17).** "Pasture-raised, processed in Rhode Island, and packed by weight." became "Pasture-raised, processed, and packed in Rhode Island." No rule was given; it is listed so the pattern can be named.

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
- **Punctuation:** em-dashes for asides and definitions (overridden for site copy: see "Read first" above, A14); ellipses for the occasional comic beat. Smart/curly quotes and apostrophes throughout (' ' " ").
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
