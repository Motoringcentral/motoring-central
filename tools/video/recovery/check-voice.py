import sys, json, wave, subprocess, re, difflib
from vosk import Model, KaldiRecognizer, SetLogLevel
SetLogLevel(-1)
S=sys.argv[1]; pat=sys.argv[2] if len(sys.argv)>2 else 'cue'
m=Model('/tmp/claude-0/-home-user/65160ceb-b0cf-5003-ba81-9b3896f5b017/scratchpad/tts/asr/vosk-model-en-us-0.22-lgraph')
cues=json.load(open(S+'/script.json'))
def norm(t): return re.sub(r"[^a-z' ]"," ",t.lower().replace("-"," ")).split()
def hear(path):
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',path,'-ar','16000','-ac','1',S+'/asr16.wav'],check=True)
    w=wave.open(S+'/asr16.wav'); r=KaldiRecognizer(m,16000); r.SetWords(True); words=[]
    while True:
        d=w.readframes(4000)
        if not d: break
        if r.AcceptWaveform(d): words+=json.loads(r.Result()).get('result',[])
    words+=json.loads(r.FinalResult()).get('result',[]); return words
bad=0
for i,c in enumerate(cues):
    ws=hear(f"{S}/{pat}{i:02d}.wav"); got=[x['word'] for x in ws]; exp=norm(c['say'])
    sm=difflib.SequenceMatcher(None,exp,got); diffs=[]
    for tag,a0,a1,b0,b1 in sm.get_opcodes():
        if tag!='equal': diffs.append(f"[{' '.join(exp[a0:a1]) or '-'} => {' '.join(got[b0:b1]) or '-'}]")
    bad+=len(diffs); print(i, 'OK' if not diffs else ' '.join(diffs), flush=True)
print('differences:',bad)
