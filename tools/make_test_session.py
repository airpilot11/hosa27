"""Create a FAKE participant session (code T99, marked demo) to test the Mac scoring pipeline.

Spoken answers are generated with the Mac's built-in `say` voice. The box "drawing" is the app icon
(placeholder, so the AI should score it 0). Timing values are made up but realistic. Output goes to data/raw/ (marked demo, so scripts only use it with --demo / it is ignored
by real-data runs).

Run:  python3 tools/make_test_session.py
"""
import base64
import json
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TASKS = ROOT / "app" / "tasks.js"

# read STEPS from tasks.js using macOS JavaScriptCore (no Node needed)
jxa = f'''
const src = $.NSString.stringWithContentsOfFileEncodingError("{TASKS}", $.NSUTF8StringEncoding, null).js;
eval(src + "; JSON.stringify(STEPS)");
'''
steps = json.loads(subprocess.run(["osascript", "-l", "JavaScript", "-e", jxa], capture_output=True, text=True, check=True).stdout)

now = datetime.now()
answers = {  # what the fake participant "says"
    "orient_day": now.strftime("%A"), "orient_date": f"It is the {now.day}th", "orient_month": now.strftime("%B"),
    "orient_year": "twenty twenty five, no wait, twenty twenty six", "orient_place": "the test center", "orient_city": "Atlanta",
    "learn_1": "river, candle, and garden",
    "name_1": "an anchor", "name_2": "a pineapple", "name_3": "um, a frog?",
    "digits_6": "7 2 8 5 1 6", "digits_7": "3 9 4 8 1 6 2", "serial7": "73, 66, 58, 51, 44",
    "sentence_1": "The woman who lives next to the bakery walks her two dogs every evening.",
    "sentence_2": "Before the storm, the farmer locked the barn and counted his sheep.",
    "fluency": "pen, pencil, paper, Paris, purple, pink, pickle, plant, planted, phone, pie, pear, pillow, pot",
    "abstract_1": "they both give you the news", "abstract_2": "they both have colors",
    "recall": "river, jacket, candle, and I think piano",
}


def say_to_m4a(text: str) -> str:
    with tempfile.TemporaryDirectory() as d:
        out = Path(d) / "a.m4a"
        subprocess.run(["say", "-o", str(out), "--file-format=m4af", "--data-format=aac", text], check=True)
        return "data:audio/mp4;base64," + base64.b64encode(out.read_bytes()).decode()


items = {}
for st in steps:
    it = {"id": st["id"], "type": st["type"], "domain": st.get("domain"), "max": st.get("max", 0),
          "scoredBy": st.get("scoredBy", "none"), "prompt": st.get("text", ""), "key": st.get("key")}
    it["totalMs"] = 9000
    if st["id"] in answers:
        it.update(audio=say_to_m4a(answers[st["id"]]), audioMime="audio/mp4", recordMs=4000,
                  latencyMs=1400 + 90 * len(items), speechEndMs=3800, responseMs=4000, instructionMs=3500)
    elif st["type"] == "draw":
        it["image"] = "data:image/png;base64," + base64.b64encode((ROOT / "app/icons/icon-512.png").read_bytes()).decode()
        it.update(strokes=9, firstStrokeMs=6200, latencyMs=900, drawMs=38000, durationMs=44200)
    elif st["id"] == "trail":
        it.update(completed=True, errors=1, durationMs=58000, firstTapMs=2100, appScore=1)
    elif st["id"] in ("rotate_1", "rotate_2"):
        ok = st["id"] == "rotate_1"
        it.update(choice=1 if ok else 0, correct=ok, rtMs=7400 if ok else 12900, appScore=1 if ok else 0, stopReason="tapped")
    elif st["id"] == "letters":
        it.update(hits=8, misses=0, falseAlarms=1, lureTaps=1, meanHitRtMs=640, appScore=1)

    items[st["id"]] = it

session = {
    "app": "hosa27", "version": "test", "demo": True, "sessionId": f"DEMO-T99_{int(now.timestamp())}", "code": "T99",
    "order": "app_first", "place": "Test Center", "city": "Alpharetta", "observer": "XX",
    "startedAt": now.isoformat(), "localDate": now.strftime("%Y-%m-%d"), "weekday": now.strftime("%A"),
    "month": now.strftime("%B"), "dayOfMonth": now.day, "year": now.year,
    "steps": [{k: st.get(k) for k in ("id", "type", "domain", "max", "scoredBy", "key")}
              | {"prompt": st.get("text", ""), "countOnly": bool(st.get("countOnly"))} for st in steps],
    "items": items, "helpEvents": [], "completed": True,
}
out = ROOT / "data" / "raw" / "hosa27_T99_TEST.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(session))
print("wrote", out)
