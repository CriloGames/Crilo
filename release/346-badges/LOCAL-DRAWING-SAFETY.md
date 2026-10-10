# Free drawing safety review — October 2026

This is an **owner-operated review assistant**, NOT an automatic content-policing system.

## Components
- \`moderation.html\`: all pending drawings, filter, scan status and manual approve/remove/ban controls.
- \`moderation-feed.js\`: combines human review queue with prior flags and new local findings.
- \`moderation-feed-scanner.js\`: image decoding, open-source **Tesseract.js** OCR, **jsQR** reading, and an advisory **SigLIP** image comparison, all running **inside a dedicated owner-browser Web Worker**, not the UI thread.
- \`public.crilo_local_drawing_scans\`: persistent advisory findings with FKs (on-delete cascade), row-level security and **no direct client access**.
- \`crilo_owner_local_scan_jobs\`, \`crilo_owner_local_scan_save\`, \`crilo_owner_local_scan_report\`, \`crilo_owner_local_scan_retry\`: owner-guarded, SECURITY DEFINER RPCs; executable only by signed-in roles after owner checking.
- \`owner-ban-drawing-account\` Edge Function v5: preserves existing owner-only/authenticated ban behavior; optional \`delete_run: true\` deletes the associated OFFICIAL run after the ban, otherwise retains score and hides artwork.
- \`owner-scan-drawings\` Edge Function v6: authenticated owner-only compatibility response, NO OpenAI or paid API requests.

## Behavior
- Scans **one drawing at a time** using a background Web Worker while the **Drawing Review browser tab is open**. Small gaps between jobs prevent large CPU bursts. Scan findings are saved for later review. The owner may pause/resume or manually scan the next drawing; auto scanning is enabled by default.
- No processing while the owner's browser is closed, paused or hidden. No server-side scheduled AI requests. The list refreshes every 30 seconds independently of scanning, and unchanged thumbnails are not decoded/re-rendered.
- Bad words, hostile text, and written URLs: OCR + normalization + local heuristics.
- QR codes: locally decoded actual QR patterns. Visual model may additionally mark QR-*like* images.
- Possible hateful symbols, explicit genital drawings, sexual imagery and graphic injury: **relative image/text similarity** in a generic model, **not reliable detection or calibrated confidence**.
- \`scan_version\` and \`status='partial'\` allow review even when OCR/model assets are unavailable. A partial/unchecked drawing is never asserted to be safe.
- Human owner can approve a drawing, permanently delete an official run after **two prompts**, ban an account after **two prompts**, optionally delete that same run, or rescan.
- OWNER TEST RUNS may be scanned for QA but cannot trigger account actions, public leaderboard entries or real badge awards.

## Limitations and cost
**No paid API usage is incurred by this pipeline.** Model/runtime files are fetched to the owner's browser on first use, so bandwidth and processing time can be substantial, and free CDN/model availability isn't guaranteed. QR decoding, text recognition, and visual classification can all miss violations or produce false positives. The owner must still inspect every reported item, and can inspect all drawings regardless of labels. There is no guarantee of near-100% detection and no image is automatically removed or account banned based on ML output.

## Regression checks
\`node release/346-badges/021-free-drawing-moderation-smoke.cjs\` validates client wiring, text/link patterns, harmless cases, visually suspicious predictions, manual owner control protections and absence of paid API calls. The existing 346-badge validation workflow runs it on \`main\` pushes.

**Manual owner QA:** Open Drawing Review as Owner, confirm the status changes to on-device scanning, load an ordinary drawing, test a deliberately constructed small QR/text drawing in an isolated Owner Test Run, view advisory categories in lightbox, confirm actions are disabled on Owner Test Runs and confirm there are no auto-bans/deletions. Test on physical phones/tablets separately. Do not perform real bans or deletions merely for QA.

## Deployment verification
GitHub commits alone do not establish GitHub Pages deployment status. Check the Actions tabs for both the 346 badge checks and the Pages publish run; verify new JS/CSS version references in the published page. Never claim that real-device classification, CDN loading or GitHub Pages propagation was tested by static checks.


## Responsive performance improvements
- \`moderation-scan-worker.js\` loads QR, Tesseract and SigLIP off the UI thread; OffscreenCanvas scales images without blocking the review interface.
- OCR uses one reasonably sized pass instead of a 900px scan + another high-contrast pass for each image. Some subtle handwriting may be missed, so manual inspection remains essential.
- Worker scans one job per queue request and can be stopped. The scanner intentionally does not process saved Owner Test Runs until **Include my Test Runs** is enabled.
- All controls and scanning status are gathered near the top, with four summary counters and a simplified mobile layout.
- \`node release/346-badges/022-drawing-scanner-worker-qa.cjs\` exercises QR/OCR mock worker processing, pause, owner guards, test isolation and avoidance of redundant base64 thumbnail repainting.

## Outlined-genital false-negative correction (October 10)
A real Owner Test Run containing a simple outlined genital drawing returned no visual match (relative score roughly 0.002) under the generic SigLIP comparison. The original `NO FLAGS` was a false negative.

- Added `moderation-shape-review.js`, a small off-main-thread contour geometry hint for one elongated closed stroke region adjoining two rounded regions. It is rotation-tolerant and only produces **possible genital drawing** advisories. Similar innocent doodles can be flagged, so the owner must inspect them.
- The worker always runs this lightweight check before the optional large image model (if image scanning is enabled).
- Generic image-model scores below 0.10 are treated as **inconclusive**, not proof of safety. Uncertain, partial, or legacy weak model results are prioritized for manual review instead of showing `NO FLAGS`.
- Local scan records now use `scan_version=2`; earlier version-1 scans are eligible for rechecking without changing existing runs, scores, badges, or accounts.
- `release/346-badges/023-outline-safety-review-smoke.cjs` tests several rotation angles, benign negative fixtures, and integration with the worker. These are synthetic smoke tests, not measured accuracy/recall.

For this specific Owner Test Run: keep **Include my Test Runs** and **Include image and symbol detection** checked, wait for the new worker to scan, or select **Scan this drawing**. Never automatically delete, ban, or approve based on these checks.
