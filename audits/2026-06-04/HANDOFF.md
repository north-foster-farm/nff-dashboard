# Audit loop — handoff briefing (2026-06-04 walkthrough)

> ## ✅ CAPTURE COMPLETE (2026-06-04)
> All 12 clips + pilot are processed and documented. `audits/raw/` is
> empty; every `.mov` is in the Trash. **132 findings (F1–F132)** are in
> `audits/2026-06-04/findings.md`. There is **nothing left to process**.
> The next step is no longer this loop — it's the **~15-min triage with
> James** (assign sizes/priorities, check off, then the pre-authorized
> `fix:` session). See "After capture" at the bottom.
>
> The procedure below is retained as the reusable playbook for the next
> recorded-walkthrough audit (e.g. the Batch 35 responsiveness pass).

Start a fresh conversation with: *"Read `audits/2026-06-04/HANDOFF.md`
and continue the audit loop."* This file is the single source of truth
for where we are and exactly what to do next.

---

## What this is

James recorded a screen-and-voice walkthrough of the whole app, split
across many `.mov` clips, narrating bugs **and** design/UX issues (both
are findings on one backlog). We process each clip locally into a
transcript + frames, then write triaged findings into
`audits/2026-06-04/findings.md`. No code is fixed in this phase — this
is **capture + documentation only**. Fixing happens later, after a
~15-min triage with James (see `project_audit_workflow` memory and
ROADMAP Batch 40).

Nothing leaves the machine: ffmpeg pulls audio, local whisper.cpp
transcribes, ffmpeg grabs one frame per spoken segment.

---

## Current state

**Done — documented in `findings.md` as F1–F38:**

| Clip | File | Len | Findings |
|------|------|-----|----------|
| pilot | `pilot-2026-06-04` | — | pipeline validation only |
| 1 | `walkthrough-2026-06-04` | 7:01 | F1–F8 (top bar, capture, inbox) |
| 2 | `walkthrough-2-2026-06-04` | 4:34 | F9–F13 (Now, Farm map) |
| 3 | `walkthrough-3-2026-06-04` | 13:17 | F14–F27 (Dashboard, Broilers) |
| 4 | `walkthrough-4-2026-06-04` | 10:23 | F28–F38 (Metrics) |
| 5 | `walkthrough-5-2026-06-04` | 3:27 | F39–F42 (Metrics cont'd) |
| 6 | `walkthrough-6-2026-06-04` | 10:18 | F43–F55 (Schedule) |
| 7 | `walkthrough-7-2026-06-04` | 9:30 | F56–F64 (Schedule Agenda) |
| 8 | `walkthrough-8-2026-06-04` | 8:24 | F65–F74 (Chores Today) |
| 9 | `walkthrough-9-2026-06-04` | 11:00 | F75–F83 (Chores: notes/form) |
| 10 | `walkthrough-10-2026-06-04` | 11:00 | F84–F93 (Processes & Projects) |
| 11 | `walkthrough-11-2026-06-04` | 18:56 | F94–F111 (Projects deep-dive) |
| 12 | `walkthrough-12-2026-06-04` | 24:30 | F112–F132 (Animals + Feed) |

All source `.mov` files have been trashed (recoverable from macOS Trash
until emptied). Transcripts + frames live in
`audits/2026-06-04/processed/<name>/`.

**Remaining in `audits/raw/`: none — all clips processed.** ✅

**Verification pass (2026-06-04, eve):** after Batch 41 shipped, James
recorded a 6:26 re-walkthrough of the new block-model chores on the
`v0.10.41-alpha` bundle. Processed to
`processed/chores-verify-2026-06-04/`; findings **F133–F138** appended to
`findings.md` (Now collapse + iconography, Rounds done-screen + the
start/stop/cancel rework, chore-nesting indentation, row-meta on Today).
Verdict: "seems to be working pretty well otherwise."

**Next finding number (if more clips arrive): F139.**

---

## The loop — exact procedure (one clip per iteration)

Do **one clip per conversation**, then clear context. Each clip's
transcript is large; documenting it well fills a context window.

1. **Process the clip** (transcribe + frames):

   ```
   scripts/process-audit.sh audits/raw/walkthrough-N-2026-06-04.mov
   ```

   Runs ffmpeg → whisper.cpp → one frame per segment. Takes a few
   minutes; run it in the background and poll the output file. Output
   lands in `audits/2026-06-04/processed/walkthrough-N-2026-06-04/`
   (`transcript.md`, `transcript.srt`, `transcript.json`, `frames/`).
   Do **not** pass `--cleanup` here — keep the `.mov` until findings
   are written (step 4), in case a finding needs a frame the script
   didn't grab.

2. **Read the transcript.** Open `<clip>/transcript.md` — each line is
   `[mm:ss] narration → frames/NNNN_mm-ss.jpg`. Read **all** of it.

3. **View the relevant frames.** For each issue James narrates, open
   the referenced frame (`Read` the `.jpg`) to confirm what's on screen
   and find the responsible component/file. Grep the codebase for the
   component to cite exact `file:line`.

4. **Append findings to `findings.md`.** Match the house format exactly
   (see "Findings format" below). Add a `# Clip N — <areas>` section
   separated from the previous clip by a `---` / `---` pair. Continue
   the F-numbering. Include `## Confirmed working` and, where they
   apply, `## Non-findings (retracted on tape)` / `## Parked by James`.

5. **Trash the source `.mov`** now that findings exist:

   ```
   scripts/process-audit.sh audits/raw/walkthrough-N-2026-06-04.mov --cleanup
   ```

   This re-runs fast (transcript already there) and moves the `.mov` to
   Trash. *Or* simply `mv` it to `~/.Trash/` yourself. Never `rm` — the
   `.mov` may contain anything that was on screen, and Trash is
   recoverable. (The `processed/` transcript is the durable record;
   it's gitignored but stays on disk.)

6. **Update this file:** mark the clip done in the tables above, bump
   "Next finding number", note anything unusual.

7. **Prompt James to clear context**, then resume on the next clip.

---

## Findings format (match exactly)

Per clip, a top-level section:

```
# Clip N — <area summary>

Source: `walkthrough-N-2026-06-04.mov` (M:SS, K segments).
Processed: `audits/2026-06-04/processed/walkthrough-N-2026-06-04/`.

Scope of this clip: <1–2 sentences> (optional).

## <Page or area>

### F<n> — <imperative title>  ·  <SIZE>  ·  `[ ]`  ·  *<tag>*
> "exact quote from James" — [mm:ss]

Frame: `frames/NNNN_mm-ss.jpg`. <Diagnosis: what's wrong, the
responsible `src/.../File.jsx:line`, and the concrete change.>
```

- **SIZE:** `S` (≤30 min) · `M` (≤2 h) · `L` (half-day+) · `?` (unknown,
  usually a bug to scope) · `—` (parked/deferred, no size).
- **`[ ]`** is the triage/fix checkbox — always start unchecked.
- **Optional `*tag*`** after the checkbox: `*verify*`, `*clarify*`,
  `*discuss*`, `*design*`, `*bug*`, `*feature*`, `*pattern*`,
  `*deferred*`. Use when the finding needs a decision, isn't a
  straightforward fix, or you're not certain it reproduces.
- Quote James **verbatim** from the transcript with the timestamp.
- Close each clip with `## Confirmed working — <area> (clip N)` bullets
  (things he explicitly said are good — equally valuable signal), and
  add `## Non-findings` / `## Parked by James` sections when he retracts
  something on tape or defers it himself.

---

## Hard rules

- **No code fixes, no commits** in this phase. Capture only. (The
  separate audit *fix* sessions — pre-authorized `fix:` commits — come
  after triage, not now.)
- **Never touch migrations or prod data.** The app is live.
- **Trash, never `rm`,** the `.mov` sources.
- `audits/raw/` and `audits/*/processed/` are gitignored; only
  `findings.md`, this file, and `walkthrough-guide.md` are tracked.

## Tooling notes

- `scripts/process-audit.sh` has an uncommitted `--cleanup` /
  `CLEANUP=1` addition (the trash-after-processing mechanism described
  above). It's working but not yet committed — decide with James
  whether to land it as a `chore:`/`feat:` commit. Until then it lives
  in the working tree.
- Requires `ffmpeg` + `whisper-cli` (whisper.cpp) + the
  `~/.cache/whisper.cpp/ggml-base.en.bin` model — all present as of
  2026-06-04. Machine is an M1 / 16 GB.

---

## After capture — triage & what's parked

Capture is done. The next session's job is **triage with James**, then a
pre-authorized `fix:` pass. Notes for that session:

- **Scale of the backlog:** 132 findings across the whole app. Heavy
  clusters: Schedule (F43–F64), Chores (F65–F83), Processes/Projects
  (F84–F111), Animals/Feed (F112–F132).
- **Cross-cutting themes** to fix once, not per-screen:
  * *Gray-as-disabled* — F46, F52, F63, F83, F104, F131 all want
    dark-gray "active/today/badge" fills replaced with outlines or a
    much lighter tint. One design-token decision.
  * *Color system* — F11, F103, F128, F130: define category/state
    colors once on the type and cascade to filters/calendar/labels.
  * *Search-first pickers* — F86, F107: replace giant entity lists with
    search comboboxes.
  * *Save pattern + inline edit* — F92, F99, F105, F109, F118: one
    app-wide save-on-blur + inline-edit/drawer convention.
  * *Leverage ordering attributes* — F79, F80, F88: stop sorting by
    creation order where a real order attribute exists.
  * *Now-style headers* — F65, F94.
  * *Hover-for-definition* — F28 (reinforced on the animal pages, clip
    12).
- **Big model directives** (need James, not unattended): F85 (kill
  "tasks" from processes), F106 (project link entity set), F112 (flock /
  cohabitation model), F121 (multiple feeds per stage).
- **Parked — prod data / migrations, never unattended** (per the data-
  safety rules): F41 (layer-mortality definition migration), F73 (delete
  "Overnight brooder check" demo chore), F114 (backfill layer arrival
  dates), F125 (delete sheep feed schedule). All deletes are exact-id
  only, with James present.
- **Needs investigation before relying on it:** F108 (no file-storage
  backend configured).
- **Likely quick wins** (small, concrete, low-risk): F1, F2, F37/F39,
  F50, F68, F72, F91, F93, F95, F124, F127, F129, F132.

## Loose ends from the capture session

- `scripts/process-audit.sh` `--cleanup` is still **uncommitted** (see
  Tooling notes) — land it or leave it, James's call.
- `audits/walkthrough-guide.md` had an accidental stray-space typo in
  its H1 during this session; it was reverted. Clean as of now.
