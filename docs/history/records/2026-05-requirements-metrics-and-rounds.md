- Making data/metrics a first-class entity in the app
  - Not sure what to measure yet, but got some good advice from Claude:

---

Tracking & Evaluating Cornish Cross Batches

Feed Conversion Ratio (FCR) is the headline number — pounds of feed per pound of
liveweight gain. Commercial operations target 1.7–1.9 by processing age;
pasture-raised birds typically run 2.2–3.0 because they're moving more and
getting less nutrient-dense intake. Track total feed delivered against total
liveweight at processing.

Average daily gain (ADG) via spot-weighing. You don't need to weigh every bird;
pull a random sample of 10–20 birds weekly, weigh on a hanging scale or platform
scale, and track the trend. By 7–8 weeks pasture birds typically hit 5–6 lbs
liveweight.

Uniformity — the coefficient of variation across your sample weights. Tight
uniformity (CV under 8%) means consistent customer experience and even
processing. Wide spread suggests feed access problems, bullying, or sick birds
dragging the average.

———

Tracking & Evaluating Red Sex-Link Laying Flocks

Hen-housed production — cumulative eggs ÷ original number of hens placed. This
is the more honest economic number because it bakes in mortality and culls. A
Red Sex-Link flock should produce roughly 280–320 eggs per hen-housed in the
first laying year.

Feed conversion measured as feed per dozen eggs (typically 3.5–4.5 lbs/dozen for
confined birds, higher on pasture) or feed per pound of egg mass. Egg mass —
average egg weight × number of eggs — is actually a better denominator than
count because it accounts for the bigger eggs older hens lay.

Body weight and condition. Random-sample weighing every 4–6 weeks. Birds that
drop weight while still laying are burning reserves and will crash. Birds
gaining too much fat (common in over-fed pastured flocks) lay less and develop
fatty liver issues.

---

- Rounds
  - In the UI, needs to be a place to see the details of previous rounds, to launch specific
      rounds outside of its specified block, or to cancel the current rounds
      that are in progress
  - "Condition" should change to "MASH"
      - The idea is that any chicken observed to be unwell should be moved to a
          quarantine area (we call it the MASH unit)
      - The different descriptors in the condition pane are basically saying "I
          saw chicken exhibiting X so I moved it to the MASH"
      - There should be an "Other" field so arbitrary text can be entered
  - Mortality
      - If General is selected, the cohort dropdown should allow the user to
          pick from any cohort on the farm
  - Move
      - The option to move a cohort from one site to another doesn't happen
          during rounds—this would be a planned event. Remove this button from
          the bottom rail
  - Sweep
      - This functionality duplicates what's already the main purpose of the
          rounds UI and doesn't need to exist as a bottom-rail button
      - The options to indicate "all taken care of" should be added to the main
          UI
  - Some chores can be completed within a window of time spanning multiple
      rounds (i.e. wash nest boxes)
      - These chores should NOT block the completion of rounds UNLESS the chore
         completion window closes during those rounds
         - This makes me realize that all the chores we have set as like
             "complete by end of the week", those should really be "complete by
             the final afternoon rounds of the week" because the evening rounds
             are not the time to start power washing nest boxes
             - This behavior should be shared across all chores of this type,
             - The chore's recurrence can still read as "by the end of the week"
                 but in the Blocks edit UI there needs to be a radio button or
                 similar that sets which of the blocks is considered to be the
                 last chance to do a chore
      - Chores that don't need to be done yet should:
          - Have a "(4 days remaining)" added to them
          - Be grouped together at the bottom of the list of chores (then sorted
              first by when they have to be done by starting with the soonest
              first, and then alphabetically within those subgroups
- Chore assignments
  - Chores should be able to carry a default assignment of one or more people
  - Assignment of an instance of a chore should only change that instance
  - The default assignment of a chore should have a rules engine that allows us
      to specify who gets assigned to a chore and when
      - It should be possible to say: On Mondays and Fridays James washes and
          packs eggs, on Tuesdays and Thursdays Jim washes and packs eggs, and
          on Wednesday, Saturday and Sunday both of them wash and pack eggs
  - The default assignment should be possible on both the chore level and the
      block level
      - For example: on Mondays and Tuesdays, James is assigned to morning
          chores, and Wed-Sun Jim is assigned to morning chores
- Inbox/"just a thought..." capture and catalog
  - The ability to quickly dump a quick thought into a text input, for later
      review
  - New items should show up in the dashboard notifications (but not send a push
      notification)
  - There should be an inbox page with all the items, who created them and when.
      All items should be drag-and-drop orderable and pinnable (sticks to the
      top of the list where it is drag-and-drop orderable among other pinned
      items)
  - Items should be archivable (and show up on an "archived" tab)
  - Items should have a read/unread status (per-user status, not global) and the
      ability to mark as read/unread
- Chore groups are obsolete and should be removed, I think—please confirm
- Chore blocks need to be defined slightly differently. For each block:
  - User picks a start time (sunrise, sunset, time of day)
  - User picks the duration (time input with no AM/PM)
  - Block end time = start time + user-specified duration
