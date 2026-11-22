# Recovery "how it works" video (video/recovery.mp4)

Made 22 Nov 2026. 2 min 27, 1280x720, same British female voice as the other videos (Kokoro `bf_emma`, en-gb).

- `script.json`: what is said (`say`, numbers and the web address written out in words) and the caption text (`cap`).
- `voice.py`: makes one sound file per line. Each line is voiced IN ONE GO, then the pauses between sentences are
  lengthened a little. Do NOT voice short sentences on their own: the voice adds a stray sound at the end
  ("trucks-er", "what is it-e"). Avoid runs of very short sentences in the script; join them with commas.
- `check-voice.py`: listens to each line with speech recognition (Vosk, model from alphacephei.com) and prints where
  what it hears differs from the script. Extra words mean a stray sound. Run it after every change to the voice.
- `slides.html` + `render.js`: the slides, drawn in a browser and saved as pictures, one per "build" step.
- `compose.py`: banner opening with a slow zoom, slides timed to the voice with cross-fades, captions (`recovery.vtt`).

Not kept here: the screen pictures used on the slides (taken from the preview site with the test recovery account,
with the test names swapped for sample names), the fonts and the voice model. To change the video, ask Claude.
