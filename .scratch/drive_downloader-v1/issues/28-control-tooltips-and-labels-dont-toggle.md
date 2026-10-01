# 28: Control tooltips; labels don't toggle

Spec: `.scratch/drive_downloader-v1/spec.md` (stories 122, 128, 131; Disk Window core modules "Tooltips"; UI)

**What to build:** Hovering 2 s over a button in the setup row, the Run row or the Expand/Collapse row, or over an option checkbox or its text, fades in a short description of what it does (disabled ones too; fixed texts, never "why disabled"). It hides at once when the pointer leaves. The option checkboxes toggle only when the box itself is clicked, not their text. This ticket builds the tooltip mechanism ticket 29 reuses: one floating element, a per-target delay, about 150 ms fade.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Tooltip mechanism in the view: delay per target, fade in, hide on leave, positioned so it stays in the window
- [ ] Control descriptions from the spec's draft, set in the markup; works on disabled buttons
- [ ] Option checkboxes no longer wrapped in labels; clicking the text does nothing; the tooltip covers box and text
- [ ] Manual check on a deployment: 2 s delay, fade, every control's text, disabled buttons, label clicks inert
- [ ] `npm run check` passes
