#!/usr/bin/env python3
"""Research-only CNN training. Never deploy directly to Crilo.
Datasets: Moniker QuickDraw Appendix and Google Quick, Draw! (CC BY 4.0).
"""
import argparse, json, random
from pathlib import Path
import numpy as np
import requests
from PIL import Image, ImageDraw, ImageEnhance
from sklearn.model_selection import train_test_split
from sklearn.metrics import confusion_matrix
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

SEED = 2048
CATEGORIES = ['banana','mushroom','smiley face','flower','duck','snake',
              'cloud','umbrella','eye','lollipop','apple','circle']
POS_URL='https://raw.githubusercontent.com/studiomoniker/Quickdraw-appendix/master/penis-simplified.ndjson'
NEG_URL='https://storage.googleapis.com/quickdraw_dataset/full/simplified/{category}.ndjson'

def get_drawings(url, limit):
    response=requests.get(url,stream=True,timeout=90)
    response.raise_for_status()
    out=[]
    try:
        for line in response.iter_lines():
            if not line: continue
            v=json.loads(line)
            if 'drawing' in v and v.get('recognized',True): out.append(v['drawing'])
            if len(out)>=limit:break
    finally: response.close()
    return out

def bitmap(strokes):
    image=Image.new('L',(256,256),255)
    pen=ImageDraw.Draw(image)
    for s in strokes:
        if len(s)!=2 or len(s[0])!=len(s[1]):continue
        coords=list(zip(s[0],s[1]))
        if len(coords)>1:pen.line(coords,fill=0,width=5)
        elif coords:pen.point(coords[0],fill=0)
    return np.asarray(image.resize((64,64),Image.Resampling.BILINEAR),dtype=np.float32)/255

class DoodleCNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.net=nn.Sequential(
            nn.Conv2d(1,16,3,padding=1),nn.ReLU(),nn.MaxPool2d(2),
            nn.Conv2d(16,32,3,padding=1),nn.ReLU(),nn.MaxPool2d(2),
            nn.Conv2d(32,64,3,padding=1),nn.ReLU(),nn.MaxPool2d(2),
            nn.Flatten(),nn.Linear(64*8*8,64),nn.ReLU(),
            nn.Dropout(0.35),nn.Linear(64,1))
    def forward(self,x):return self.net(x).flatten()

def scores(net,x,device):
    net.eval()
    with torch.no_grad():
        return np.concatenate([
            torch.sigmoid(net(chunk.to(device))).cpu().numpy()
            for (chunk,) in DataLoader(TensorDataset(x),batch_size=128)
        ])

def run(a):
    random.seed(SEED);np.random.seed(SEED);torch.manual_seed(SEED)
    torch.set_num_threads(2)
    print('Downloading positive doodles...',flush=True)
    positive=get_drawings(POS_URL,a.positives)
    raw=list(positive);labels=[1]*len(positive)
    print('Positive drawings:',len(positive),flush=True)
    for cat in CATEGORIES:
        samples=get_drawings(NEG_URL.format(category=requests.utils.quote(cat,safe='')),a.per_category)
        raw+=samples;labels += [0]*len(samples)
        print(cat,len(samples),flush=True)
    x=np.stack([bitmap(draw) for draw in raw])[:,None,:,:]
    y=np.array(labels,dtype=np.float32)
    train_idx,hold_idx=train_test_split(np.arange(len(y)),test_size=.20,stratify=y,random_state=SEED)
    fit_idx,val_idx=train_test_split(train_idx,test_size=.20,stratify=y[train_idx],random_state=SEED)
    device='cpu';net=DoodleCNN().to(device)
    optimizer=torch.optim.AdamW(net.parameters(),lr=.001,weight_decay=.005)
    loss_fn=nn.BCEWithLogitsLoss(pos_weight=torch.tensor([np.sum(y[fit_idx]==0)/max(1,np.sum(y[fit_idx]==1))]))
    from torch.nn import functional as F
    def augment(batch):
        n=len(batch)
        angle=(torch.rand(n)*2-1)*0.15
        shift=(torch.rand(n,2)*2-1)*0.13
        scale=0.85+torch.rand(n)*0.3
        matrix=torch.zeros(n,2,3)
        matrix[:,0,0]=scale*torch.cos(angle)
        matrix[:,0,1]=-scale*torch.sin(angle)
        matrix[:,1,0]=scale*torch.sin(angle)
        matrix[:,1,1]=scale*torch.cos(angle)
        matrix[:,:,2]=shift
        grid=F.affine_grid(matrix,batch.size(),align_corners=False)
        return F.grid_sample(batch-1,grid,padding_mode='zeros',align_corners=False)+1
    for epoch in range(a.epochs):
        net.train();total=0
        loader=DataLoader(TensorDataset(torch.tensor(x[fit_idx]),torch.tensor(y[fit_idx])),
                          batch_size=96,shuffle=True)
        for features,target in loader:
            optimizer.zero_grad()
            loss=loss_fn(net(augment(features)),target)
            loss.backward();optimizer.step();total+=loss.item()
        print('Epoch',epoch+1,'loss',round(total/len(loader),4),flush=True)
    val=scores(net,torch.tensor(x[val_idx]),device)
    desired=[]
    for threshold in np.r_[np.linspace(.01,.99,199),1.0]:
        predictions=val>=threshold
        tn,fp,fn,tp=confusion_matrix(y[val_idx],predictions,labels=[0,1]).ravel()
        fpr=fp/max(1,fp+tn);recall=tp/max(1,tp+fn)
        if fpr<=a.max_fpr:desired.append((recall,-fpr,threshold))
    recall,_,threshold=max(desired)
    hold=scores(net,torch.tensor(x[hold_idx]),device)>=threshold
    tn,fp,fn,tp=confusion_matrix(y[hold_idx],hold,labels=[0,1]).ravel()
    hold_fpr=fp/max(1,fp+tn);hold_recall=tp/max(1,tp+fn)
    print('CHOSEN VALIDATION THRESHOLD:',round(float(threshold),4))
    print('VALIDATION DETECTION RECALL:',round(float(recall),4))
    print('HOLDOUT CONFUSION MATRIX [[TN,FP],[FN,TP]]:',[[int(tn),int(fp)],[int(fn),int(tp)]])
    print('HOLDOUT FALSE POSITIVE RATE:',round(hold_fpr,5))
    print('HOLDOUT DETECTION RECALL:',round(hold_recall,5))
    print('EVALUATION SET SIZES:',{'training':len(fit_idx),'validation':len(val_idx),'holdout':len(hold_idx)})
    passed=threshold<1.0 and hold_fpr<=a.max_fpr and hold_recall>=.8
    print('RESEARCH QUALITY GATE:', 'PROVISIONAL PASS - NEEDS CRILO-SPECIFIC VALIDATION' if passed else 'FAIL - DO NOT DEPLOY')
    dest=Path(a.output);dest.parent.mkdir(parents=True,exist_ok=True)
    torch.save({'state_dict':net.cpu().state_dict(),'threshold':float(threshold),
                'research_only':True,'architecture':'DoodleCNN-64x64-v1'},dest)
    print('Saved offline checkpoint:',dest)
    if not passed:raise SystemExit('Research quality gate failed. Not suitable for deployment.')
if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--positives',type=int,default=1500)
    p.add_argument('--per-category',type=int,default=150)
    p.add_argument('--epochs',type=int,default=8)
    p.add_argument('--max-fpr',type=float,default=.01)
    p.add_argument('--output',default='research/outputs/doodle_cnn.pt')
    run(p.parse_args())
