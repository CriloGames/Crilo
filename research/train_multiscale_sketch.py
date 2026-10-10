#!/usr/bin/env python3
"""Research-only multi-scale sketch detector. PUBLIC datasets, no player uploads.
Candidate is NOT connected to the live site. Distinct CNN architecture with
full-image and tight-ink crops, to reduce sensitivity to scale/position.
"""
import argparse,random
from pathlib import Path
import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader,TensorDataset
from sklearn.model_selection import train_test_split
from sklearn.metrics import confusion_matrix
from PIL import Image,ImageDraw
from train_doodle_cnn import get_drawings,POS_URL,NEG_URL,SEED

NEGATIVE=['banana','mushroom','flower','duck','snake','eye','lollipop','pencil',
          'toothbrush','finger','tree','hot dog','baseball bat','umbrella',
          'smiley face','cloud','apple','circle','candle','carrot']

def render(strokes):
 im=Image.new('L',(200,200),255)
 pen=ImageDraw.Draw(im)
 for stroke in strokes:
  if len(stroke)!=2:continue
  pts=[(int(199*x/255),int(199*y/255)) for x,y in zip(*stroke)]
  if len(pts)>1:pen.line(pts,fill=0,width=3,joint='curve')
  elif pts:pen.point(pts[0],fill=0)
 return im

def encode(im):
 full=np.asarray(im.resize((64,64),Image.Resampling.BILINEAR),np.float32)/255
 ink=np.asarray(im)<242
 yy,xx=np.where(ink)
 if len(xx):
  pad=16
  crop=im.crop((max(0,int(xx.min())-pad),max(0,int(yy.min())-pad),
                min(200,int(xx.max())+pad+1),min(200,int(yy.max())+pad+1)))
 else:crop=im
 tight=np.asarray(crop.resize((64,64),Image.Resampling.BILINEAR),np.float32)/255
 return np.stack((full,tight),axis=0)

class MultiScaleSketch(nn.Module):
 def __init__(self):
  super().__init__()
  self.layers=nn.Sequential(nn.Conv2d(2,32,5,padding=2),nn.BatchNorm2d(32),nn.ReLU(),
   nn.MaxPool2d(2),nn.Conv2d(32,64,3,padding=1),nn.BatchNorm2d(64),nn.ReLU(),
   nn.MaxPool2d(2),nn.Conv2d(64,128,3,padding=1),nn.BatchNorm2d(128),nn.ReLU(),
   nn.MaxPool2d(2),nn.Conv2d(128,128,3,padding=1),nn.ReLU(),
   nn.AdaptiveAvgPool2d((4,4)),nn.Flatten(),nn.Linear(2048,128),nn.ReLU(),
   nn.Dropout(.4),nn.Linear(128,1))
 def forward(self,x):return self.layers(x).flatten()

def infer(model,x):
 model.eval();out=[]
 with torch.no_grad():
  for (batch,) in DataLoader(TensorDataset(torch.from_numpy(x)),batch_size=128):
   out.extend(torch.sigmoid(model(batch)).numpy().tolist())
 return np.asarray(out)

def main(a):
 random.seed(SEED);np.random.seed(SEED);torch.manual_seed(SEED);torch.set_num_threads(2)
 positives=get_drawings(POS_URL,a.positives)
 sketches=list(positives);labels=[1]*len(positives)
 for name in NEGATIVE:
  rows=get_drawings(NEG_URL.format(category=name.replace(' ','%20')),a.per_category)
  sketches.extend(rows);labels.extend([0]*len(rows))
  print('Downloaded',name,len(rows),flush=True)
 x=np.stack([encode(render(s)) for s in sketches]);y=np.asarray(labels,np.int64)
 train,hold=train_test_split(np.arange(len(y)),test_size=.2,stratify=y,random_state=SEED+31)
 fit,val=train_test_split(train,test_size=.2,stratify=y[train],random_state=SEED+31)
 model=MultiScaleSketch()
 optimizer=torch.optim.AdamW(model.parameters(),lr=.0006,weight_decay=.01)
 lossfn=nn.BCEWithLogitsLoss(pos_weight=torch.tensor([float((y[fit]==0).sum()/max((y[fit]==1).sum(),1))]))
 fitx=torch.tensor(x[fit]);fity=torch.tensor(y[fit],dtype=torch.float32)
 for epoch in range(a.epochs):
  model.train();losses=[]
  for xb,yb in DataLoader(TensorDataset(fitx,fity),batch_size=96,shuffle=True):
   # source sketches are split before augmentation; no holdout leakage
   if random.random()<.5:xb=1-(1-xb).clamp(0,1).pow(random.uniform(.7,1.4))
   optimizer.zero_grad();loss=lossfn(model(xb),yb);loss.backward();optimizer.step()
   losses.append(float(loss))
  print('Epoch',epoch+1,'loss',round(float(np.mean(losses)),4),flush=True)
 vs=infer(model,x[val])
 options=[]
 for cutoff in np.linspace(.01,1,1000):
  tn,fp,fn,tp=confusion_matrix(y[val],vs>=cutoff,labels=[0,1]).ravel()
  fpr=fp/max(tn+fp,1)
  if fpr<=.01:options.append((tp/max(tp+fn,1),float(cutoff)))
 threshold=max(options)[1]
 hs=infer(model,x[hold])
 tn,fp,fn,tp=confusion_matrix(y[hold],hs>=threshold,labels=[0,1]).ravel()
 recall=tp/max(tp+fn,1);fpr=fp/max(fp+tn,1)
 print('PUBLIC HOLDOUT confusion TN FP FN TP:',*[int(z) for z in (tn,fp,fn,tp)],flush=True)
 print('PUBLIC HOLDOUT detection:',round(recall,4),'false positive rate:',round(fpr,4),'threshold:',round(threshold,4),flush=True)
 print('RESEARCH ONLY:', 'PROVISIONAL PUBLIC PASS' if recall>=.8 and fpr<=.01 else 'FAIL; DO NOT DEPLOY')
 output=Path(a.output);output.parent.mkdir(parents=True,exist_ok=True)
 torch.save({'state_dict':model.state_dict(),'threshold':threshold,'architecture':'MultiScaleSketch-v1','research_only':True},output)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--positives',type=int,default=1800)
 p.add_argument('--per-category',type=int,default=90);p.add_argument('--epochs',type=int,default=18)
 p.add_argument('--output',default='research/outputs/multiscale_sketch.pt')
 main(p.parse_args())
