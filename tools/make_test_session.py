"""Create a FAKE participant session (code T99, marked demo) to test the Mac scoring pipeline.

Spoken answers are generated with the Mac's built-in `say` voice. The clock "drawing" is the app icon
(placeholder). Output goes to data/raw/ (marked demo, so scripts only use it with --demo / it is ignored
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
    "name_1": "an owl", "name_2": "a cactus", "name_3": "um, a deer?",
    "digits_5": "4 9 3 7 1", "digits_6": "8 2 6 9 4 3", "serial3": "47, 44, 40, 37, 34",
    "sentence_1": "The tall man carried a red umbrella to the market on Tuesday.",
    "sentence_2": "Grandma baked bread before the snowstorm arrived.",
    "fluency": "apple, banana, orange, grape, mango, apple, pear, peach, carrot, plum, kiwi",
    "abstract_1": "they are both musical instruments", "abstract_2": "they both have numbers on them",
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
    if st["id"] in answers:
        it.update(audio=say_to_m4a(answers[st["id"]]), audioMime="audio/mp4", recordMs=4000)
    elif st["id"] == "clock":
        it["image"] = "data:image/png;base64," + base64.b64encode((ROOT / "app/icons/icon-512.png").read_bytes()).decode()
    elif st["id"] == "trail":
        it.update(completed=True, errors=1, durationMs=41000, appScore=1)
    elif st["id"] == "letters":
        it.update(hits=10, misses=0, falseAlarms=1, appScore=1)
    items[st["id"]] = it

session = {
    "app": "hosa27", "version": "test", "demo": True, "sessionId": f"DEMO-T99_{int(now.timestamp())}", "code": "T99",
    "order": "app_first", "place": "Test Center", "city": "Alpharetta", "observer": "XX",
    "startedAt": now.isoformat(), "localDate": now.strftime("%Y-%m-%d"), "weekday": now.strftime("%A"),
    "month": now.strftime("%B"), "dayOfMonth": now.day, "year": now.year,
    "steps": [{k: st.get(k) for k in ("id", "type", "domain", "max", "scoredBy", "key")} | {"prompt": st.get("text", "")} for st in steps],
    "items": items, "helpEvents": [], "completed": True,
}
out = ROOT / "data" / "raw" / "hosa27_T99_TEST.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(session))
print("wrote", out)
