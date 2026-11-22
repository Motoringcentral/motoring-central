# Recovery "how it works" video (video/recovery.mp4)

Made 22 Nov 2026. 2 min 37, 1280x720, same British female voice as the other videos (Kokoro `bf_emma`, en-gb).

- `script.json`: what is said (`say`, numbers and the web address written out in words) and the caption text (`cap`).
- `voice.py`: makes one sound file per line. Each sentence is voiced on its own with pauses that vary (longer after a
  question, shorter between short lines) and long sentences slightly slower, so it sounds less robotic.
- `slides.html` + `render.js`: the slides, drawn in a browser and saved as pictures, one per "build" step.
- `compose.py`: banner opening with a slow zoom, slides timed to the voice with cross-fades, captions (`recovery.vtt`).

Not kept here: the screen pictures used on the slides (taken from the preview site with the test recovery account,
with the test names swapped for sample names), the fonts and the voice model. To change the video, ask Claude.
