# 09: Run state model

Map: `.scratch/drive_downloader-map/map.md`

Type: grilling
Status: resolved
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

## Answer

Resolved with the user, 2026-09-26, over two rounds.

**Run states:** `idle` (no Tree or no folder; Download disabled) → `ready`
→ `running` ⇄ `paused` → `stopping` (only while waiting on finalizing) →
`finished`. `finished` is `ready` plus the Run summary: inputs unlock,
statuses stay visible; Download starts a new Run with statuses reset to
pending ("Skip existing files" carries on from done files). Read Drive or a
naming checkbox after `finished` recomputes the Tree → `ready`.

Disk errors (disk full `QuotaExceededError`, permission lost, Target Folder
moved or deleted) **pause the Run** with a message; the current file keeps
its bytes; Resume retries, re-requesting permission on the Resume click.

**File phases** (one file, in order): checking (exists check) →
transferring (chunks) ⇄ waiting to retry → finalizing (Chrome's `close()`,
~45 s at 20 GB, uninterruptible) → done / failed. Phases are not Item
Statuses: the Item stays **downloading**; finalizing shows a full bar and
"finalizing…", waits show "retry 2/4 in 10 s" in the status line and on
hover.

| Phase                                      | Pause                                                                       | Stop                                                                                                                                |
| ------------------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| transferring (resumable)                   | abort the fetch, keep the writable; Resume sends `Range` from bytes written | `writable.abort()`; a new file is removed (`removeEntry`), an overwritten one survives untouched ("kept"); file back to **pending** |
| transferring (Native via `files.download`) | abort, discard bytes; Resume restarts it from 0, no Attempt used            | as above                                                                                                                            |
| waiting to retry                           | cancel the wait; Resume starts the next Attempt at once                     | as above                                                                                                                            |
| finalizing                                 | "Pausing…" until done, then paused before the next file                     | `stopping`, "Finishing current file…"; file kept as **done**, then the Run ends                                                     |

Files not reached stay pending after Stop.

**Attempts:** only transient failures use them (network, 5xx, 429, a 401
surviving a refresh, a failed token fetch); permanent ones fail at once
(settled by the spike). **An Attempt that writes new bytes before failing
resets the count** (CONTEXT.md "Attempt" updated), so only five failures
without progress fail a file. Waits before Attempts 2–5: 2 s, 10 s, 30 s,
60 s; `Retry-After` on 429/503 honoured, capped at 5 min. While
`navigator.onLine` is false, wait for `online` without using an Attempt.
Resume vs restart: Attempts 2–4 resume from bytes written, 5 restarts from
0; Native Files over 10 MB always start from 0 and show bytes only.

**Completion check:** after finalizing, size on disk must equal Drive
`size` (skipped for Native Files, which have none). Mismatch → transient
failure, next Attempt restarts from 0. No MD5.

**Token:** fetched at Run start, refreshed before a chunk when older than
10 min, and on a 401 (then the same range is retried, no Attempt used).

**Frontend vs GAS:** GAS is stateless per call: Tree reading (in chunks
with continuation) and the token. All Run state lives in Disk Window
memory; the Tree and Run never survive a reload. Kept across visits: the
folder handle (IndexedDB); the last Source Folder URL, "Replace spaces with
_", "Use Shortcut target names" and "Keep screen awake" (localStorage).
"Skip existing files" always starts checked.

**Order and folders:** files are processed in Tree order (depth-first,
sibling order as in "Tree naming, sibling order and Native File sizes").
A local folder is created when the Run reaches it, only if it is empty in
Drive or has at least one selected file below it (a fully unticked branch
leaves nothing). A folder that can't be created fails all its files
("folder could not be created").

**Sleep:** new checkbox "Keep screen awake during download", on by default,
usable during a Run, remembered. It holds a Screen Wake Lock while
`running` (released on pause/finish, re-requested when the window becomes
visible again); this also blocks idle system sleep. It can't stop a lid
close. The Launcher Page docs explain setting the computer not to sleep if
the user turns it off.
