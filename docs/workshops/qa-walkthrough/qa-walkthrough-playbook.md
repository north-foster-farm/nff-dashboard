# QA Walkthrough Audit — Playbook (v2)

How to run a recorded screen-and-voice QA pass of the app and turn it
into a triaged findings backlog. This is the **verification** track —
it runs *after* features are built (contrast the design playbooks in
`../scope-workshop/` and `../design-bracket/`, which run *before*). The
v1 of this method drove the 2026-06-04 whole-app audit (132 findings);
v2 updates it for the OBS capture rig and the `audit-v2/` layout.

```
  record (OBS)  ──►  process (local)  ──►  document  ──►  triage  ──►  fix
  desktop+iOS,       ffmpeg + whisper      findings.md   ~15 min      pre-authorized
  split per area     → transcript+frames   (F1…)         w/ James     fix: commits
```

The pipeline is what makes the narration matter: `scripts/process-audit.sh`
pulls the **audio** (→ whisper.cpp → a **timestamped transcript**) and a
**video frame per transcript segment**. Claude reads transcript + frame
together and writes one finding per issue. So **your voice is the data,
the frame is the evidence** — narrate accordingly. Nothing leaves the
machine.

---

## 0. Directory layout (`audit-v2/`)

Everything for this audit track nests under one root. `.ignored/` is
untracked, so these artifacts stay local (unlike v1, where `findings.md`
lived in the tracked `audits/` tree).

```
.ignored/audit-v2/
  raw/                          ← OBS records straight here (set in OBS)
  audits/
    <YYYY-MM-DD>/               ← one folder per recording run
      findings.md               ← the backlog; numbering restarts at F1 each run
      processed/<clip>/         ← transcript.md/.srt/.json + frames/ (generated)
  test-plan.md                  ← the per-run script the tester reads on a 2nd screen
```

- **One run = one dated folder.** Each run's `findings.md` starts at
  **F1** (do not continue numbering across runs).
- `raw/` and `processed/` hold large/disposable media; the durable
  record is `findings.md` + the per-clip `transcript.md`.

---

## 1. Capture setup — OBS

A reusable OBS rig records **Firefox (desktop) and real iOS Safari (via
the iPhone Mirroring app) side by side**, narrated, split into one file
per feature with a hotkey — no re-encoding. Because both panes are in one
capture, a single clip can carry **desktop and mobile** findings; say
which pane you're driving.

OBS stores config as two bundles you switch between from the top menu:
a **Profile** (encoding/output/hotkeys) and a **Scene Collection** (the
on-screen sources). Make one of each.

> **macOS Tahoe note:** recording a phone over **AirPlay / Screen
> Mirroring** black-screens on Tahoe 26. The dedicated **iPhone
> Mirroring app** survives screen recording — that's what this rig uses.
> Reliable but fragile: always run the 10-second test (§1.6) before a
> long session.

### 1.1 Permissions (do this first — the #1 failure point)
1. System Settings → Privacy & Security → **Screen Recording** → toggle
   OBS on (add with `+` if absent).
2. Same panel → **Accessibility** → toggle OBS on (and **Input
   Monitoring** if offered). This lets the split hotkey fire while
   you're focused in Firefox, not OBS.
3. **Fully quit** OBS (right-click dock → Quit) and reopen so the
   permissions take.

### 1.2 Profile (encoding) — the sharp-but-small recipe

Blurry UI text comes from OBS **scaling at the canvas stage**: a canvas
set below the source (e.g. 1080p/1440p on a 4K/Retina display)
double-scales and smears text. The fix that works: **capture at the
display's exact native resolution (zero canvas downscale), then do ONE
high-quality Lanczos-sharpened downscale to 1440p at the recording
stage.** Crisp text, reasonable file size. (Verified 2026-06-28 on the
external 4K monitor.)

1. Top menu → **Profile → New** → `NFF Bug Capture`.
2. **Settings → Video:**
   - **Base (Canvas) Resolution = Output (Scaled) Resolution = your
     display's native capture resolution.** On the external 4K monitor in
     HiDPI this is **6016×3384** — OBS then shows "Resolutions match, no
     downscaling required." **Do NOT** set the canvas to 1080p/1440p here;
     match the source exactly so there's no scaling blur at capture.
   - **Common FPS: 30** (24 if size is tight; 60 only for scroll-jank bugs).
3. **Settings → Output → Output Mode: Advanced** (Simple hides the
   keyframe interval + the rescale control).
4. **Recording** tab:
   - **Type:** Standard.
   - **Recording Path:** `.ignored/audit-v2/raw`.
   - **Generate File Name without Space:** ON (clean names for the pipeline).
   - **Recording Format:** **Hybrid MP4** — crash-safe and drops straight
     into the ffmpeg/whisper pipeline with no remux.
   - **Video Encoder:** **Apple VT H.264 Hardware Encoder.** *Not* HEVC:
     hardware HEVC encoding is heavy enough that it **lagged the iPhone
     Mirroring app to the point of being unusable** during capture. H.264
     hardware is lighter and leaves the mirrored phone smooth. (Verified
     2026-06-28. The trade-off — H.264 is less space-efficient than H.265
     — is covered by the higher bitrate below.)
   - **Audio Encoder:** CoreAudio AAC; **Audio Track 1**.
   - **Rescale Output: ON → "Lanczos (Sharpened scaling, 36 samples)" →
     2560×1440.** This is the single clean downscale from the native
     capture — the step that keeps text legible at a small file size.
5. **Encoder Settings** (Recording tab, lower section):
   - **Rate Control: CBR**, **Bitrate: 16000 Kbps** — H.264 needs more
     bits than HEVC for the same clarity; 16000 keeps 1440p UI text crisp
     at a still-reasonable file size.
   - **Keyframe Interval: 2 s** — what makes clean, no-re-encode splits
     possible. (Leave "Automatic File Splitting" off — you split manually
     with the hotkey.)
   - **Profile: high** (the H.264 default) · **Use B-Frames: ON** · leave
     any other encoder options at their defaults.

### 1.3 Scene (the capture source)
1. Top menu → **Scene Collection → New** → `Desktop + iOS`.
2. **Sources** panel → `+` → **macOS Screen Capture**.
3. **Method: Display Capture**; pick the monitor where Firefox and the
   iPhone Mirroring window sit side by side (two windows, one capture).
4. If it shows black: on OBS 32.1+ delete the source and add a fresh one
   after re-granting Screen Recording permission (a known init quirk).

### 1.4 Audio
Settings → Audio → **Mic/Auxiliary Audio** → your actual microphone.
Leave Desktop Audio off unless you want app sounds.

### 1.5 Splitting into one file per feature

Two ways; **method A is the reliable default** on macOS.

**A — Stop / Start per feature (recommended).** At each feature boundary,
click **Stop Recording** then **Start Recording** in the Controls dock
(bottom-right). Each Start→Stop writes its own numbered file — exactly
what the pipeline wants, with no global-hotkey dependency. The ~1 s gap is
harmless. OBS has **no dedicated one-click "split" button**, so this is
the clickable equivalent.

**B — Split-recording hotkey (optional, fragile on macOS).** Settings →
**Hotkeys** → search **"Split Recording File"** → bind a key. For it to
fire **while OBS is minimized** (which it is during capture), you MUST
have granted **both Accessibility and Input Monitoring** in §1.1 and fully
quit + reopened OBS afterward — otherwise the key only works when OBS is
the front app and nothing splits. Also avoid F13–F19 keys your keyboard
doesn't physically have, and keys Firefox/macOS already use; `⌃⌥S` is a
safe choice. **Test it minimized before trusting it.**

> If you forget to split and end up with one long file, that's fine — drop
> it in `raw/` anyway; Claude segments the findings by your spoken
> area-markers ("I'm on the Schedule page now…"). Splitting is a
> convenience, not a requirement.

Optionally also bind **Start/Stop Recording** to make method A one-handed.

### 1.6 Test before you trust it (every session)
1. Open Firefox + the iPhone Mirroring app; arrange both on the capture
   monitor.
2. Record, touch both for ~10 s, stop.
3. Confirm the iPhone pane is **actually visible, not black**.
4. **Fallback if black:** QuickTime device capture — plug the iPhone in
   via USB → QuickTime → New Movie Recording → select the iPhone →
   capture that QuickTime window instead.

### 1.7 Record-time loop
1. Start recording.
2. **Minimize OBS to the dock** (avoids the recursive-mirror effect on a
   single display; recording keeps running).
3. Walk through feature 1, narrating (follow `test-plan.md`).
4. At each feature boundary, **Stop then Start** a new recording (method A
   in §1.5), or press the split hotkey if you've verified it (method B).
5. Stop at the end.

You get sequentially numbered files, one per feature — ready for the
pipeline. Sequence is recoverable from the numbering **and** file mtime
(process oldest→newest). One long unsplit file is fine too — Claude
segments findings by your spoken area-markers.

### 1.8 Backup / portability
Once dialed in: **Profile → Export** writes the whole settings bundle to
a folder you can drop into a dotfiles repo — version-controlled and
portable to a new machine.

---

## 2. How to narrate (so transcript + frame line up)

- **Say the screen on arrival.** "I'm on the Schedule page now." Anchors
  every following finding to the right frame.
- **Say which pane.** "On the phone…" / "back on desktop…" — the capture
  shows both; the transcript needs to know which you mean.
- **Point with words, not the cursor.** A still frame can't show a waved
  cursor: "the green pill top-right", "the row that says Batch 3".
- **One issue, then a beat.** Finish the thought, pause ~1 s, next.
  Run-on narration smears two findings into one segment.
- **Demonstrate the problem.** Click the thing that misbehaves, hover the
  unclear affordance, type into the awkward field — the frame should
  *show* it.
- **Rate it as you go.** "nitpick" / "confusing" / "broken" / "this would
  stop me using it" pre-sorts the triage. Severity in your words is gold.
- **Praise what works.** "This is exactly right, don't touch it" is a
  finding too — it protects good parts from churn.
- **Name the fix if you have one,** but don't force it. "I'd want this
  newest-first" beats silence; "something feels off here" still gets
  diagnosed.

### The lenses — what to react to on every screen
A prompt for "what should I notice?", not a script to recite:

| Lens | Ask out loud |
|------|--------------|
| **Purpose** | Do I instantly get what this screen is *for*? |
| **Hierarchy** | Is the most important thing the most prominent? |
| **Friction** | How many taps to the common task? What's repetitive? |
| **Naming/copy** | Do labels match how I talk about the farm? Jargon? |
| **Trust** | Do the numbers look *right*? Anything that makes me doubt the data? |
| **Aesthetics** | On-brand, or cluttered/sparse/off? |
| **Missing** | What did I expect that isn't here? |
| **Flow** | Does the path *between* screens match a real task? |
| **Emotion** | Gut reaction — delight or irritation? |

---

## 3. The traversal

For a focused QA pass, the **per-run `test-plan.md` is the route** — a
click-level script with inline assertions and (for Schedule & Chores)
story checkboxes. Keep it on a second screen / phone and work top to
bottom, splitting the recording at each major area.

Order the recording by priority; for the current pass that is:
**Schedule (1) → Chores (2)** first — the two story-scoped features —
then Rounds · Events · Processes · Projects, then the secondary surfaces
(Now · Farm map · Dashboard · Metrics · Broilers · Layers). Split the
file at each of those boundaries so each feature lands in its own clip.

When there's no test plan (an open-ended pass), fall back to the lenses
above and cover every screen once.

---

## 4. Processing (Claude, local)

Run **one clip per conversation/context window** — each transcript is
large and documenting it well fills a context window.

1. **Process** (transcribe + frames). Point the script at the v2 dirs:
   ```bash
   RAW_DIR=.ignored/audit-v2/raw \
   OUT_ROOT=.ignored/audit-v2/audits/$(date +%F)/processed \
   scripts/process-audit.sh .ignored/audit-v2/raw/<clip>.mp4
   ```
   (Omit the trailing path to process every clip in `RAW_DIR/` in sorted
   order.) Runs ffmpeg → whisper.cpp → one frame per segment. Slow —
   run in the background and poll the output file. Do **not** pass
   `--cleanup` yet; keep the source until findings are written.
2. **Read the transcript** — `processed/<clip>/transcript.md`, every
   line `[mm:ss] narration → frames/NNNN_mm-ss.jpg`. Read all of it.
3. **View the frames** for each narrated issue (`Read` the `.jpg`),
   confirm what's on screen, grep the codebase for the responsible
   component, cite exact `file:line`.
4. **Append findings** to `audits/<date>/findings.md` (format in §5).
5. **Trash the source** once findings exist — re-run with `--cleanup`
   (moves the clip to macOS Trash, never `rm`), or `mv` it to `~/.Trash/`
   yourself. The `processed/` transcript is the durable record.
6. **Update the run's HANDOFF/notes** (clips done, next F-number),
   then clear context and resume on the next clip.

**Tooling:** needs `ffmpeg` + `whisper-cli` (whisper.cpp) + the model at
`~/.cache/whisper.cpp/ggml-base.en.bin`. Env overrides: `RAW_DIR`,
`OUT_ROOT`, `WHISPER_BIN`, `WHISPER_MODEL`, `FRAME_WIDTH`,
`SEGMENT_MAX_CHARS`, `CLEANUP`.

---

## 5. Findings format (match exactly)

Per clip, a top-level section, separated from the previous by `---`:

```
# Clip N — <area summary>

Source: `<clip-name>.mp4` (M:SS, K segments).
Processed: `audits/<date>/processed/<clip-name>/`.

## <Page or area>

### F<n> — <imperative title>  ·  <SIZE>  ·  `[ ]`  ·  *<tag>*
> "exact quote from James" — [mm:ss]

Frame: `frames/NNNN_mm-ss.jpg`. <Diagnosis: what's wrong, the
responsible `src/.../File.jsx:line`, and the concrete change.>
```

- **SIZE:** `S` (≤30 min) · `M` (≤2 h) · `L` (half-day+) · `?` (unknown,
  usually a bug to scope) · `—` (parked/deferred, no size).
- **`[ ]`** triage/fix checkbox — start unchecked.
- **`*tag*`** (optional): `*verify*`, `*clarify*`, `*discuss*`,
  `*design*`, `*bug*`, `*feature*`, `*pattern*`, `*deferred*`,
  `*desktop*`, `*mobile*`. Use when the finding needs a decision, isn't a
  straight fix, you're unsure it reproduces, or to mark which pane.
- Quote James **verbatim** with the `[mm:ss]`.
- Close each clip with `## Confirmed working — <area>` bullets (things he
  said are good — equally valuable signal), and `## Non-findings` /
  `## Parked by James` when he retracts or defers something on tape.

---

## 6. Triage & fix

1. **Triage together (~15 min):** fix misreads, kill non-issues, set
   size/priority, pre-authorize the fix list. Watch for cross-cutting
   themes worth fixing once (a shared token/pattern) rather than
   per-screen.
2. **Fix top-down** while James is at the farm — each finding its own
   `fix:` commit (pre-authorized at triage; this is the standing
   exception to the ask-before-each-commit rule).
3. **Migrations / prod deletes are never done unattended** — park them
   for James (exact-id only, with him present). The app is live.

---

## Hard rules
- **Capture/document only** until triage — no code fixes or commits in
  the documentation phase.
- **Never touch migrations or prod data** during a walkthrough. The app
  is live.
- **Trash, never `rm`,** the source clips — a clip may contain anything
  that was on screen; Trash is recoverable.
- Don't actually delete prod rows on tape — *say* "I'd delete this here".
  For create flows, make a row and say "I'll clean this up", or narrate
  without submitting.

## Pre-flight checklist
- [ ] OBS Screen Recording **+ Accessibility** permissions on; OBS
      restarted after granting
- [ ] Profile `NFF Bug Capture` + Scene `Desktop + iOS` selected
- [ ] Canvas = display **native** (4K monitor: 6016×3384, no canvas
      downscale); recording **Rescale Output** = Lanczos-sharpened 2560×1440
- [ ] Recording path = `.ignored/audit-v2/raw`
- [ ] 10-second test passed — iPhone pane **visible, not black**
- [ ] Mic selected + tested; notifications quiet; Firefox window ~1280–1440px
- [ ] `test-plan.md` open on a second screen
- [ ] Splitting plan ready: Stop/Start per feature (or split hotkey
      tested **while OBS is minimized** — needs Accessibility + Input
      Monitoring)
