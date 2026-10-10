#!/usr/bin/env python3
"""PRIVATE offline baseline. Do not publish input JSON or deploy resulting model.

Use: python research/compare_private_shape_baselines.py --input /path/to/private-drawings.json
Five-fold cross-validation is only exploratory, especially for one-contributor
datasets that have already been inspected during model development.
"""
import argparse,base64,io,json
import numpy as np
from PIL import Image,ImageOps
from skimage.feature import hog
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from sklearn.model_selection import StratifiedKFold,cross_val_predict
from sklearn.metrics import confusion_matrix
def features(encoded):
    im=Image.open(io.BytesIO(base64.b64decode(encoded.split(',',1)[1]))).convert('RGBA')
    white=Image.new('RGBA',im.size,'white');white.alpha_composite(im)
    ink=ImageOps.invert(ImageOps.grayscale(white).resize((64,64)))
    bbox=ink.point(lambda v:255 if v>22 else 0).getbbox()
    normalized=ink
    if bbox:
        crop=ink.crop(bbox);size=max(crop.size)+12
        frame=Image.new('L',(size,size))
        frame.paste(crop,((size-crop.width)//2,(size-crop.height)//2))
        normalized=frame.resize((64,64))
    return np.concatenate([hog(np.asarray(d),orientations=9,pixels_per_cell=(8,8),
        cells_per_block=(2,2),block_norm='L2-Hys') for d in (ink,normalized)])
def main():
    p=argparse.ArgumentParser();p.add_argument('--input',required=True);a=p.parse_args()
    data=json.load(open(a.input,encoding='utf-8'))
    if data.get('format')!='crilo-labeled-private-v1':raise ValueError('Unexpected private dataset format')
    rows=data['samples']
    if any(x.get('expected') not in ('harmless','prohibited') or not x.get('image','').startswith('data:image/png;base64,') for x in rows):
        raise ValueError('Missing or unexpected labels/images')
    X=np.stack([features(x['image']) for x in rows])
    y=np.array([x['expected']=='prohibited' for x in rows])
    cv=StratifiedKFold(n_splits=5,shuffle=True,random_state=2048)
    for name,model in [
      ('linear',make_pipeline(StandardScaler(),SVC(kernel='linear',C=.01))),
      ('rbf',make_pipeline(StandardScaler(),SVC(kernel='rbf',C=1)))]:
        pred=cross_val_predict(model,X,y,cv=cv)
        tn,fp,fn,tp=confusion_matrix(y,pred,labels=[False,True]).ravel()
        print(name,{'TN':int(tn),'FP':int(fp),'FN':int(fn),'TP':int(tp),
          'recall':tp/(tp+fn),'false_positive_rate':fp/(tn+fp)})
    print('RESEARCH ONLY. Five-fold results are not a production certification.')
if __name__=='__main__':main()
