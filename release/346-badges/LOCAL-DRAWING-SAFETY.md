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


## False-positive correction (October 10, 2026)
- Previously the UI treated any vision similarity below 0.10 as \`REVIEW SUGGESTED\`. This was a false-positive bug: low similarity is not evidence of inappropriate art. Removed from both the scanner and the UI.
- \`REVIEW SUGGESTED\`: only detected scan reasons (or separately recorded earlier flags).
- \`INCOMPLETE CHECK\`: a model/library/check failed or image checking was switched off; it is **not** a confirmed violation.
- \`NOT CHECKED\`: no saved scan; \`NO FLAGS\`: completed scan without a detected reason.
- A nearly uniform blank drawing is recognized cheaply by the dedicated Web Worker. OCR, QR decoding, geometry and image model loading are skipped, and the completed result is saved as \`Blank or nearly blank drawing\`.
- Legitimate explicit genital-outline heuristics, OCR abuse/links and QR detections are still active. No model result ever triggers an automatic ban or deletion.
- The new \`022-drawing-scanner-worker-qa.cjs\` fixtures cover blank scans and low-confidence harmless image scores, so this precise false-positive issue is part of regression testing.
- This version does **not** force a full re-scan of previously checked drawings solely to correct the UI. A user-initiated \`Scan this drawing\` re-runs the updated worker and can use the blank fast path.


## Specialized owner-only morphology v4

- Added \`moderation-genital-review.js\`, running **inside the existing free Web Worker**. It recognizes several outlined drawing patterns: two rounded features beside an elongated or curved body; nested elongated contours; slit-like inner markings; and tilted, irregular enclosed contours.
- The standalone shape checker is complementary to OCR, QR decoding, and the generic image model. It is not a definitive sexual-content classifier, cannot identify all depictions, and will sometimes flag harmless look-alike objects.
- Only the human owner can remove official runs or ban accounts; Owner Test Runs remain protected.
- A read-only diagnostic against saved Owner Test Run image bytes (without storing private images in public source control) recognized three different stylized elongated anatomical outlines and one irregular nested/tilted drawing. A smiley-face control did not match.
- New regression suite: \`release/346-badges/024-shape-review-acceptance.cjs\`. It includes positive shape fixtures and harmless face/flower/dumbbell/blank controls.
- **Important deployment safeguard:** v4 scans have separate Supabase \`crilo_owner_local_scan_jobs_v4\` and \`crilo_owner_local_scan_save_v4\` owner-guarded RPCs. Old open tabs continue using the v3 queue and cannot mark drawings as freshly checked by v4. v4 results require the current scanner script after deployment and browser refresh. This prevents stale browser code from silently completing the new audit.
- The owner can recognize the new page from the **Safety scanner v4** label. While scanning, keep **Include my Test Runs** enabled to re-evaluate saved QA drawings. Opening a particular drawing and selecting **Scan this drawing** re-evaluates it immediately.


## Handwritten links v5 (October 10, 2026)

Two actual saved Owner Test Run drawings containing domain names were previously marked as \`NO FLAGS\`. Their OCR outputs were \`Crile Com\` and \`Farm lauh\\nCoan\`: the periods and some letters were lost or mistranscribed by handwriting OCR.

- \`moderation-feed-scanner.js\` now recognizes OCR-lost dots, line-broken hostnames, separated \`co m\`, and conservative \`.com\` variations, including the observed \`Coan\` mistake. It still recognizes normal URLs and domain names. These are owner-review *suggestions*, not proof of an actual URL.
- \`release/346-badges/025-handwritten-link-smoke.cjs\` contains those two observed OCR strings, plus additional positive and negative controls. No private drawing bytes are committed to the repository.
- v5 owner-only RPCs (\`crilo_owner_local_scan_jobs_v5\` and \`crilo_owner_local_scan_save_v5\`) recheck older scan results without rewriting any official Daily runs.
- A \`crilo_scan_version_guard\` database trigger prevents old browser tabs from downgrading scan results produced by newer code.
- The owner sees **Safety scanner v5** and should enable **Include my Test Runs** to scan saved test drawings. The original OCR mistakes are reproducible, and the updated text classifier recognizes both, but a full browser re-scan and live deployment still need owner-browser verification.
- This remains 100% local/free. Handwritten URLs may be missed when OCR recognizes no usable characters. Review all pending artwork manually as needed.


## Scan-report and cartoon-smile correction — v6

- **Root cause of persistent NEEDS RESCAN:** \`crilo_owner_local_scan_report\` did not return \`scan_version\`, even though the UI required it. The owner-only \`crilo_owner_local_scan_report_v5\` RPC explicitly includes the version. A complete version-5 blank/harmless scan is now shown as **NO FLAGS**, not endlessly awaiting recheck.
- **Root cause of smiley false positive:** a smiley with two round eyes and a hanging tongue can resemble the geometrical two-lobes-plus-shaft rule. The local shape classifier now recognizes a *broad curved smile beneath paired eyes* as a conservative benign-face indicator; both outline detectors and the main scanner respect this geometry veto. Text, QR, link and hateful-symbol scanning are unaffected.
- The \`crilo_owner_local_scan_jobs_v6\` queue targets **previously unscanned or pre-v5 drawings** plus **existing v5 genital-shape flags**; it deliberately does not rescan completed blank v5 images unnecessarily. Version-6 scan saves are owner-only, and the existing database downgrade guard remains in place.
- Tests include a smiley with two eyes, wide mouth and hanging tongue, alongside earlier anatomical-positive and flower/dumbbell controls, plus mocked worker contradictory genital signals. These tests passed in a local JS harness, but real site-browser testing and published GitHub Pages checks remain separately necessary.
- Old flagged images remain visible until their fresh scan finishes. We never delete, ban, or change official game results based on automated scan findings.


## Owner example feedback and deletion-list fix

- The Drawing Review detail modal now includes **Teach the scanner** with **Add as inappropriate example**, **Mark as safe example**, category selection, and **Remove saved example**.
- Owner labels are persisted in the protected \`public.crilo_owner_drawing_examples\` table through owner-guarded RPCs. Row-level security is enabled; ordinary authenticated players and anonymous visitors have no direct table permissions or function access. Owner-only access checks have been exercised against an unauthorized identity.
- The database retains a **64-character hexadecimal visual fingerprint** and label, not the original drawing pixels. It supports up to 300 labeled examples and preserves examples when an official run is subsequently deleted.
- \`moderation-example-features.js\` performs low-cost 16x16 ink-pattern normalization, Hamming-distance nearest-neighbor matching, and a conservative safe-example veto. It can recognize closely resembling examples only; this is **not neural-model retraining** and cannot generalize reliably to every inappropriate drawing.
- The scanner pulls saved owner labels periodically (and when changed) and passes the examples into the dedicated Web Worker. Matches can suggest manual review; they never automatically ban players or delete a run.
- Successfully approved/deleted/banned official run cards are removed immediately. Pending or stale list refresh responses cannot restore locally confirmed decisions. Unsuccessful server decisions continue to show errors and are not removed optimistically.
- A clean completed v6 scan suppresses legacy image-prediction hints, allowing previously misidentified cartoon faces to clear after an actual rescan. Background owner scans remain tab-open-only; the owner can use **Scan this drawing** to prioritize a specific older drawing.
- Focused regression suite \`026-owner-example-learning-smoke.cjs\` covers close matching, unrelated faces, safe veto, blank exclusion, ownership feedback wiring, and deletion queue UI wiring. The existing \`022-drawing-scanner-worker-qa.cjs\` suite additionally checks that a confirmed deletion stays absent even if an older feed snapshot still contains it.


### Dedicated practice-run cleanup

Owner Test Runs now have a separate **Delete this Test Run** button in Drawing Review, guarded by two confirmations and \`crilo_owner_delete_test_run(uuid)\`. This can only remove the owner's own \`owner_test_runs\` row; it cannot touch \`daily_runs\`, official scores, or player accounts. Associated Test Run scan rows cascade automatically. The new entry is immediately removed from the review UI; old in-flight feed snapshots cannot resurrect it. Saved visual training fingerprints are independent of run data and persist until explicitly removed.

A free owner-local classifier uses only explicitly labeled examples; it does not update model weights or send data to paid AI. The generic "other" category becomes **Possible inappropriate artwork**, not an unrelated sexual-content label.
