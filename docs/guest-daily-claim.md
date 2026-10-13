# Verified guest Daily claims (2026-10)
Guests now get a one-time 256-bit opaque server ticket on their first spin.
Each guest wheel outcome and score comes from `crilo_guest_spin` (same
authoritative randomness and 500-spin safety limit as the official game).
The ticket is stored in the browser with the guest run, so a completed guest
Daily can be claimed after Magic Link sign-in, including on a later visit.

The RPC `crilo_claim_guest_daily` never trusts client-reported score,
spins, outcome history or rarity. It transactionally copies a completed
server-backed guest session into the official spin table, inserts the
official Daily (running existing triggers for badges, stats, leaderboards,
drawing review and restrictions), and marks the guest ticket claimed.
One account gets at most one official Daily per period, and one ticket can
be claimed only once. A claim can be made for 30 days after completion.
An already-started official Daily for that period wins any conflict.
Existing guest runs created before this feature were local-only and cannot
be retroactively verified for competitive rankings.

Important: while server verification eliminates client score editing, guest
accounts remain susceptible to browser-clearing and automated multiple
tickets; additional abuse limits may be appropriate before larger launch.
The original owner Test Run is unchanged and never enters rankings.

## Guest-start rate limiting (October 13, 2026)

Production RPC `crilo_guest_begin()` now uses a server-side, atomic
network-address quota: **10 new guest tickets per 10-minute UTC bucket** and
**60 tickets per official Daily period per public IP address** (the period
resets at 22:00 UTC). The quota counts only starts, **not** guest spins,
reloads, guest ticket restores, sign-ins or claiming a finished guest Daily.
A shared network connection shares one quota; normal households should have
headroom, while unusually large groups may see a temporary pause.

The PostgREST gateway-provided `cf-connecting-ip` header is preferred;
where unavailable the final X-Forwarded-For hop is used, not the easily
spoofed first hop. This assumes the hosted API proxy sanitizes/appends
headers correctly; **IP limits do not prevent distributed/botnet abuse**,
VPN rotation, or other bypasses. No user-supplied fingerprint is trusted.
Missing or invalid IP rejects guest creation safely.

Only an HMAC-SHA256 hash of the normalized address is stored, keyed with
a secret maintained in the non-exposed `crilo_private` schema. No plain
IP address or service key is written to the table or committed to GitHub.
Quota rows older than 72 hours are periodically pruned opportunistically.
Blocked starts return HTTP 429 with `GUEST_RATE_LIMIT` and a user-friendly
message. Concurrent calls cannot race the quota due to atomic upserts.
The client preserves already-started guest Dailies and doesn't re-issue
start tickets on page reload. The owner Test Run is unaffected.

The production migration is tracked as
`crilo_guest_session_throttling_20261013`.
For higher-traffic release, consider a managed CDN/WAF/CAPTCHA challenge
in addition to these database quotas; do not rely on IP quotas alone.
