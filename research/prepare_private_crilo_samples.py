#!/usr/bin/env python3
"""Prepare *local only* Crilo QA drawing manifest; never commits or uploads images.

Takes owner export with base64 PNG images. Images and labels stay in the
destination directory; do not use six previously inspected images as holdout
after selecting a model based on their results.
"""
import argparse, base64, json, pathlib, hashlib
from PIL import Image
import io

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--export',required=True)
    p.add_argument('--output',default='research/private-qa/')
    args=p.parse_args()
    data=json.loads(pathlib.Path(args.export).read_text())
    if data.get('format')!='crilo-owner-private-qa-v1':raise ValueError('Unexpected export format')
    destination=pathlib.Path(args.output)
    destination.mkdir(parents=True,exist_ok=True)
    manifest=[]
    hashes=set()
    for row in data.get('samples',[]):
        value=row.get('image','')
        if not value.startswith('data:image/png;base64,'):continue
        raw=base64.b64decode(value.split(',',1)[1],validate=True)
        if len(raw)>2000000:raise ValueError('Unexpected image size')
        digest=hashlib.sha256(raw).hexdigest()
        if digest in hashes:continue
        hashes.add(digest)
        with Image.open(io.BytesIO(raw)) as im:
            im.verify()
        file='drawing-'+digest[:12]+'.png'
        (destination/file).write_bytes(raw)
        manifest.append({'file':file,'expected':'unknown','subset':'diagnostic'})
    (destination/'labels.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('Saved',len(manifest),'drawings locally to',destination)
    print('Label privately and acquire a separate independent holdout; do not publish private drawings.')
if __name__=='__main__':main()
