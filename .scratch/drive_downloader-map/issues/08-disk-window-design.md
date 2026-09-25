# 08: Disk Window design

Map: `.scratch/drive_downloader-map/map.md`

Type: grilling
Status: open
Blocked by: 04

## Question

With the Disk Window (an unsandboxed same-origin popup) proven by the spike,
decide:

- Does the whole page (URL field, Tree, controls) live in the Disk Window, or
  does the Disk Window stay a thin disk writer driven from the GAS iframe?
- What happens if the user closes the Disk Window mid-Run (treated as Pause?
  Stop?)?
- The "Location" default: Chrome won't accept Downloads itself, so is it a
  fixed sub-folder such as `Downloads/drive_downloader`, or no default?
- An empty file left by a crash under a Local Name: treat it as "exists", or
  allow replacing a 0-byte file?
- Whether "remembered folder" holds, given what the spike found about host
  stability.
