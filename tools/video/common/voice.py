import json, subprocess, numpy as np, soundfile as sf, sys
from kokoro_onnx import Kokoro
# Each line of the script is voiced IN ONE GO. Voicing short sentences on their own made the voice add a stray sound
# at the end ("trucks-er", "it-e"). The pauses the voice leaves between sentences are then lengthened a little.
S=sys.argv[1]; k=Kokoro("model/kokoro-v1.0.onnx","model/voices-v1.0.bin"); SR=48000
def trim(a,thr=0.004):
    i=np.where(np.abs(a)>thr)[0]; return a[i[0]:i[-1]+1] if len(i) else a
def stretch(a,sr,thr=0.008,find=0.18,want=0.46):
    q=np.abs(a)<thr; out=[]; i=0; n=len(a); last=0
    while i<n:
        if q[i]:
            j=i
            while j<n and q[j]: j+=1
            L=(j-i)/sr
            if L>=find and L<want and i>0 and j<n:
                mid=(i+j)//2; out.append(a[last:mid]); out.append(np.zeros(int((want-L)*sr),dtype=np.float32)); last=mid
            i=j
        else: i+=1
    out.append(a[last:]); return np.concatenate(out)
cues=json.load(open(S+"/script.json")); durs=[]
for i,c in enumerate(cues):
    a,sr=k.create(c["say"],voice="bf_emma",speed=0.97,lang="en-gb"); a=stretch(trim(a),sr)
    sf.write(S+"/tmp24.wav",a,sr)
    subprocess.run(["ffmpeg","-y","-loglevel","error","-i",S+"/tmp24.wav","-ar",str(SR),"-af","aresample=resampler=soxr",f"{S}/cue{i:02d}.wav"],check=True)
    b,_=sf.read(f"{S}/cue{i:02d}.wav",dtype="float32"); durs.append(round(len(b)/SR,3)); print(i,durs[-1],flush=True)
json.dump(durs,open(S+"/durs.json","w")); print("total voice",round(sum(durs),1))
