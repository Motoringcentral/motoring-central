# python compose.py DIR NAME : the finished video DIR/NAME.mp4 with captions DIR/NAME.vtt, from the slide pictures,
# the voice files (cueNN.wav) and script.json. Each line of the script can carry "b": the points in the line (0 to 1)
# where the next part of its slide appears. The opening slide zooms in slowly.
import json, subprocess, sys, numpy as np, soundfile as sf
from PIL import Image
D,NAME=sys.argv[1],sys.argv[2]
FPS=25; SR=48000; LEAD=1.8; GAP=0.8; TAIL=2.6; W,H=1280,720
durs=json.load(open(D+'/durs.json')); cues=json.load(open(D+'/script.json'))
t=LEAD; starts=[]
for d in durs: starts.append(t); t+=d+GAP
total=t-GAP+TAIL
ev=[(0.0,0,0,0.0)]
for i,(s,d) in enumerate(zip(starts,durs)):
    if i>0: ev.append((s-0.45,i,0,0.5))
    for j,f in enumerate(cues[i].get('b',[])): ev.append((s+f*d,i,j+1,0.35))
ev.sort()
cache={}
def img(i,j):
    k=(i,j)
    if k not in cache:
        cache.clear() if len(cache)>6 else None
        cache[k]=np.asarray(Image.open(f'{D}/f_{i}_{j}.png').convert('RGB'),dtype=np.float32)
    return cache[k]
nb=len(cues[0].get('b',[]))+1
ban=[Image.open(f'{D}/f_0_{j}.png').convert('RGB') for j in range(nb)]
ban_end=starts[1]-0.45+0.5
def banner(j,tt):
    z=1.0+0.07*min(1,tt/ban_end); w,h=W/z,H/z; x,y=(W-w)*0.5,(H-h)*0.42
    return np.asarray(ban[j].resize((W,H),Image.BICUBIC,box=(x,y,x+w,y+h)),dtype=np.float32)
audio=np.zeros(int(total*SR)+SR,dtype=np.float32)
for i,s in enumerate(starts):
    a,_=sf.read(f'{D}/cue{i:02d}.wav',dtype='float32'); audio[int(s*SR):int(s*SR)+len(a)]+=a
pk=np.max(np.abs(audio)); audio=audio*(0.89/pk); sf.write(D+'/voice_full.wav',audio[:int(total*SR)],SR)
ff=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i',D+'/voice_full.wav',
  '-c:v','libx264','-preset','slow','-crf','24','-pix_fmt','yuv420p','-profile:v','high','-g','50','-af','volume=4.5dB,alimiter=limit=0.94:level=false','-c:a','aac','-b:a','128k','-ac','1','-movflags','+faststart','-shortest',f'{D}/{NAME}.mp4'],stdin=subprocess.PIPE)
n=int(total*FPS); ei=0
for f in range(n):
    tt=f/FPS
    while ei+1<len(ev) and ev[ei+1][0]<=tt: ei+=1
    te,i,j,fd=ev[ei]
    cur=banner(j,tt) if i==0 else img(i,j)
    a=1.0 if fd==0 else min(1.0,(tt-te)/fd)
    if a<1.0 and ei>0:
        _,pi,pj,_=ev[ei-1]; prev=banner(pj,tt) if pi==0 else img(pi,pj)
        a=a*a*(3-2*a); fr=prev*(1-a)+cur*a
    else: fr=cur
    if tt<0.5: fr=fr*(tt/0.5)
    if tt>total-0.5: fr=fr*max(0,(total-tt)/0.5)
    ff.stdin.write(np.clip(fr,0,255).astype(np.uint8).tobytes())
ff.stdin.close(); ff.wait()
def fmt(x):
    h=int(x//3600); m=int(x%3600//60); s=x-h*3600-m*60; return f"{h:02d}:{m:02d}:{s:06.3f}"
open(f'{D}/{NAME}.vtt','w',encoding='utf-8').write("WEBVTT\n\n"+"\n\n".join(f"{fmt(s)} --> {fmt(s+d)}\n{c['cap']}" for s,d,c in zip(starts,durs,cues))+"\n")
json.dump({'starts':starts,'total':total},open(D+'/timeline.json','w')); print(NAME,'total',round(total,2),'frames',n)
