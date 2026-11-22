# The site's videos

All six videos were re-made or re-checked on 22 Nov 2026 in one style: slides drawn in a browser, real pictures of the
site, the same British female voice (Kokoro `bf_emma`, en-gb), captions from the script.

| Video | File | Shown | Folder |
|---|---|---|---|
| Customer tour | `video/intro.mp4` | "Watch how it works" on the home page | `intro/` |
| Dealers | `video/dealer.mp4` | step 2 of the dealer join page | `dealer/` |
| MOT test stations | `video/mot-station.mp4` | in the MOT station application | `mot-station/` |
| Mobile EV charging | `video/ev-charging.mp4` | step 2 of the EV join page | `ev-charging/` |
| Recovery | `video/recovery.mp4` | step 2 of the recovery join page | `recovery/` (its own older copies of the scripts) |
| Driving instructors | `video/instructors.mp4` | step 2 of the instructor join page | `instructors/` |

Each folder has `script.json` (what is said, the caption, and `b`: the points in each line where the next part of
the slide appears) and `slides.html`. The shared tools are in `common/`:

1. `voice.py DIR` makes one sound file per line. Every line is voiced IN ONE GO (short sentences voiced alone get a
   stray sound on the end). Write numbers and the web address in words in `say`; write "MOT" as MOT.
2. `check-voice.py DIR` listens to each line with speech recognition and prints where it differs from the script. Extra
   words mean a stray sound. The recogniser is American, so "MOT", "buyers", "enquiries" and "VAT" always show as
   differences: that is the recogniser, not the voice.
3. `render.js DIR` draws the slides and reports anything that does not fit or any missing picture.
4. `compose.py DIR NAME` makes `NAME.mp4` and `NAME.vtt`.

Not kept in the repo: the screen pictures (taken from the preview site with the test accounts, test names swapped
for sample names), the fonts, the voice model and the speech recogniser. To change a video, ask Claude.

Facts every video must match: partners pay 10% + VAT per job and nothing monthly; customers pay a 9.99 booking fee
(not on MOTs or driving lessons); MOT stations are paid the official fee less a flat 5 pounds (49.85 for a car);
dealers pay a monthly plan from 169 + VAT with 30 days free and no commission; payouts are weekly.
