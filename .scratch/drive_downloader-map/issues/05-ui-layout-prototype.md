# 05: UI layout and Tree view prototype

Map: `.scratch/drive_downloader-map/map.md`

Type: prototype
Status: open
Blocked by: 08

## Question

How should the page look and behave? A throwaway static HTML mock with fake
data showing:

- The URL field, Read Drive, Location with "📁 <name>", the spaces → `_`
  checkbox, and Download/Pause/Resume/Stop, with their enabled and locked
  states
- Error display for a bad URL
- The expanded Tree with every Item Status, progress bars with bytes,
  folder totals, the overall bar, and Local Name on hover

The user reacts to it until the layout is settled.

## Comments

- 2026-09-25, from "Tree naming, sibling order and Native File sizes": the
  mock also needs the "Use Shortcut target names" (off) and "Skip existing
  files" (checked) checkboxes; a ↪ badge on Shortcuts with the other name on
  hover; `?` sizes on Native Files and `+` on totals above them; bytes with
  no percentage for a downloading Native File; an "overwrites" hover note on
  pending files; and the "N existing files will be overwritten. Continue?"
  confirm.
