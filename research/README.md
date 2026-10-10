# Crilo doodle classifier: research only

This directory is an **offline experiment** to evaluate whether a classifier trained on hand-drawn examples can outperform generic CLIP/SigLIP similarity labels. It is **not connected to live moderation** and must not be treated as a safety guarantee.

## Data and attribution
- Moniker, "Do Not Draw a Penis" / QuickDraw Appendix: https://github.com/studiomoniker/Quickdraw-appendix — CC BY 4.0. Positive training examples of one anatomy class.
- Google Creative Lab, Quick, Draw! dataset: https://github.com/googlecreativelab/quickdraw-dataset — CC BY 4.0. Ordinary doodle negatives. Google warns some user submissions may contain inappropriate content despite moderation.
- Both are downloaded only when the research script is run; neither is committed to Crilo.

## Run offline
Use Python 3.10+:

```bash
python -m pip install numpy pillow scikit-image scikit-learn joblib requests
python research/train_doodle_classifier.py
```

The script trains a HOG+logistic-regression baseline, chooses a conservative confidence threshold using a validation subset, and prints results from a separately held-out test subset. It saves an *offline* joblib artifact. Do not load untrusted joblib files; they can execute code.

## Deployment gate
1. Verify the actual input data and dataset licenses, and record the real holdout confusion matrix.
2. Test with at least 100 harmless and 50 prohibited **independent Crilo-style** sketches, separate from public training data. Include blank, abstract, anatomically similar harmless shapes, handwritten text, and altered scale/thickness.
3. Record sensitivity, specificity, missed detections, and false positives for a fixed threshold. Set a maximum false-positive budget before threshold selection.
4. Keep owner review for potentially harmful content; do not ban automatically.
5. Train a **different** detector for extremist symbols; this binary model is **not** a hate-symbol or vagina detector.
6. Review privacy, browser cost, file size, model conversion and hosting before any live integration.

**Critical limitation:** The public data has limited coverage and selection bias. A successful held-out score on these two sources would not prove accuracy on arbitrary real-world Crilo drawings.

## Existing live moderation
Keep functioning free handwriting/URL detection, owner permissions and ban controls unchanged. Generic CLIP/SigLIP scores are not reliable proof that a doodle violates policy.

## First automated result (2026-10-09)

Research run: https://github.com/CriloGames/Crilo/actions/runs/37998138045

- Collected 1,500 positive and 1,800 ordinary sketch examples.
- Validation chose a threshold of 1.0 to avoid false positives at the fixed 1% maximum.
- Independent holdout: 360/360 harmless sketches unflagged, 0/300 prohibited doodles detected.
- **Quality gate failed: DO NOT DEPLOY**. The model missed every positive test example.
- This result concerns only the very first HOG/logistic-regression baseline, not the datasets' overall potential or any future neural classifier.
- Future research should prioritize better learned image features, proper hard negatives, subject-independent splits, and evaluation on Crilo-style raster drawings. Do not adjust the same threshold using held-out samples.


## Crilo-specific validation (2026-10-09 onward)

The latest deeper CNN achieved an **initial provisional holdout pass**, 514/600 prohibited drawings detected (85.67%), 720/720 ordinary doodles unflagged (0 observed false positives). This does **not** establish accuracy on real Crilo player drawings. Source: https://github.com/CriloGames/Crilo/actions/runs/37999293782

An offline validator is now available: `research/validate_crilo_drawings.py`. It accepts a folder of *privately exported*, hand-labeled drawings and the research artifact checkpoint. It uses Crilo-like transparent-on-white raster input, reports per-image predictions, and rejects unrepresentative small samples. It never uploads data, touches Supabase, or changes accounts.

Create `research/private-qa/labels.json` with rows such as:

```json
[
  {"file": "ordinary-01.png", "expected": "harmless"},
  {"file": "prohibited-01.png", "expected": "prohibited"}
]
```

Place those images in the same private folder, then run from the repo root:

```sh
python -m pip install torch pillow numpy scikit-learn requests
python research/validate_crilo_drawings.py --manifest research/private-qa/labels.json --checkpoint research/private-qa/doodle_cnn.pt
```

Retrieve the research checkpoint from the GitHub Actions artifact (not GitHub Pages), store it outside the public GitHub repository, and **never commit private drawings, labels, or checkpoint artifacts to main**. Public checkpoint files from GitHub must be trusted and checked before loading; `torch.load(weights_only=True)` reduces but does not eliminate risk.

The sample-size gate is 100 harmless and 50 prohibited examples. A batch of just six owner drawings is useful as a diagnostic smoke test, **not** sufficient to certify accuracy. Include hard harmless examples (bananas, mushrooms, rings, ducks, hearts, scribbles, blank images), prohibited outline variations, and variations in background, stroke thickness and scale. Keep labeled examples completely separate from the training datasets.

The model is a binary detector for one specific class of hand-drawn anatomy. It **does not** recognize other anatomy, swastikas, phishing links or other categories unless those are separately evaluated. Existing live OCR and moderation should stay independent.


## One-click owner Test Run evaluation export

The owner Drawing Review page now includes an **Export my Test Run drawings for private QA** control inside the collapsible Test Run scan status section. It downloads a JSON file containing the logged-in owner's saved Test Run drawings. It uses an owner-only Supabase RPC and does not send images to GitHub.

**Treat this JSON file as private user content.** Do not commit it or upload it to an untrusted service. The `expected` field defaults to `unknown`; if scoring accuracy, label each sample manually as `harmless` or `prohibited`. The model's predictions must never be used as the ground-truth labels.

To assess locally, extract `research/outputs/doodle_cnn.pt` from the successful GitHub Actions research artifact. Install `torch numpy pillow requests scikit-learn` and run:

```sh
python research/evaluate_owner_qa_export.py --export crilo-owner-qa-private.json --checkpoint research/outputs/doodle_cnn.pt
```

This prints prediction scores and, where labels are supplied, counts errors. It does not change or submit any player's drawings or moderation status. **Six saved examples are a smoke test, not sufficient independent evidence for deployment.**


## First private Crilo-style smoke test (2026-10-09)

Using the successful 28-epoch CNN checkpoint (validation threshold 0.9801), six private owner QA drawings were assessed **offline**. Only aggregate results are recorded here; no private drawings, identifiers, or labels are published.

- Two hand-drawn male-genital examples: **0/2 detected** (scores approximately 0.0002 and 0.7893).
- Four other examples (ordinary and handwritten text): **4/4 left unflagged** by this visual-only model.
- One handwritten-profanity example was scored 0.7438; reducing the visual threshold enough to catch one anatomy example would also risk flagging this text drawing.
- **DO NOT DEPLOY.** This six-example smoke test is not a statistical benchmark, but both missed relevant drawings demonstrate dataset shift from public QuickDraw sketches to actual Crilo drawings.

Next research priorities: obtain independent consented Crilo-style drawings for both classes; ensure exact canvas preprocessing, stroke width and scale variations are reflected in training; set aside a new Crilo-specific holdout before training; repeat evaluation without reusing the six QA examples as a final test set. Do not solve this by lowering the threshold alone.

## Larger hard-negative experiment (2026-10-09)

Run: https://github.com/CriloGames/Crilo/actions/runs/38003938659

The 9,900-example experiment, including six additional innocent drawing categories, **failed** the fixed research quality gate. On an untouched 1,980-example holdout: TN=1068, FP=12, FN=134, TP=766. Detection recall 85.11%, false-positive rate 1.11%; minimum required 80% recall and maximum permitted 1% false positives. **Do not deploy.** These numbers cannot substitute for Crilo-specific independent validation. Future development should focus on representative Crilo canvas captures, hard-negative data sourced independently, and locked thresholds selected on validation data only.

## Crilo pen-width experiment private smoke test (2026-10-09)

Research run: https://github.com/CriloGames/Crilo/actions/runs/38005240291

The source-domain public holdout passed provisionally: TN=1071, FP=9, FN=152, TP=748; 83.11% detection recall, 0.833% false-positive rate, threshold 0.920707.

**Private Crilo QA: failed.** Evaluated checkpoint offline against the same six previously inspected owner Test Run images without publishing image bytes or identifiers. Both explicit anatomical drawings were missed (visual class scores approximately 0.6906 and 0.1717, both below 0.9207 threshold). Four non-anatomical drawings were not flagged by the *visual* detector; two contained profanity requiring the separate OCR checks. Those six diagnostic samples were examined previously and must not be counted as an independent model-selection holdout. **DO NOT DEPLOY**.

Pen-width augmentation alone did not address Crilo domain shift. Stop treating passing QuickDraw holdouts as sufficient evidence for live reliability. Gather a meaningful consented, manually labeled, representative collection, with separate development and untouched evaluation subsets. Enforce hard deployment gating on Crilo-specific detection plus false-positive performance, not training scores.

## New Crilo-style human-labeled collection lab

The private, browser-only drawing dataset lab is linked from owner Drawing Review diagnostics, and is also available at `/owner-dataset-lab.html`. It draws at 200x200 resolution with configurable pen width, generates labeled, white-background PNG images, and downloads the collection as private `crilo-labeled-private-v1` JSON. No images, labels, or user sessions are submitted to Supabase, GitHub, or external services. This public static utility has no account data access; it is designed primarily for owner QA and relies on the operator keeping the downloaded file private.

Manual labels are required. Test both confusing ordinary doodles and prohibited examples. Use different people and drawing styles where possible; many examples by one person are not independent. Acquire meaningful held-out data from separate sessions/participants. The 6 already inspected Test Runs are diagnostic only, not blind test material. Do not publish labeled images of users without their consent and do not enable any classifier on production until independently validated.

## Private human-labeled pilot (2026-10-09, offline only)

A private 100-example single-contributor dataset (50 manually labeled harmless, 50 manually labeled prohibited) was provided for local evaluation. **No images, personal details, or checkpoint were committed to GitHub.** A stratified 60/20/20 fit/validation/test split evaluated the pretrained CNN versus 16-epoch low-learning-rate fine-tuning. Both used the same unseen 20-example pilot test; the fine-tuned threshold was chosen on validation only. On the 10 benign + 10 prohibited test drawings: pretrained TN=8, FP=2, FN=9, TP=1 (10% detection, 20% false positives); fine-tuned TN=9, FP=1, FN=10, TP=0 (0% detection, 10% false positives). Fine-tuned validation was 5/10 detected and 0/10 falsely flagged. This confirms **no demonstrated generalization gain**; do not deploy. Twenty test samples are far too few to establish a stable 1% false-positive rate, and multiple examples from one contributor are not an independent population sample. Future research should focus on data diversity and robust evaluation; do not ask the owner to produce more drawings, reuse private images publicly, or overfit on repeatedly inspected test outcomes.

## Alternative shape baselines (2026-10-09)

Private, locally executed shape-classifier comparison: foreground normalization + full-canvas HOG descriptors, linear SVM and RBF SVM. Exploratory stratified five-fold cross-validation on 100 labeled images from one contributor, already used in research; **not independent validation or grounds for deployment**. Linear: TN=32, FP=18, FN=20, TP=30 (60% recall; 36% FPR). RBF: TN=36, FP=14, FN=21, TP=29 (58% recall; 28% FPR). Neither meets moderation needs. Reproduce locally with `python research/compare_private_shape_baselines.py --input /path/to/private-export.json`. Raw private images never uploaded or committed. Focus on low-risk human review and diverse independent testing instead of repeatedly optimizing against this same cohort.

## Third-party open-source detectors tested privately (2026-10-09)

**NudeNet 3.4.2** (MIT; locally packaged ONNX runtime) and **NSFWJS 4.2.1** (MIT; locally packaged TensorFlow.js) were actually run offline against the 100 private human-labeled Crilo 200×200 PNG drawings (50 prohibited, 50 harmless). Images and image-specific outputs were **never** committed or sent to GitHub Actions. These same 100 images have already been used in other development iterations, so this is exploratory in-domain comparison, not an independent test. NudeNet's bundled detector returned **TP=0 FN=50 FP=0 TN=50** when looking for exposed genitalia (or genitalia, anus and buttocks) among its detections. NSFWJS MobileNetV2, scoring Porn+Hentai probability, also returned **TP=0 FN=50 FP=0 TN=50**, at both 0.20 and 0.50 thresholds. **Do not deploy either detector.**

The independent proxy public doodle workflow at https://github.com/CriloGames/Crilo/actions/runs/38012122131 observed NSFWJS 0/75 public prohibited pen doodles and 0/75 benign false positives. NudeNet's proxy step in that first run threw an API signature error; corrected in later source, so do not treat that first public NudeNet step as a valid benchmark. These results are not proof that every possible pretrained model will fail, but they reject the two tested alternatives on the owner's use case. Keep owner-only manual review, text OCR and image diagnostics separate from automatic punishments, and do not request additional owner drawings.

## Multiscale sketch detector experiment

New research architecture in `research/train_multiscale_sketch.py` uses two views of each doodle: entire 200x200 canvas and a separately zoomed ink bounding box. An independent public-sample holdout is split by original sketch before training; validation chooses a threshold at <=1% observed false positives. A companion free GitHub Actions workflow trains on 1,800 public positive sketches and up to 1,800 ordinary sketches from 20 categories for 18 epochs. **No private drawings are uploaded or used by this workflow.** Public holdout success must never be mistaken for Crilo production accuracy; the pre-inspected 100 private Crilo examples remain diagnostics, not new independent validation. Don't enable production flags or bans from this model without stronger testing.

### Multiscale public holdout result (run 38013163776)

Completed research-only experiment: **TN=355, FP=5, FN=210, TP=150**, positive recall **41.67%** and false-positive rate **1.39%** at validation-chosen threshold ~0.999. This **fails** both the 80% recall and <=1% false-positive targets. No Crilo private drawings used in this training workflow. **Do not integrate the model into moderation.** A public sketch benchmark does not certify actual Crilo detection.
