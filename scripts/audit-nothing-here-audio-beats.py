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
 "-t","135","-af","highpass=f=45,lowpass=f=170",
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

# Report physical low-frequency attack nearest each proposed visual start.
for cue in [1.60,4.40,4.80,8.00,11.20,14.40,17.60,20.80,
            26.80,29.20,29.60,32.80,33.20,36.00,36.40]:
 k=round(cue*100)
 lo=max(0,k-14);hi=min(len(signal),k+15)
 peaks=sorted(((signal[j],j/100) for j in range(lo,hi)),reverse=True)[:1]
 print("CUE audio transient",cue,[(round(a,4),round(t,3),round(t-cue,3)) for a,t in peaks])

# Validate the seven early spin cues against the actual decoded MP3.
# Tests read the game's live source rather than trusting duplicated cue values.
import re
source=(TRACK.parent.parent.parent/"secrets-3d-finale-timeline.js").read_text()
opening=source.split("export const CAT_POSE_CUTS=[",1)[1].split("];",1)[0]
starts=[float(t) for t in re.findall(r'\[([0-9.]+),\s*"loaf"\]',opening)[:7]]
assert len(starts)==7, f"Missing seven opening spin starts: {starts}"
for cue in starts:
 k=round(cue*100)
 picks=[(signal[j],j/100) for j in range(max(0,k-1),
      min(len(signal),k+10))]
 amplitude,attack=max(picks)
 delta=attack-cue
 assert amplitude>.026 and -.015<=delta<=.082, (
  f"Early duck spin at {cue:.3f}s misses an audible attack: "
  f"peak at {attack:.3f}, strength={amplitude:.3f}")
 print("PASS: intro spin start",cue,"MP3 attack",round(attack,3),
       "delta",round(delta,3),"amplitude",round(amplitude,4))

# Report later pose transitions against the complete 134.699-second soundtrack.
# These are diagnostics, NOT automatic snapping: fills, syncopations and
# instrument changes can create valid non-kick entrances.
late_starts=[float(t) for t in re.findall(
 r'\[([0-9.]+),\s*"loaf"\]',opening)[7:]]
for cue in late_starts:
 k=round(cue*100)
 left=max(0,k-19);right=min(len(signal),k+20)
 peak=max(((signal[j],j/100) for j in range(left,right)),default=(0,0))
 near=[(round(signal[j],4),round(j/100,3)) for j in range(left,right)
       if signal[j]>.015 and signal[j]>=signal[max(0,j-1)]
       and signal[j]>=signal[min(len(signal)-1,j+1)]]
 near=sorted(near,reverse=True)[:4]
 print("LATE SPIN AUDIO",round(cue,3),"bass peaks",
       near,"strongest",round(peak[1],3),
       "offset",round(peak[1]-cue,3),
       "strength",round(peak[0],4))


# Bass disappears in a few sections, but that alone does not mean the
# song is silent. Audit the full audible spectrum before changing pose
# transitions in quiet / high-frequency sections.
full_sample_rate=8000
full=subprocess.run([
 "ffmpeg","-nostdin","-v","error","-i",str(TRACK),"-t","135",
 "-ar",str(full_sample_rate),"-ac","1","-f","f32le","pipe:1"
],capture_output=True,check=True)
full_samples=array.array("f")
full_samples.frombytes(full.stdout)
if os.sys.byteorder=="big":full_samples.byteswap()
def volume_at(t,length=.2):
 low=int(t*full_sample_rate)
 high=min(len(full_samples),int((t+length)*full_sample_rate))
 if high<=low:return 0.
 part=full_samples[low:high]
 return math.sqrt(sum(x*x for x in part)/len(part))
for left,right in [(0,2.5),(26.5,33.5),(61.5,66.5),(86.5,89.5),(102.8,104.5)]:
 values=[(round(t/10,2),round(volume_at(t/10),5))
  for t in range(round(left*10),round(right*10),2)]
 print("FULL-BAND VOLUME",left,right,values)
