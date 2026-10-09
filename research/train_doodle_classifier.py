#!/usr/bin/env python3
"""Offline baseline experiment ONLY. Never loads onto the live Crilo moderation page.
Requires: pip install numpy pillow scikit-image scikit-learn joblib requests
Sources: Moniker QuickDraw Appendix (CC BY 4.0) and Google QuickDraw (CC BY 4.0).
"""
import argparse, io, json, random
from pathlib import Path
import numpy as np
import requests
from PIL import Image, ImageDraw, ImageOps
from skimage.feature import hog
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix, precision_recall_curve
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
import joblib

SEED = 2048
NEGATIVES = ['banana', 'mushroom', 'smiley face', 'flower', 'duck',
             'snake', 'cloud', 'umbrella', 'eye', 'lollipop', 'apple', 'circle']
POS_URL = 'https://raw.githubusercontent.com/studiomoniker/Quickdraw-appendix/master/penis-simplified.ndjson'
NEG_URL = 'https://storage.googleapis.com/quickdraw_dataset/full/simplified/{category}.ndjson'

def read_ndjson(url, cap, rng):
    """Read a bounded streaming sample without storing datasets or player drawings."""
    res = requests.get(url, timeout=45, stream=True)
    res.raise_for_status()
    found = []
    try:
        for line in res.iter_lines():
            if not line:
                continue
            item = json.loads(line)
            if 'drawing' in item and item.get('recognized', True):
                found.append(item['drawing'])
            if len(found) >= cap:
                break
    finally:
        res.close()
    rng.shuffle(found)
    return found

def render(strokes, size=64):
    """Rasterize QuickDraw x/y pen strokes onto a white canvas."""
    image = Image.new('L', (256, 256), 255)
    painter = ImageDraw.Draw(image)
    for stroke in strokes:
        if len(stroke) < 2 or len(stroke[0]) != len(stroke[1]):
            continue
        pts = [(int(x), int(y)) for x, y in zip(*stroke)]
        if len(pts) == 1:
            painter.point(pts[0], fill=0)
        elif pts:
            painter.line(pts, fill=0, width=5, joint='curve')
    return np.asarray(image.resize((size, size), Image.Resampling.LANCZOS))

def features(strokes):
    gray = render(strokes)
    return hog(gray, orientations=9, pixels_per_cell=(8,8),
               cells_per_block=(2,2), feature_vector=True)

def run(args):
    rng = random.Random(SEED)
    print('Reading specialized positive sketches…')
    positives = read_ndjson(POS_URL, args.positives, rng)
    drawings = positives[:]
    labels = [1] * len(positives)
    print('Positive samples:', len(positives))
    for category in NEGATIVES:
        url = NEG_URL.format(category=requests.utils.quote(category, safe=''))
        samples = read_ndjson(url, args.per_category, rng)
        print('Harmless', category, len(samples))
        drawings.extend(samples)
        labels.extend([0] * len(samples))
    if min(labels.count(0), labels.count(1)) < 30:
        raise ValueError('Not enough examples collected for both classes')
    x = np.stack([features(d) for d in drawings])
    y = np.asarray(labels, dtype=int)
    # Hold-out data is NOT used for training or threshold selection.
    x_train, x_hold, y_train, y_hold = train_test_split(
        x, y, test_size=.20, stratify=y, random_state=SEED)
    x_fit, x_val, y_fit, y_val = train_test_split(
        x_train, y_train, test_size=.20, stratify=y_train, random_state=SEED)
    model = make_pipeline(StandardScaler(), LogisticRegression(
        max_iter=1200, class_weight='balanced', random_state=SEED))
    model.fit(x_fit, y_fit)
    val_scores = model.predict_proba(x_val)[:, 1]
    # Choose threshold on validation split only; prioritize low false positives.
    thresholds = np.r_[np.linspace(0.5, .999, 250), 1.0]
    eligible = []
    for th in thresholds:
        fp = np.sum((val_scores >= th) & (y_val == 0))
        tn = np.sum(y_val == 0)
        tp = np.sum((val_scores >= th) & (y_val == 1))
        positives_total = np.sum(y_val == 1)
        fpr = fp / max(1, tn)
        recall = tp / max(1, positives_total)
        if fpr <= args.max_fpr:
            eligible.append((recall, -fpr, th))
    if not eligible:
        raise RuntimeError('Unexpected: threshold 1.0 should always yield zero false positives')
    recall, _, threshold = max(eligible)
    pred = (model.predict_proba(x_hold)[:, 1] >= threshold).astype(int)
    print('Validation threshold:', round(float(threshold), 4))
    print('Validation recall:', round(float(recall), 4))
    if threshold >= 1.0:
        print('REJECT BASELINE: No positive predictions meet the configured false-positive budget.')
    print('UNTOUCHED HOLDOUT CONFUSION MATRIX:', confusion_matrix(y_hold, pred).tolist())
    print(classification_report(y_hold, pred, target_names=['harmless','genital-doodle'], zero_division=0))
    tn, fp, fn, tp = confusion_matrix(y_hold, pred, labels=[0,1]).ravel()
    print('HOLDOUT false-positive rate:', round(fp / max(1, tn+fp), 5))
    print('HOLDOUT detection recall:', round(tp / max(1, tp+fn), 5))
    print('RESEARCH QUALITY GATE:', 'FAIL' if threshold >= 1.0 or tp == 0 else 'REQUIRES INDEPENDENT CRILO VALIDATION')
    dest = Path(args.output)
    dest.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({'model': model, 'threshold': float(threshold),
                 'categories': NEGATIVES, 'seed': SEED,
                 'warning': 'RESEARCH ONLY, NOT APPROVED FOR DEPLOYMENT'}, dest)
    print('Saved evaluation artifact:', dest)
    if threshold >= 1.0 or tp == 0:
        raise SystemExit('REJECTED: Classifier failed research quality gate; refusing deployment (exit code 1).')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--positives', type=int, default=2500)
    parser.add_argument('--per-category', type=int, default=400)
    parser.add_argument('--max-fpr', type=float, default=0.01)
    parser.add_argument('--output', default='research/doodle_baseline.joblib')
    run(parser.parse_args())
