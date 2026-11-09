#!/usr/bin/env python3
"""Inspect beat attacks in the ACTUAL licensed finale MP3, not metadata BPM.
Uses ffmpeg (available on GitHub's Ubuntu runners) to bandpass kick frequencies.
Prints 150-BPM beat-grid phase candidates for three different time windows.
The strongest offsets are diagnostics, not proof of a specific pose cut.
"""
import array
import math
import os
import subprocess
from pathlib import Path
from statistics import median

TRACK=Path(__file__).resolve().parent.parent/"audio/nothing-here/finale-licensed.mp3"
SAMPLE_RATE=2000
BIN=20  # 10ms
PERIOD=.4
if not TRACK.is_file():raise SystemExit("Missing licensed finale MP3")
p=subprocess.run([
 "ffmpeg","-nostdin","-v","error","-i",str(TRACK),
 "-t","65","-af","highpass=f=45,lowpass=f=170",
 "-ar",str(SAMPLE_RATE),"-ac","1","-f","f32le","pipe:1",
],capture_output=True,check=True)
if not p.stdout:raise SystemExit("No decoded audio")
samples=array.array("f")
samples.frombytes(p.stdout)
if os.sys.byteorder=="big":samples.byteswap()
env=[]
for i in range(0,len(samples)-BIN,BIN):
 env.append(math.sqrt(sum(x*x for x in samples[i:i+BIN])/BIN))
# Transient score: positive rise above a rolling previous 40ms baseline,
# weighted by local loudness to avoid treating noisy intro as all kicks.
attack=[]
for i,v in enumerate(env):
 prev=max(env[max(0,i-4):i] or [0])
 attack.append(max(0,v-prev))
# Smooth each transient slightly to avoid sample-grid dependence.
signal=[max(attack[max(0,i-2):min(len(attack),i+3)])
        for i in range(len(attack))]
print("MP3 source",TRACK,"size",TRACK.stat().st_size,
 "seconds",round(len(samples)/SAMPLE_RATE,3))
for left,right in [(0,26.5),(27,32.9),(33,59),(0,59)]:
 ranked=[]
 for phase_centi in range(40):
  offset=phase_centi/100
  total=0.0;count=0;beats=[]
  for n in range(-1,200):
   t=offset+n*PERIOD
   if t<left or t>=right:continue
   k=round(t*100)
   if k<0 or k>=len(signal):continue
   peak=max(signal[max(0,k-2):min(len(signal),k+3)])
   total+=peak;count+=1;beats.append((t,peak))
  ranked.append((total/max(1,count),offset,count))
 ranked.sort(reverse=True)
 print("Window",left,right,"best grid offsets",[
  (round(sc,5),round(off,2)) for sc,off,n in ranked[:8]])
 # Print strongest onset peaks for visual comparisons
 if left<1:
  candidates=[(signal[i],i/100) for i in range(10,min(len(signal)-10,1300))
    if signal[i]>signal[i-1] and signal[i]>=signal[i+1]]
  candidates.sort(reverse=True)
  kept=[]
  for amp,tt in candidates:
   if all(abs(tt-old_t)>.07 for _,old_t in kept):
    kept.append((round(amp,4),round(tt,3)))
   if len(kept)>=18:break
  print("Top attacks in first 13s",sorted(kept,key=lambda p:p[1]))
