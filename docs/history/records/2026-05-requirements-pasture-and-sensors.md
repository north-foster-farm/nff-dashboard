 more feature requirements for the pasture rotation planner:

- file handling needs to be implemented, and users should be able to upload a
GeoJSON file directly via the admin dashboard to add new pastures to the planner
  - our first pasture GeoJSON is located here: /Users/james/Downloads/Pastures.geojson
- the planner has preferences that are set globally (i.e. shared by me and my
dad), but can be overriden in a plan if desired. global preferences include:
    - Suscovich tractor
        - footprint dimensions
        - max number of birds
    - Salatin tractor
        - footprint dimensions
        - max number of birds
    - Rotation options
        - allow right angle moves? (can tractors turn 90 degrees or do they need
        to make U-turns?)
        - minimum pasture recovery time (how soon can more chickens occupy some
        pasture after a tractor was on it?)
- when planning, these preferences should appear pre-filled with the set values.
other fields should be present, such as: number of birds in batch (auto-suggests
how many tractors and which kinds to use based on that); start date; pastured
duration.
- tractors should be able to be placed on the pasture geoJSON data. then, the
tractors should be able to be moved to another location in the pasture. the app
should calculate how many moves it will take to get there. it should suggest
keeping the other tractors close to the one that was moved manually and suggest
placement. the idea is to have fine-grained control over where in the field
tractors are moved, and the app makes it easy to build an efficient plan.

 - Pasture rotation variables
     - Min number of tractors
       - How many per
    - Max per tractor (Salatin says 70)
    - Our max per tractor is 50
        - 50 per each salatin and 25 in sukovitch
    - 10' x 12'

also, back to design with chores. the interaction model is still not right. need
your help working through all the different angles and coming up with a better,
more intuitive way to organize and manage them.

features still needed for chores:

- in-place edit of individual chores
- edit of chore completion window... maybe we need to separate the concept of a
    chore (a recurring task) and "chore time" (a block of time devoted to the
    completion of chores)? if a chore has one chore block, and a chore block is
    say 8 AM to 10 AM, if we want to change that window of time for all our
    chores we do it in one place... is that a better separation of concerns?
- chore modifiers are going to exist as a side effect of a process. for
    instance, the processing day event/process will specify that the broiler
    food is restricted by noon the day prior to processing. This will affect the
    chore scheduled for that afternoon at 2 PM to feed broilers. So in this
    case, a chore modifier will override the scheduled chore.
    - there's also an edge case where two or more chore modifiers attempt to
        modify the same chore instance. we may or may not need UI for this, but
        there definitely does need to be logic to handle it
- somewhere, there should be an indicator of what time sunset is, and/or how
    long until evening chores can be done. maybe it even counts down in real
    time
- a specific UI that you launch when you do chores, kind of like the idea I had
    for a "receive inventory page" with specialized UI and interactivity
    tailored to that specific activity (if I never detailed that for you, tell
    me so I can elaborate). when I go out to do chores, I want to click a menu
    link in the sidebar that says "do chores". this should launch an action
    screen that I guess I'm going to call the "chore doer",
    designed entirely for mobile devices, that has some specific UI on it:
    - only 1 button at first: start chores. this button opens the rest of the UI
        and logs the start time. this time needs to be logged so we can track our start times (we need to stay
        better on schedule, so its important we have a system to keep ourselves
        accountable. in the dashboard, we need to be able to see how often we
        started chores on time, how often we were late, and how long it took us
        to do chores.
        - if chores have already been started by someone else, the "do chores" item in the
        menu should instead read "help with chores", the menu icon should turn
        green, and an elapsed time counter should be appended the link text that
        counts up in real time. if someone starts chores while someone else is
        already looking at the dashboard, they should be able to see the link
        text change.
      - the UI has buttons for quick actions and quick completion of the current
          chores. it should be easy to quickly jump from brooder to mobile coops
          to tractors to sheep to "wash and pack". tapping one of these buttons
          should show different stuff, but the ability to quickly jump to the
          next thing should remain (don't hide these buttons after drilling down
          one level). buttons we certainly need are:
          - dead layer, dead broiler, chick moved to MASH
          - observation (should prompt for "observed where")
          - moved coops (then prompts for each subtask like "fences moved?
          feeders/waterers/grit/shell moved?" — these should be pulled from the
          chore list, but this screen should make it easy to deal with them all
          together — and there should be quick actions to mark individual things
          as done or an "all taken care of" button to get them all at once. also
          need a "moved tractors" button with the same stuff.
          - mobile coop feed/water/eggs
          - brooder feed/water
          - cleaned waterers, cleaned feeders, cleaned nest boxes
      - when someone else completes a chore, the button for it should become
      disabled and a checkmark or something to indicate completed status gets
      overlaid.
      - end the chores doing session by clicking the "all done" button. you
      should see how long your chores took, the schedule at a glance, and some
      way of resuming chores if you ended them too early for some reason. if
      someone else had clicked "help with chores", the screen should also say
      "(user) is still working", and the counter in the sidebar should continue
      counting up until the other person has clicked all done.
      - if chores are not done and the end of the chore window arrives, the
      chores for that chore window should be marked as "DNF"
- when all chores in a chore window are done, there should be a web/push
notification to all users that says "AM chores are done" or "DNF AM chores"

more new features:

- a central place to pull in all our sensor data from our YoLink devices. there
    is an API with good documentation—I'm going to compile it into markdown so
    you can access it here:
    /Users/james/Code/nff-dashboard/.ignored/yosmart-docs.md. When it's time to
    build this, I will find some examples of any nice charts or visualizations
    of the data we might want to play with. the biggest thing is just having an
    extensive, complete record of our temperatures.

- a weather early warning system. precipitation in the forecast should show up on the
    dashboard somewhere to help us with our planning. changes in the forecast
    (was going to rain, now it's not) should also be surfaced.

- checkbox behavior and style:
    - clicking on the text of a checkbox should cause the box to check or
    uncheck as if the checkbox item itself had been checked
    - the checked icon should look more like this SVG:
    /Users/james/Downloads/square-check-big.svg. I like the checkmark breaking
    through the edge of the box, the color of the checkmark being the primary
    accent color. there should be a css transition when the checkbox is clicked,
    where an empty checkbox fades into the checked variant and vice versa (with
    a relatively quick transition, just something to make it feel a little more
    tactile).

- more data I want to track (for broilers):
    - how much floor space per bird did we provide?
    - how many linear feet of feed did we provide per bird?
    - how often did we raise feeders? do we know the height adjustments? can we
        find a correlation between the height at which the birds are eating and
        drinking, and other issues such as leg problems or something?
    - what was the average temperature of our water? how much variance was there?
        were there ever readings of temps that were way too hot or cold?
    - what was the mortality rate? how many chickens did we observe with health
        issues? we're going to have a partition in the brooder where chicks who
        are not thriving can be moved to have easier access to food and water,
        called the brooder mash unit—what was the population of the brooder mash
        over time? did the number of chickens with health issues ever go down (i.e. we
        successfully rehab'd a bird)?
