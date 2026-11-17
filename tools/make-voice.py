"""Pre-record the voice coach with a local neural voice (Kokoro-82M, Apache-2.0).

Every sentence the app can speak becomes voice/<key>.mp3, listed in voice/manifest.json. The app plays these and
falls back to the device voice for anything missing. Only new or changed sentences are recorded, so after editing
cues just run it again.

Setup (once):
    python -m venv .venv-voice && .venv-voice/Scripts/pip install kokoro-onnx soundfile numpy lameenc
    download kokoro-v1.0.int8.onnx and voices-v1.0.bin from
    https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0

Run:
    node tools/speech-lines.mjs > voice-lines.json
    python tools/make-voice.py voice-lines.json --model <dir with the two model files> [--voice af_heart] [--force]
"""
import argparse, json, os, sys, time
import numpy as np, lameenc
from kokoro_onnx import Kokoro

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "voice")

ap = argparse.ArgumentParser()
ap.add_argument("lines")
ap.add_argument("--model", required=True)
ap.add_argument("--voice", default="af_heart")
ap.add_argument("--speed", type=float, default=0.86, help="speaking rate for cues (1 = normal)")
ap.add_argument("--slow", type=float, default=0.78, help="speaking rate for breath words")
ap.add_argument("--kbps", type=int, default=40)
ap.add_argument("--force", action="store_true", help="re-record everything (after changing voice or speed)")
a = ap.parse_args()

lines = json.load(open(a.lines, encoding="utf-8"))
os.makedirs(OUT, exist_ok=True)
man_path = os.path.join(OUT, "manifest.json")
old = json.load(open(man_path, encoding="utf-8")) if os.path.exists(man_path) else {}
same = old.get("voice") == a.voice and old.get("speed") == a.speed and old.get("slow") == a.slow and not a.force
clips = {k: v for k, v in old.get("clips", {}).items() if same and k in lines and os.path.exists(os.path.join(OUT, k + ".mp3"))}

k = Kokoro(os.path.join(a.model, "kokoro-v1.0.int8.onnx"), os.path.join(a.model, "voices-v1.0.bin"))
lang = "en-gb" if a.voice.startswith("b") else "en-us"

def polish(x, sr):
    """trim silence, soften the edges, and bring every clip to the same gentle loudness"""
    x = np.asarray(x, dtype=np.float32)
    env = np.convolve(np.abs(x), np.ones(240) / 240, mode="same")
    on = np.where(env > 0.012)[0]
    if len(on): x = x[max(0, on[0] - int(.03 * sr)): on[-1] + int(.12 * sr)]
    rms = np.sqrt(np.mean(x ** 2)) or 1.0
    x = x * min(0.075 / rms, 0.89 / (np.max(np.abs(x)) or 1.0))
    f = int(.02 * sr); ramp = np.linspace(0, 1, f, dtype=np.float32)
    x[:f] *= ramp; x[-f:] *= ramp[::-1]
    return x

def mp3(x, sr):
    e = lameenc.Encoder()
    e.set_bit_rate(a.kbps); e.set_in_sample_rate(sr); e.set_channels(1); e.set_quality(2)
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes()
    return e.encode(pcm) + e.flush()

todo = [key for key in lines if key not in clips]
print(f"{len(lines)} sentences, {len(todo)} to record with {a.voice}", flush=True)
t0 = time.time()
for i, key in enumerate(todo, 1):
    item = lines[key]
    audio, sr = k.create(item["text"], voice=a.voice, speed=a.slow if item["slow"] else a.speed, lang=lang)
    x = polish(audio, sr)
    open(os.path.join(OUT, key + ".mp3"), "wb").write(mp3(x, sr))
    clips[key] = int(len(x) / sr * 1000)
    if i % 50 == 0 or i == len(todo):
        el = time.time() - t0
        print(f"{i}/{len(todo)}  {el:.0f}s elapsed, ~{el / i * (len(todo) - i):.0f}s left", flush=True)
        json.dump({"voice": a.voice, "speed": a.speed, "slow": a.slow, "clips": dict(sorted(clips.items()))}, open(man_path, "w"), separators=(",", ":"))

# drop recordings of sentences the app no longer says
for f in os.listdir(OUT):
    if f.endswith(".mp3") and f[:-4] not in lines: os.remove(os.path.join(OUT, f))
json.dump({"voice": a.voice, "speed": a.speed, "slow": a.slow, "clips": dict(sorted(clips.items()))}, open(man_path, "w"), separators=(",", ":"))
size = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
print(f"done: {len(clips)} clips, {size / 1e6:.1f} MB, {sum(clips.values()) / 60000:.0f} min of speech")
