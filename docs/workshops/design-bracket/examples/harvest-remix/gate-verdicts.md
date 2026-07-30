# Gate — judge panel verdicts

## Lens: leverage

Advance: systematizer, recombiner

| stance | lev | cons | cost | comp | state | dist |
|---|---|---|---|---|---|---|
| systematizer | 5 | 5 | 2 | 4 | 4 | 4 |
| editor | 2 | 4 | 5 | 5 | 4 | 2 |
| operator | 4 | 3 | 3 | 5 | 4 | 4 |
| recombiner | 5 | 5 | 2 | 3 | 4 | 5 |

**Rationale:** Through the leverage-value and consistency lens, the question is which strategies turn the arc into the most durable, most coherent app-wide system and waste the least of what was built. Systematizer and recombiner are the two that make that their thesis: systematizer maximizes consistency by promoting a single component vocabulary (FLUSH + TYPE) and explicitly bounding where it applies, and recombiner maximizes leverage by fusing three data libs into one farmLoad model and one primitive seen on four surfaces. They are complementary — systematizer unifies the chrome/typeface, recombiner unifies the data model — and the coded mockup phase is precisely where recombiner's polymorphic-primitive comprehension risk gets resolved or falsified. Editor scores lowest on my lens despite being the cheapest and clearest: it harvests the least and discards most of the arc's data work, which is the waste the lens penalizes. Operator has genuinely good leverage and the best operator-comprehension, but it spends its energy on a phone-vs-desktop re-architecture rather than on the harvest-into-coherence premise, making it fragment the design center more than the two survivors; its best idea (phone distribution) is better grafted onto the winners than advanced on its own.

**Grafts:** From operator, graft the phone-first distribution layer onto both survivors: NeedsCover at the top of the phone Today glance AND inside the live Rounds run, and the day-load silhouette on the phone header — both survivors are desktop-centric and this is the missing 'where the operators actually look' layer that turns system value into used value. From editor, graft two things: (1) the four-floor-states discipline as a guardrail so the survivors don't over-build — man-down/draft-confirm/overdue/offline must each come out with a stronger single representation, and (2) the cheapest-first sequencing (the lone ui.jsx Card flip as step one) to de-risk systematizer's all-at-once repoint. From the codebase verification, graft into BOTH survivors: cut personLoad.js entirely rather than keeping a 'hole' slice — the man-down hole already derives from manDown.js, so NeedsCover promotes without it (this trims operator's and recombiner's build cost). For recombiner specifically, graft systematizer's anti-cargo-cult boundary discipline so the LoadStrip does not conflate progress with load — let the Rounds density be a deliberately distinct semantic even if visually kin. The shared safe core all four converge on (delete the duplicate center WeekSpines, flush Card, promote NeedsCover + NowMarker, SealStamp onto Rounds WrapCard, demote/cut the two-lane base layer, replace ChoreCheckRow's raised escalation tint) is the non-negotiable spine of whichever survivor wins.

---

## Lens: feasibility

Advance: operator, systematizer

| stance | lev | cons | cost | comp | state | dist |
|---|---|---|---|---|---|---|
| systematizer | 5 | 5 | 2 | 4 | 5 | 5 |
| editor | 3 | 4 | 5 | 5 | 4 | 3 |
| operator | 4 | 4 | 3 | 5 | 5 | 5 |
| recombiner | 5 | 5 | 2 | 3 | 5 | 5 |

**Rationale:** Through the build-cost/feasibility-on-real-data lens, the central fact (verified in personLoad.js's own docstring) is that per-person assignment is sparse, so the photogenic two-lane ribbon renders empty in production. All four correctly cut or demote it; the differentiator is how much HONEST leverage each retains and at what build cost. I advance operator and systematizer because they bracket the two strongest distinct, buildable theses: operator is the feasibility-vs-value sweet spot (cuts the sparse ribbon, keeps only the count-driven and deferrable-deadline signals that are actually real, re-homes them where operators read cold, no god-component) and scores highest on comprehension/distinctiveness; systematizer carries the highest leverage and the best NO-LEGACY discipline (explicit promote-then-delete order, grep for surviving bg-surface, and an anti-cargo-cult rule for where patterns do NOT apply) and produces the most coherent app-wide mockup. A coded-mockup phase usefully tests both 'phone-first signal placement' and 'one component vocabulary.' I do not advance editor (cheapest but over-cuts real signal — better mined as a cost guardrail graft) or recombiner (highest concept but its 3-density god-LoadStrip plus outright WeekList deletion is the worst maintenance-debt/risk profile of the four — its one good idea, the unified farmLoad walk, is graftable without the component).

**Grafts:** From recombiner -> graft the single farmLoad walk (collapse the three Schedule memos weekFullness + weekShouldHeat + personLanes/daySilhouette into one lib/load model) onto whichever load primitive the survivors build; it is the one genuinely cost-reducing idea recombiner has, without adopting its god LoadStrip or its risky WeekList deletion. From editor -> graft the radical-subtraction guardrail directly onto systematizer: cap batch 1 to the surfaces in its wireframes (Dashboard/Schedule/Chores-escalation/Rounds-seal) and DEFER the full Overview/StatTile/PlaceSection migration to a follow-up batch, so the leverage lands without the all-at-once blast radius that is systematizer's fatal flaw; also take editor's one-line ConfirmCard (drop the marketing-prose card) and its single inline should-due glyph as a cheap WeekList fallback. From operator -> graft (a) NeedsCoverCard surfacing INSIDE the live Rounds run, not only on Schedule, and (b) 'a block is sealed only by completion (SealStamp), drop confirm-the-day theater' as a simplification both survivors should weigh — there is no real 2-person decision behind it. Confirmed shared floor to bake into BOTH survivors regardless of theses: flush Card flip in ui.jsx (bg-surface->border-on-bg), retarget ChoreCheckRow's bg-warn/5 escalation to the flush/hole treatment, NeedsCover -> one promoted primitive, NowMarker -> one shared primitive, Lora/Inter folded into Card's header, delete WeekSpines.jsx (keep wired WeekList), and delete RethinkerKit + RethinkerGallery + the two nav lines (sections.jsx:127, SectionContent.jsx case) promote-then-delete, in-batch, no soak.

---

## Lens: operator

Advance: operator, editor

| stance | lev | cons | cost | comp | state | dist |
|---|---|---|---|---|---|---|
| systematizer | 5 | 5 | 2 | 3 | 5 | 3 |
| editor | 3 | 4 | 4 | 5 | 4 | 2 |
| operator | 4 | 4 | 3 | 5 | 5 | 4 |
| recombiner | 5 | 5 | 2 | 2 | 5 | 5 |

**Rationale:** Through the operator comprehension and field-readiness lens, the question is not 'which harvest is most elegant' but 'which result can James/Jim parse cold, one-handed, with the must-see states loud.' By that test Operator and Editor separate cleanly from the pack. OPERATOR is the single most lens-aligned strategy in the bracket: it diagnoses that the arc's signals were stranded on a desktop the operators never look at and relocates them to the phone Today glance and the live Rounds run in tap-priority order — man-down jumps to the top of the screen actually being held, offline stays loud, draft/confirm is dropped because there's no operator decision behind it. EDITOR earns the second slot by the opposite move that lands at the same place: aggressive subtraction so a quiet day reads as a short honest list and nothing competes with the four floor states, each of which comes out stronger as a single shared representation. The two diverge enough (phone-first relocation vs desktop-honest minimalism; keep-one-silhouette vs cut-all) that a coded round will genuinely test two different comprehension experiences rather than one idea twice. RECOMBINER scores highest on leverage, consistency, and distinctiveness, but its LoadStrip is precisely the cleverness this lens must penalize — one bar carrying mode-dependent meaning and four overlaid encodings cannot be read in the field without a legend, and deleting the familiar WeekList for spine-as-navigation compounds the cost; its real value is engineering collapse, which is why I graft its farmLoad model and overlay-on-real-data idea onto the survivors instead of advancing it. SYSTEMATIZER's strength (app-wide consistency, full state coverage) genuinely aids comprehension and supplies the best grafts (FLUSH/TYPE discipline, shared CheckTarget), but it keeps the load spine everywhere as a system primitive it never proves the operator can read, and it's the heaviest build — its discipline is better borrowed than advanced.

**Grafts:** Onto the survivors, graft: (1) Recombiner's single `farmLoad` model + a shared `heatColor()` token function — the engineering substrate both survivors can stand on without buying the overloaded LoadStrip; cheap collapse, no comprehension cost. (2) Recombiner/Systematizer's person-lane-as-CONDITIONAL-overlay (draws only on days with real reservation/hole data) — offer it on the operator survivor as the honest middle path between 'keep the empty ribbon' and editor's total cut. (3) Generalize NeedsCover into one `AttentionCard` primitive (amber-hatch + ⚠ eyebrow + one solid action) that also backs overdue and source-change, so every escalation reads identically — both survivors already half-agree on this. (4) Editor's should-heat → single ⌁ glyph reduction belongs on the operator survivor's sidebar week too: cheaper and more readable than a heat row, while keeping the deferrable-deadline signal alive. (5) Systematizer's CheckTarget — factor ChoreCheckRow's 28px button into one shared tap target — pure field-readiness with gloves. (6) Lock SealStamp on the Rounds WrapCard: all four strategies independently route it there, so it's settled regardless of who advances.

---

