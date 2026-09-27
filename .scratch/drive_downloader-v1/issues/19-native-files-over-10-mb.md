# 19: Native Files over 10 MB

Spec: `.scratch/drive_downloader-v1/spec.md` (stories 38, 113; Run state machine "Byte path per file kind")

**What to build:** A Google Sheet, Doc or Slides file over Drive's 10 MB export cap downloads as its Office file instead of failing after every Attempt. The first acceptance pass saw this failure on a Sheet. The export falls back to the `files.download` LRO and then fetches its `downloadUri`, and that path breaks somewhere.

**Blocked by:** 18 (a refusal then fails on the first Attempt with Drive's answer as its reason, which makes diagnosis quick)

**Status:** ready-for-agent

- [ ] Diagnose first. Ask the user to rerun the over-10 MB Sheet on a deployment that includes 18, then report two things. First, the failed chip's hover reason. Second, the DevTools Network rows for the export, `files.download`, `operations` and `downloadUri` requests (status, redirect, CORS error). Record the findings in this ticket's Comments
- [ ] Candidates to check against the findings:
  - CORS or redirect failure on the `docs.google.com` `downloadUri`;
  - the resource-key header sent to that host;
  - a non-JSON 403;
  - LRO polling;
  - an `exportLinks` fallback, if the LRO path can't work from the browser
- [ ] Fix so the over-10 MB Native File is written to disk with its Office extension and shows its real size when done
- [ ] Client-core test reproducing the diagnosed failure on the fake Drive, then passing
- [ ] Spec's byte-path decision updated with the root cause and fix
- [ ] `npm run check` passes
