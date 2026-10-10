# Owner drawing backlog stability — October 10, 2026

## What was at risk

Previously `moderation-feed.js` requested up to **200 full base64 drawings** at once and recreated all image thumbnails in one DOM update. Larger queues (>200) were also not fully navigable, while four additional moderation RPCs were fetched every 30 seconds. A 1,000-drawing backlog could produce unnecessary browser memory use, UI stalls and inaccessible older submissions.

## Mitigation installed

- Owner-only database function `public.crilo_owner_review_page_v1(page,filter,include_tests)` returns **at most 24 images** per page, while computing counts and filter matches across the full pending queue. All filters and priority ordering are applied server-side.
- The UI provides **Previous/Next** controls and the current page number. A 1,000-item queue occupies **42 pages**, with a maximum of 24 thumbnail elements at any time.
- Only **one owner feed RPC** is needed per refresh (previously five), and expensive base64 content is fetched only for the visible page. Data is never preloaded for all 1,000 drawings.
- Background scanning uses a **dedicated Web Worker**, one drawing at a time, and remains separate from pagination; displaying page 24 does not cause scans to skip or recheck entries.
- The worker is cancelled on hidden-tab and unload events. The existing Pause/Resume controls remain available.
- On iPhone, iPad, Android, touch-identified iPadOS devices, and browsers advertising <=4GB memory, **automatic scanning starts paused** to reduce out-of-memory risks. The owner can opt in to one-at-a-time checks. Desktop continues automatically.
- Owner authorization is checked inside the new database function; anonymous/non-owner access is rejected. No player accounts, official runs, badge awards or moderation decisions were altered.
- Confirmed deleted/approved drawings remain hidden even if a stale feed response arrives.

## Validation

- `release/346-badges/032-thousand-drawing-backlog-smoke.cjs` models **1,000 pending records** with image payloads. Validates 24 thumbnails per page, 42 pages, total counts, flagged filtering, Previous/Next, a confirmed deletion and resistance to stale responses.
- `release/346-badges/034-low-memory-scanner-smoke.cjs` tests five device profiles: iPhone, iPad, touch-screen Mac/iPadOS, a low-memory Linux laptop and high-memory desktop.
- `release/346-badges/021-free-drawing-moderation-smoke.cjs` and `022-drawing-scanner-worker-qa.cjs` continue testing serialized local scans, owner/Test Run isolation, false-positive behavior and review actions.
- Supabase SQL validation exercised owner-only page access, page-size enforcement, all review filters, test-run inclusion and empty pages against existing live records. This was **read-only**.

## Limits

A simulated 1,000-record browser feed is not a physical test of every iPhone, browser, GPU, mobile memory limit or Supabase workload under real concurrent traffic. One large image-model inference can still consume significant RAM/CPU; pausing on low-memory devices substantially reduces automatic load but is not a universal guarantee against crashes.

At 1,000 drawings, background moderation will still take time: it processes them serially to avoid concurrent memory spikes. Leaving the owner review page is safe: scans stop; pending drawings remain in the database. The normal Home, Leaderboard and game pages do **not** start the owner scanner.

The SQL definition is versioned in `033-owner-review-pagination.sql`. Both new stress tests run during the prelaunch GitHub Actions workflow.
