import re, json, subprocess, numpy as np, soundfile as sf, sys
from kokoro_onnx import Kokoro
S=sys.argv[1]
k=Kokoro("model/kokoro-v1.0.onnx","model/voices-v1.0.bin")
SR=48000
def trim(a,thr=0.004):
    i=np.where(np.abs(a)>thr)[0]; return a[i[0]:i[-1]+1] if len(i) else a
def gap_after(s,nxt):
    w=len(s.split())
    if s.endswith('?'): return 0.55            # let a question hang
    if w<=3: return 0.34                       # short, punchy lines run together
    if nxt and len(nxt.split())<=3: return 0.40
    return 0.50
def synth(text):
    parts=[p for p in re.split(r'(?<=[.?!])\s+',text) if p]; out=[]
    for i,p in enumerate(parts):
        sp=0.97 if len(p.split())>12 else 0.99   # a touch slower on long sentences, as a person would
        a,sr=k.create(p,voice="bf_emma",speed=sp,lang="en-gb"); a=trim(a)
        f=int(0.012*sr); a[:f]*=np.linspace(0,1,f); a[-f:]*=np.linspace(1,0,f); out.append(a)
        if i<len(parts)-1: out.append(np.zeros(int(gap_after(p,parts[i+1])*sr),dtype=np.float32))
    a=np.concatenate(out); sf.write(S+"/tmp24.wav",a,sr)
    subprocess.run(["ffmpeg","-y","-loglevel","error","-i",S+"/tmp24.wav","-ar",str(SR),"-af","aresample=resampler=soxr",S+"/tmp48.wav"],check=True)
    b,_=sf.read(S+"/tmp48.wav",dtype="float32"); return b
cues=json.load(open(S+"/script.json")); durs=[]
for i,c in enumerate(cues):
    a=synth(c["say"]); sf.write(f"{S}/cue{i:02d}.wav",a,SR); durs.append(round(len(a)/SR,3)); print(i,durs[-1],flush=True)
json.dump(durs,open(S+"/durs.json","w")); print("total voice",sum(durs))
