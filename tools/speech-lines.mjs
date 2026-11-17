// Lists every sentence the voice coach can say, across all modes, for tools/make-voice.py.
// Usage: node tools/speech-lines.mjs > voice-lines.json   (writes {"<key>": {"text": ..., "slow": bool}})
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { window: {}, console };
ctx.window = ctx;
vm.createContext(ctx);
const files = ["js/poses.js", "js/speech.js", ...fs.readdirSync(path.join(root, "js/modes")).filter(f => f.endsWith(".js")).map(f => "js/modes/" + f)];
// classic scripts share one global scope in the browser; concatenating them reproduces that here
vm.runInContext(files.map(f => fs.readFileSync(path.join(root, f), "utf8")).join("\n;\n") + "\n;this.SPEECH=SPEECH;", ctx);
const { SPEECH, MODES } = ctx;
const out = {};
for (const mode of MODES) for (const s of SPEECH.lines(mode)) out[SPEECH.key(s)] = { text: s, slow: SPEECH.isSlow(s) };
// the sample played when switching voices
for (const s of SPEECH.split("Breathe in. And slowly out.")) out[SPEECH.key(s)] = { text: s, slow: SPEECH.isSlow(s) };
process.stdout.write(JSON.stringify(out, null, 1));
console.error(Object.keys(out).length + " sentences, " + Object.values(out).reduce((a, x) => a + x.text.split(/\s+/).length, 0) + " words");
