#!/usr/bin/env python3
"""Evaluate private Crilo owner QA export locally. Never sends or publishes images."""
import argparse,base64,io,json
from pathlib import Path
import numpy as np
from PIL import Image
import torch
from train_doodle_cnn import DoodleCNN

def raster(data_uri):
    if not isinstance(data_uri,str) or not data_uri.startswith('data:image/png;base64,'):
        raise ValueError('Expected a PNG data URL')
    blob=base64.b64decode(data_uri.split(',',1)[1],validate=True)
    if len(blob)>2000000:raise ValueError('Image too large')
    with Image.open(io.BytesIO(blob)) as picture:
        if picture.width>2048 or picture.height>2048:raise ValueError('Unexpected image size')
        canvas=Image.new('RGBA',picture.size,(255,255,255,255))
        canvas.alpha_composite(picture.convert('RGBA'))
        gray=canvas.convert('RGB').convert('L').resize((64,64),Image.Resampling.BILINEAR)
        return torch.tensor(np.asarray(gray,dtype=np.float32)/255.0)[None,None,:,:]

def main(args):
    rows=json.loads(Path(args.export).read_text())
    if rows.get('format')!='crilo-owner-private-qa-v1':raise ValueError('Unexpected owner export format')
    checkpoint=torch.load(args.checkpoint,map_location='cpu',weights_only=True)
    net=DoodleCNN().eval()
    net.load_state_dict(checkpoint['state_dict'],strict=True)
    threshold=float(checkpoint['threshold'])
    truth=[];predictions=[]
    for row in rows['samples']:
        with torch.no_grad():
            score=float(torch.sigmoid(net(raster(row['image']))).item())
        outcome='review' if score>=threshold else 'not flagged'
        label=row.get('expected','unknown')
        if label in ('harmless','prohibited'):
            truth.append(label=='prohibited');predictions.append(score>=threshold)
        print(json.dumps({'submitted_at':row.get('submitted_at'),'score':round(score,4),
                          'threshold':round(threshold,4),'prediction':outcome,
                          'expected':label}))
    print('Labeled samples:',len(truth),'out of',len(rows['samples']))
    if truth:
        fp=sum(not y and p for y,p in zip(truth,predictions))
        fn=sum(y and not p for y,p in zip(truth,predictions))
        print('Labeled false positives:',fp,'missed prohibited:',fn)
    print('Research-only assessment. Do not deploy based solely on this sample.')

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--export',required=True,help='Private owner JSON export')
    parser.add_argument('--checkpoint',required=True,help='Research CNN checkpoint .pt')
    main(parser.parse_args())
