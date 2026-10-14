# RNGdle-style rarity calibration for Crilo

Crilo's seven **final-score** rarity bands follow RNGdle's published
1% / 49% / 25% / 15% / 5% / 4% / 1% structure, but calculate the
point boundaries from **Crilo's own wheel**, not RNGdle's entropy points.

The fixed LCG seed `0xC4102026` and the current five-spin / upgrade /
bonus-spin wheel are simulated for **1,000,000 runs** to derive the
integer thresholds:

| Final score tier | Score range | Reference frequency |
|---|---:|---:|
| Trash | 0–6 | 1.2370% |
| Common | 7–24 | 49.7661% |
| Uncommon | 25–48 | 24.5551% |
| Rare | 49–92 | 14.4894% |
| Epic | 93–141 | 4.9887% |
| Anomaly | 142–318 | 3.9677% |
| Mythic | 319+ | 0.9960% |

Actual observed frequency varies; integer-score ties cannot be split
between rarity categories. `rarity-system.js` estimates any individual
score's tail probability with its smaller seeded 100,000-run reference.

**Badge rarity** is a separate distribution, measured per official Daily:
Common >10%; Uncommon 1–10%; Rare 0.1–1%; Epic 0.01–0.1%;
Anomaly 0.001–0.01%; Mythic <0.001% (rarer than 1 in 100,000).
There is **no Trash badge tier**.

The 61 previously simulated event/number badges have actual
`requirement.probability_percent` metadata and are reclassified from
that measurement. The seven final-score achievement badges now have
the 1-million-run band's frequency as their measured probability.
The remaining streak, lifetime, social, exploration and unmeasured
wheel-pattern achievements retain their authored *challenge difficulty*
and should not be advertised as statistically calibrated until
comparable per-run probability estimates are available.

Migration `138-rngdle-percentile-rarity.sql` only changes
`public.badges` requirement metadata / score-band conditions and the
seven score-band badge descriptions. It does not revoke previous awards
or alter verified player scores and leaderboards.
