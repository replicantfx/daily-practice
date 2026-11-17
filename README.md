# Daily Practice

Guided daily sessions in four modes, with one calm voice coach and one steady breath running through every session.

- **Movement**: unhurried mobility, stances, deep stretching and stillness drawn from qigong and the martial arts (71 movements, 16 routines)
- **Pilates**: classical Reformer workouts drawn on an animated Reformer, with spring settings as levels, Balanced Body colors, or both (27 exercises, 9 routines)
- **Yoga**: breath-led poses and flows on the mat, including a full twelve-position sun salutation (27 poses, 8 routines)
- **Strength**: slow, controlled bodyweight and dumbbell training, one repetition per breath (27 exercises, 7 routines)

Each mode has a new daily session on a weekly rhythm (in short, standard or long lengths, favoring what you haven't done recently), curated routines that scale to the time you have, a composer, and a library. Your practice log and streak span all four modes; logs from Daily Move and Daily Reformer are brought over automatically when the app runs on the same site.

## The voice

The coach speaks with a pre-recorded neural voice instead of the phone's built-in speech, so it sounds the same, calm voice on every device. Every sentence the app can say is recorded once (`voice/*.mp3`, about 1,400 short clips) with [Kokoro](https://github.com/hexgrad/kokoro), an open (Apache-2.0) text-to-speech model that runs locally. Clips download as a session needs them and are cached for offline use; The **Voice** button in the header opens a panel to choose the calm voice or the device voice and to save any mode for offline use. Any sentence without a recording falls back to the device voice.

After changing any spoken text (cues, setups, names, presence prompts), record the new sentences:

```
node tools/speech-lines.mjs > voice-lines.json
python tools/make-voice.py voice-lines.json --model <folder with the Kokoro model files>
```

Only new sentences are recorded; ones the app no longer says are deleted. `--voice` picks another Kokoro voice (for example `bf_emma` or `af_nicole`) and `--force` re-records everything. Setup instructions are at the top of `tools/make-voice.py`.

## The figures

Every movement is a short list of keyframe poses (joint angles, or hand and foot targets solved with inverse kinematics) mapped onto the breath. The renderer draws a shaped figure with tapered limbs, keeps a steady camera per movement, eases through in-between keyframes without stopping, lifts feet and hands when they step, glides from one movement into the next, and lets the chest rise a little on every in-breath. Limbs carry a thin outline so an arm or leg passing in front of the body stays readable, and a movement can add a second camera (`alt`) so it shows side and front views together, as Knee Circles, Wrist and Ankle Circles and the squats do.

To check poses while authoring, open the app with `?sheet=<mode>` for a contact sheet of every movement (`&keys=1` shows the keyframes themselves, `&ids=a,b` picks movements).

## How it's built

No build step. `index.html` holds the layout and styles; the code is in `js/`:

- `poses.js`: the figure model and shared pose building blocks
- `modes/*.js`: one file per mode with its movements, routines, weekly themes and coaching text
- `speech.js`: everything the coach says, shared by the app and the voice tools
- `engine.js`: pose math, drawing, the player, voice and the home screen

Around it, `manifest.webmanifest` and `icons/` make it installable, and `sw.js` caches everything for offline use (bump `VERSION` when you add or rename files). `fonts/` holds subsets containing only the characters the app uses; after adding text with new characters, run `python tools/update-fonts.py`.

## Install on your phone

- **iPhone / iPad (Safari):** Share → **Add to Home Screen**
- **Android (Chrome):** tap **Install app** in the header, or ⋮ → **Install app**

Move within a range that feels easy and stop if anything hurts. For the Reformer, check the springs, footbar and headrest before each exercise and never step on or off a moving carriage. If you are new to any of these practices, pregnant, or managing an injury or health condition, check with a clinician or a qualified instructor first.
