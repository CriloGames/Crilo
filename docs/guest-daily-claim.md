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
