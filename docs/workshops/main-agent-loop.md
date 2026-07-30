# How I structure my main agent loop

It's not technically a loop — it's more a series of steps I follow for every
new feature or chunk of dev. But the same shape repeats every time, so here
it is end to end.

---

## 1. Brain dump

I front-load as much as I know about what I want to build as I possibly can.
The goal is to identify as many surfaces as possible — the details don't
matter yet. Just get down as many *"it should X"* and *"it shouldn't Y"*
statements as I can.

## 2. Claude writes user stories and boundary stories

Claude turns the brain dump into stories, making educated guesses about
anything I didn't hit directly.

- **User stories** — feature requirements from the end user's perspective:
  *"James should be able to X and then Y so that Z."*
- **Boundary stories** — the same idea, but from the perspective of other
  features in the app: *"The schedule owns X, and event data Y is derived
  from X."*

This usually produces 100–200 stories, organized into related clusters
called epics.

## 3. I review the stories, one epic at a time

Claude reads the stories back to me epic by epic. The rule: *"If I don't
mention a story, it's valid and correct as written."*

Anything that isn't accurate, relevant, or useful, I call out — and either
tell Claude how to fix it or to kill it. On average I give feedback on maybe
10–15% of the stories.

This takes about 20–30 minutes and is probably the most time-consuming part
after the initial brain dump. The result is a big list of stories that forms
a really good definition of what needs to be built and why.

These aren't dev specs yet — it's all plain English describing the tasks and
needs users have.

## 4. Claude runs a Scope Workshop

This is where it gets good. (Detailed instructions live in the Scope Workshop
playbook, which tells the agent exactly how to run it.)

Claude spawns 3–5 subagents, gives each of them the full list of stories, and
has each design a solution from a fixed, deliberately different role:

- **Minimalist** — cuts as much as possible.
- **Conventionalist** — adopts tried-and-true patterns wherever it can.
- **Reframer** — explicitly told to assume that what Claude and I think needs
  building is wrong, so it always tries to reinterpret and reframe.
- **"Dad"** — basically freaks out when things get too complex.
- ...plus a couple of others.

Claude selects a roster, has me approve it, then spawns them in parallel.
When they finish, Claude analyzes and compares each subagent's scope
document — calling out:

- where they all tended to agree,
- the interesting paths where they disagreed, and
- its own recommendations on top.

All of that comes back to me and I pick how we proceed. By this point the
scope is about 1000× more detailed than I'd ever have produced on my own —
though I'll still steer a little here and there.

## 5. Claude runs a Design Bracket

Basically the same as the Scope Workshop, except:

- The winning scope document seeds this round.
- The subagents do front-end design and UX instead of scope.

Each subagent produces a wireframe layout. Then the one or two strongest
concepts get fully mocked up in HTML. I look at each one and pick my
favorite.

Example mockups from a bracket I ran recently:

- **Rethinker:** https://nff-admin-schedule-rethinker.netlify.app/
- **Minimalist:** https://nff-admin-schedule-minimalist.netlify.app/

## 6. I tell Claude to build it

By now I have two artifacts that drive everything:

- **Winning scope document** — includes all the criteria that must be met for
  the feature to be considered done.
- **Winning mockup** — the blueprint for the front end.

Claude can hang an entire, extremely detailed feature roadmap off those two
artifacts. When it's ready to implement, I tell it:

```
> Build the entire feature. But if you reach 85% of the context
  window, save a memory of exactly how far we are, and print out
  text I can copy that says exactly what to tell you to resume.
```

Then I clear the context window, paste the "how to resume" text, and it picks
up right where it left off. Repeat until the feature is done.

It still has the occasional question, but at that point I can pretty much
babysit from my phone while it grinds away. I've had it work on something for
nearly two hours with almost no input from me.
