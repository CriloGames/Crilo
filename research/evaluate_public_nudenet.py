#!/usr/bin/env python3
"""Evaluate NudeNet ONLY on generated public sketches. No content moderation actions."""
import json,sys
from pathlib import Path
from nudenet import NudeDetector
p=Path('research/outputs/public-comparison')
data=json.loads((p/'manifest.json').read_text())
det=NudeDetector()
pred=[]
for i,row in enumerate(data):
 try:
  found=det.detect(str(p/row['file']))
  genital=[x for x in found if 'GENITALIA' in x['class'] and 'EXPOSED' in x['class']]
  confidence=max((float(x['score']) for x in genital),default=0.0)
  pred.append({'file':row['file'],'label':row['label'],'score':confidence})
 except Exception as e: raise RuntimeError('NudeNet inference failed on '+row['file']) from e
def evaluate(cut):
 tp=sum(x['label']=='positive' and x['score']>=cut for x in pred)
 fn=sum(x['label']=='positive' and x['score']<cut for x in pred)
 fp=sum(x['label']=='negative' and x['score']>=cut for x in pred)
 tn=sum(x['label']=='negative' and x['score']<cut for x in pred)
 print(f'NudeNet threshold={cut:.2f} TN={tn} FP={fp} FN={fn} TP={tp} recall={tp/max(tp+fn,1):.3f} FPR={fp/max(fp+tn,1):.3f}',flush=True)
for threshold in [.2,.5]:evaluate(threshold)
