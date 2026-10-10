# Free drawing safety review — October 2026

This is an **owner-operated review assistant**, NOT an automatic content-policing system.

## Components
- \`moderation.html\`: all pending drawings, filter, scan status and manual approve/remove/ban controls.
- \`moderation-feed.js\`: combines human review queue with prior flags and new local findings.
- \`moderation-feed-scanner.js\`: image decoding, open-source **Tesseract.js** OCR, **jsQR** reading, and an advisory **SigLIP** image comparison, all running in the **owner's browser**.
- \`public.crilo_local_drawing_scans\`: persistent advisory findings with FKs (on-delete cascade), row-level security and **no direct client access**.
- \`crilo_owner_local_scan_jobs\`, \`crilo_owner_local_scan_save\`, \`crilo_owner_local_scan_report\`, \`crilo_owner_local_scan_retry\`: owner-guarded, SECURITY DEFINER RPCs; executable only by signed-in roles after owner checking.
- \`owner-ban-drawing-account\` Edge Function v5: preserves existing owner-only/authenticated ban behavior; optional \`delete_run: true\` deletes the associated OFFICIAL run after the ban, otherwise retains score and hides artwork.
- \`owner-scan-drawings\` Edge Function v6: authenticated owner-only compatibility response, NO OpenAI or paid API requests.

## Behavior
- Scans batches of up to **3**, while the **Drawing Review browser tab is open**, checks for new submissions every 30 seconds, and stores results for future review.
- No processing while the owner's browser is closed. No server-side scheduled AI requests.
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
