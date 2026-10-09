#!/usr/bin/env python3
"""Offline owner QA of a saved research model. Never writes to Crilo or Supabase.

Input: directory of manually exported PNG files and JSON manifest:
[
  {"file":"drawing01.png","expected":"harmless"},
  {"file":"drawing02.png","expected":"prohibited"}
]
Drawings must remain local. DO NOT commit PNGs or manifest to a public repo.
"""
import argparse, json
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps
from sklearn.metrics import confusion_matrix
import torch
from train_doodle_cnn import DoodleCNN

def preprocess(path):
    with Image.open(path) as original:
        im=original.convert('RGBA')
        bg=Image.new('RGBA', im.size, (255,255,255,255))
        bg.alpha_composite(im)
        gray=ImageOps.grayscale(bg.convert('RGB'))
        gray=gray.resize((64,64),Image.Resampling.BILINEAR)
        return np.asarray(gray,dtype=np.float32)[None,:,:]/255.0

def main(args):
    path=Path(args.manifest)
    samples=json.loads(path.read_text())
    if not isinstance(samples,list) or not samples:
        raise ValueError('Manifest must contain a non-empty list')
    checkpoint=torch.load(args.checkpoint,map_location='cpu',weights_only=True)
    if checkpoint.get('architecture')!='DoodleCNN-64x64-v1' and checkpoint.get('architecture')!='DoodleCNN-64x64-v2':
        raise ValueError('Unexpected checkpoint architecture')
    if checkpoint.get('research_only') is not True:
        raise ValueError('Not a research checkpoint')
    net=DoodleCNN().eval()
    net.load_state_dict(checkpoint['state_dict'],strict=True)
    threshold=float(checkpoint['threshold'])
    truth=[];predicted=[]
    for item in samples:
        if item['expected'] not in ('harmless','prohibited'):
            raise ValueError('Expected harmless or prohibited')
        # Restrict reads to the input manifest directory.
        target=(path.parent/item['file']).resolve()
        if not target.is_relative_to(path.parent.resolve()):
            raise ValueError('Sample path escapes local manifest directory')
        x=torch.tensor(preprocess(target))[None,:,:,:]
        with torch.no_grad():
            score=torch.sigmoid(net(x)).item()
        prediction=score>=threshold
        truth.append(int(item['expected']=='prohibited'))
        predicted.append(int(prediction))
        print(json.dumps({'file':item['file'],'expected':item['expected'],
                          'prediction':'prohibited' if prediction else 'harmless',
                          'score':round(score,4)},sort_keys=True))
    tn,fp,fn,tp=confusion_matrix(truth,predicted,labels=[0,1]).ravel()
    print('CONFUSION MATRIX:',[[int(tn),int(fp)],[int(fn),int(tp)]])
    print('FALSE POSITIVES:',int(fp),'MISSED PROHIBITED:',int(fn))
    if (tp+fn)<50 or (tn+fp)<100:
        print('INSUFFICIENT QA DATA: need at least 50 prohibited and 100 harmless Crilo-style drawings.')
        raise SystemExit(2)
    fpr=fp/(fp+tn);recall=tp/(tp+fn)
    print('DETECTION RECALL:',round(recall,4),'FALSE POSITIVE RATE:',round(fpr,4))
    if recall < .8 or fpr > .01:
        raise SystemExit('QA FAILED: do not enable live classifier')
    print('PROVISIONAL QA PASS: still requires owner review and operational security audit')

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--manifest',required=True)
    p.add_argument('--checkpoint',required=True)
    main(p.parse_args())
