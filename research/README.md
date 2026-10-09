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
