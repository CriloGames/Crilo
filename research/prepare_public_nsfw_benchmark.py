#!/usr/bin/env python3
"""Generate PUBLIC QuickDraw-only sketch benchmark. Never use or publish player drawings."""
import argparse,json,requests,random,base64
from pathlib import Path
from PIL import Image,ImageDraw
from io import BytesIO
POS='https://raw.githubusercontent.com/studiomoniker/Quickdraw-appendix/master/penis-simplified.ndjson'
NEG='https://storage.googleapis.com/quickdraw_dataset/full/simplified/{}.ndjson'
def fetch(url,n):
 r=requests.get(url,stream=True,timeout=90);r.raise_for_status();out=[]
 for line in r.iter_lines():
  if not line:continue
  o=json.loads(line)
  if o.get('recognized',True) and o.get('drawing'):out.append(o['drawing'])
  if len(out)==n:break
 r.close();return out
def raster(draw):
 im=Image.new('RGB',(200,200),'white');p=ImageDraw.Draw(im)
 for xs,ys in draw:
  pts=[(int(x*199/255),int(y*199/255)) for x,y in zip(xs,ys)]
  if len(pts)>1:p.line(pts,fill=(0,0,0),width=4)
  elif pts:p.point(pts[0],fill=(0,0,0))
 return im
def main():
 a=argparse.ArgumentParser();a.add_argument('--count',type=int,default=75);args=a.parse_args()
 out=Path('research/outputs/public-comparison');out.mkdir(parents=True,exist_ok=True)
 manifest=[]
 categories=[('positive',POS,args.count)]+[('negative',NEG.format(cat.replace(' ','%20')),args.count//5) for cat in ['banana','flower','pencil','smiley face','finger']]
 for label,url,num in categories:
  for i,draw in enumerate(fetch(url,num)):
   name=f'{label}-{len(manifest):04}.png';raster(draw).save(out/name)
   manifest.append({'file':name,'label':label})
 (out/'manifest.json').write_text(json.dumps(manifest))
 print('Public benchmark prepared:',len(manifest),flush=True)
if __name__=='__main__':main()
