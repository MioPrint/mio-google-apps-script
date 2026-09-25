# 09: Run state model

Map: `.scratch/drive_downloader-map/map.md`

Type: grilling
Status: open
Blocked by: None

## Question

What is the exact state machine for a Run and for each file inside it?

- Run states and transitions: idle, running, paused, stopping, finished;
  what Pause, Resume, Stop, closing the Disk Window and Launcher Page do in
  each.
- Per-file phases: checking exists, fetching (ranged chunks), finalizing
  (Chrome's write pass, ~45 s at 20 GB), done/failed; what Pause and Stop
  do in each phase (e.g. Stop during finalizing).
- Attempts: which errors are transient (consume an Attempt) versus
  permanent (fail at once); when a retry resumes from the last byte versus
  restarts from 0; Native Files via `files.download` (no resume, no total)
  and how their Attempts and progress work.
- Token refresh timing inside the machine.
- What the frontend holds versus what GAS holds (GAS is stateless per
  call?), and whether any Run state survives a reload.

Inputs: "End-to-end byte-path spike", "Disk Window design", CONTEXT.md
(Run, Attempt, Item Status).
