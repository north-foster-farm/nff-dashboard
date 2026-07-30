# Livestock metrics — what's worth measuring

Reference notes for the broiler tracker, the layer pages, and any
future reporting surface. Two parts: benchmark figures gathered
2026-05-07 (promoted from `.ignored/roadmap-updates.md`, whose other
sections describe chore/Rounds work that has long since shipped), and
James's own list of what he wants captured (2026-05-05, promoted from
`.ignored/pasture-rotation.md`). Nothing here is implemented — treat
it as the input to a metrics feature, not a record of one.

## Broilers (Cornish Cross)

**Feed conversion ratio (FCR)** is the headline number — pounds of
feed per pound of liveweight gain. Commercial operations target
1.7–1.9 by processing age; pasture-raised birds typically run 2.2–3.0
because they're moving more and getting less nutrient-dense intake.
Track total feed delivered against total liveweight at processing.

**Average daily gain (ADG) via spot-weighing.** You don't need to
weigh every bird; pull a random sample of 10–20 birds weekly, weigh on
a hanging scale or platform scale, and track the trend. By 7–8 weeks
pasture birds typically hit 5–6 lbs liveweight.

**Uniformity** — the coefficient of variation across the sample
weights. Tight uniformity (CV under 8%) means consistent customer
experience and even processing. Wide spread suggests feed access
problems, bullying, or sick birds dragging the average.

## Layers (Red Sex-Link)

**Hen-housed production** — cumulative eggs ÷ original number of hens
placed. The more honest economic number, because it bakes in mortality
and culls. A Red Sex-Link flock should produce roughly 280–320 eggs
per hen-housed in the first laying year.

**Feed conversion** measured as feed per dozen eggs (typically 3.5–4.5
lbs/dozen for confined birds, higher on pasture) or feed per pound of
egg mass. Egg mass — average egg weight × number of eggs — is a better
denominator than count, because it accounts for the bigger eggs older
hens lay.

**Body weight and condition.** Random-sample weighing every 4–6 weeks.
Birds that drop weight while still laying are burning reserves and
will crash. Birds gaining too much fat (common in over-fed pastured
flocks) lay less and develop fatty liver issues.

## What James wants tracked (broilers)

Verbatim, 2026-05-05:

- how much floor space per bird did we provide?
- how many linear feet of feed did we provide per bird?
- how often did we raise feeders? do we know the height adjustments?
  can we find a correlation between the height at which the birds are
  eating and drinking, and other issues such as leg problems or
  something?
- what was the average temperature of our water? how much variance was
  there? were there ever readings of temps that were way too hot or
  cold?
- what was the mortality rate? how many chickens did we observe with
  health issues? we're going to have a partition in the brooder where
  chicks who are not thriving can be moved to have easier access to
  food and water, called the brooder mash unit — what was the
  population of the brooder mash over time? did the number of chickens
  with health issues ever go down (i.e. we successfully rehab'd a
  bird)?

Note the water-temperature question presumes sensor capture; the
YoLink sensor integration it depends on has never been built.
