# /// script
# requires-python = ">=3.10"
# dependencies = ["faster-whisper", "av<17"]
# ///
import json, os, sys
from faster_whisper import WhisperModel

inp = json.load(open(os.environ["PIPELINE_INPUT"]))
out = os.environ["PIPELINE_OUT_DIR"]

def has_cuda():
    try:
        import ctranslate2
        return ctranslate2.get_cuda_device_count() > 0
    except Exception:
        return False

cuda = has_cuda()
size = inp.get("model") or ("large-v3-turbo" if cuda else "small")
model = WhisperModel(size, device="cuda" if cuda else "cpu", compute_type="float16" if cuda else "int8")
print(f"model={size} device={'cuda' if cuda else 'cpu'}", file=sys.stderr)

words = bool(inp.get("wordTimestamps"))
segs, info = model.transcribe(inp["audio"], language=inp.get("language") or None, task=inp.get("task") or "transcribe",
                              vad_filter=True, word_timestamps=words)

def ts(t, sep):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02}{sep}{ms:03}"

segments, srt, vtt, txt = [], [], ["WEBVTT\n"], []
for i, s in enumerate(segs, 1):
    text = s.text.strip()
    seg = {"id": i, "start": round(s.start, 2), "end": round(s.end, 2), "text": text}
    if words and s.words:
        seg["words"] = [{"word": w.word, "start": round(w.start, 2), "end": round(w.end, 2)} for w in s.words]
    segments.append(seg)
    srt.append(f"{i}\n{ts(s.start, ',')} --> {ts(s.end, ',')}\n{text}\n")
    vtt.append(f"{ts(s.start, '.')} --> {ts(s.end, '.')}\n{text}\n")
    txt.append(text)

open(os.path.join(out, "transcript.txt"), "w").write("\n".join(txt) + "\n")
open(os.path.join(out, "transcript.srt"), "w").write("\n".join(srt))
open(os.path.join(out, "transcript.vtt"), "w").write("\n".join(vtt))
json.dump({"language": info.language, "languageProbability": round(info.language_probability, 3), "durationSeconds": round(info.duration, 2),
           "model": size, "device": "cuda" if cuda else "cpu", "text": " ".join(txt), "segments": segments},
          open(os.path.join(out, "result.json"), "w"), ensure_ascii=False)
