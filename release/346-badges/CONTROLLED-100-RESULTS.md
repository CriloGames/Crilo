# Controlled drawing moderation validation — October 10, 2026

## Reproducible synthetic 100-case benchmark

- **100 examples:** 50 clean; 50 intended to trigger an owner-review suggestion.
- **Final result after two repairs:** TP 50, TN 50, FP 0, FN 0.
- **Initial result before repairs:** TP 48, TN 50, FP 0, FN 2.
- Repairs: spaced OCR hate lettering (N A Z I) and a rotated nested genital-outline geometry variation.
- 51 cases used actual pixel-stroke geometry algorithms (35 clean, 16 violation).
- 45 cases used known text transcriptions (15 clean, 30 violating). **The benchmark does not itself perform OCR.**
- Four remaining cases injected **already-recognized** QR and vision-model signals, testing downstream routing but **not image recognition**.

**These controls are not an independent estimate of real-world moderation accuracy.** The two original misses were used to tune the same benchmark. Real user drawings, browser vision-model classification and QR recognition require separate end-to-end testing.

Run:

\`\`\`sh
CRILO_QA_STRICT=1 CRILO_QA_REPORT_PATH=/tmp/crilo-100-report.json \
node release/346-badges/030-controlled-100-drawings.cjs
\`\`\`

CI saves the JSON output as artifact \`crilo-controlled-100-drawings\`.

## Independent supplemental OCR stress check

- Generated 45 black-on-white, typed text images at 160x160 pixels; upscaled each to 620px and ran system Tesseract 5.5.0 (PSM 6).
- Applied the exact production text-classifier to the returned transcriptions.
- Results after corrective rules: **29/30 violating text images flagged; 15/15 clean images correctly clear** (44/45 correct, 1 false negative, 0 false positives).
- Remaining miss: a swear word was read as the harmless word **Tuck**. The scanner should NOT treat Tuck as profanity just to improve the benchmark score.
- Corrected another Tesseract error in narrowly recognized \`SH [T\` without broadly flagging other harmless text.
- This is NOT the same as mobile-browser OCR on user handwriting, and it is not included in the 100 controlled benchmark score.

Regression transcriptions: \`node release/346-badges/031-rendered-ocr-stress.cjs\`.

## Safety and remaining tests

- No player accounts, official runs, badge awards, or player moderation decisions were changed by either benchmark.
- Never automatically delete runs or ban accounts based on classifier signals.
- Still needed for real-world sensitivity: human handwriting, distorted QR samples, diverse hate-symbol drawings, unusual genital doodles, the exact browser-hosted OCR and SigLIP image model, and false-alarm testing on many genuinely independent safe submissions.
- Every new detection rule should be tested against *unseen* benign examples; synthetic in-sample scores can overstate performance.
