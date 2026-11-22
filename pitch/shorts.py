# python shorts.py DIR OUT [trade ...] : makes OUT/<trade>-short.mp4 from the screens drawn by shorts.js.
# Run it from the voice tools folder with their Python (the one that has kokoro_onnx), after voicing each trade with
# tools/video/common/voice.py DIR/<trade>, which writes cue00.wav, cue01.wav, cue02.wav and durs.json.
# The photo zooms in slowly for the whole video; the words under it change with each line the voice says.
import json, os, subprocess, sys
import numpy as np, soundfile as sf
from PIL import Image
DIR, OUT = sys.argv[1], sys.argv[2]
KEYS = sys.argv[3:] or sorted(k for k in os.listdir(DIR) if os.path.isfile(f'{DIR}/{k}/durs.json'))
FPS, SR, W, H = 30, 48000, 1080, 1920
LEAD, GAP, TAIL, FADE = 0.5, 0.5, 1.8, 0.4
Y0, PH = 392, 540  # where the photo shows through
os.makedirs(OUT, exist_ok=True)
for key in KEYS:
    d = f'{DIR}/{key}'
    durs = json.load(open(d + '/durs.json'))
    starts, t = [], LEAD
    for x in durs: starts.append(t); t += x + GAP
    total = t - GAP + TAIL
    # screens, split into colour (already multiplied by how solid it is) and how much photo shows through
    scr = []
    for n in range(3):
        a = np.asarray(Image.open(f'{d}/o{n}.png').convert('RGBA'), dtype=np.float32)
        al = a[..., 3:4] / 255.0
        scr.append((a[..., :3] * al, 1.0 - al[Y0:Y0 + PH]))
    photo = Image.open(d + '/photo.png').convert('RGB'); PW, PHH = photo.size
    audio = np.zeros(int(total * SR) + SR, dtype=np.float32)
    for i, s in enumerate(starts):
        a, _ = sf.read(f'{d}/cue{i:02d}.wav', dtype='float32'); audio[int(s * SR):int(s * SR) + len(a)] += a
    audio *= 0.89 / np.max(np.abs(audio)); sf.write(d + '/voice_full.wav', audio[:int(total * SR)], SR)
    out = f'{OUT}/{key}-short.mp4'
    ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-i', d + '/voice_full.wav',
                           '-c:v', 'libx264', '-preset', 'slow', '-crf', '25', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-g', '60',
                           '-af', 'volume=4.5dB,alimiter=limit=0.94:level=false', '-c:a', 'aac', '-b:a', '128k', '-ac', '1', '-movflags', '+faststart', '-shortest', out], stdin=subprocess.PIPE)
    def frame(n, ph):
        col, thru = scr[n]; f = col.copy(); f[Y0:Y0 + PH] += ph * thru; return f
    nfr = int(total * FPS)
    for k in range(nfr):
        tt = k / FPS
        z = 1.0 + 0.10 * (tt / total); w, h = PW / z, PHH / z; x, y = (PW - w) * 0.5, (PHH - h) * 0.45
        ph = np.asarray(photo.resize((W, PH), Image.BICUBIC, box=(x, y, x + w, y + h)), dtype=np.float32)
        n = max(i for i, s in enumerate(starts) if i == 0 or tt >= s - 0.25)
        fr = frame(n, ph)
        if n > 0:
            a = (tt - (starts[n] - 0.25)) / FADE
            if a < 1.0: a = a * a * (3 - 2 * a); fr = frame(n - 1, ph) * (1 - a) + fr * a
        if tt < 0.35: fr = fr * (tt / 0.35)
        if tt > total - 0.4: fr = fr * max(0.0, (total - tt) / 0.4)
        ff.stdin.write(np.clip(fr, 0, 255).astype(np.uint8).tobytes())
    ff.stdin.close(); ff.wait()
    print(key, 'seconds', round(total, 1), 'file', os.path.getsize(out) // 1024, 'KB', flush=True)
