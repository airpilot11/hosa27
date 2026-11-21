"""Shared helpers for the hosa27 scoring pipeline."""
from __future__ import annotations

import base64
import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
RAW = DATA / "raw"                      # exported JSON files from the iPad go here
MEDIA = DATA / "media"                  # extracted audio + clock images (per participant)
TRANSCRIPTS = DATA / "transcripts"      # speech-to-text output
SCORES = DATA / "scores"                # AI + app-logic scores, merged dataset
HUMAN = DATA / "human_scoring"          # blank sheets for blind human scorers
SCORING_SHEET = Path(__file__).resolve().parent / "scoring_sheet.md"

AUDIO_EXT = {"audio/mp4": ".m4a", "audio/webm": ".webm", "audio/ogg": ".ogg", "audio/wav": ".wav"}


def ensure_dirs() -> None:
    for d in (RAW, MEDIA, TRANSCRIPTS, SCORES, HUMAN):
        d.mkdir(parents=True, exist_ok=True)


def load_sessions(include_demo: bool = False) -> list[dict]:
    """Load exported sessions. If a code appears more than once, keep the latest *completed* one."""
    by_code: dict[str, dict] = {}
    for f in sorted(RAW.glob("*.json")):
        try:
            s = json.loads(f.read_text())
        except json.JSONDecodeError:
            print(f"  ! skipping unreadable file {f.name}", file=sys.stderr)
            continue
        if s.get("app") != "hosa27":
            continue
        if s.get("demo") and not include_demo:
            continue
        code = s["code"]
        prev = by_code.get(code)
        if prev is None or (s.get("completed"), s["startedAt"]) > (prev.get("completed"), prev["startedAt"]):
            if prev is not None:
                print(f"  ! {code}: more than one session found - using the one from {s['startedAt']}", file=sys.stderr)
            by_code[code] = s
    return [by_code[c] for c in sorted(by_code)]


def resolve_key(step: dict, session: dict) -> str:
    """Fill orientation answer keys ({weekday}, {city}...) from the session's own date and setup info."""
    key = step.get("key") or ""
    return (key.replace("{weekday}", session.get("weekday", ""))
               .replace("{day_of_month}", str(session.get("dayOfMonth", "")))
               .replace("{month}", session.get("month", ""))
               .replace("{year}", str(session.get("year", "")))
               .replace("{place}", session.get("place", ""))
               .replace("{city}", session.get("city", "")))


def audio_ext(mime: str | None) -> str:
    base = (mime or "audio/mp4").split(";")[0].strip()
    return AUDIO_EXT.get(base, ".m4a")


def decode_data_url(data_url: str) -> bytes:
    return base64.b64decode(data_url.split(",", 1)[1])


def scored_steps(session: dict, kinds: tuple[str, ...]) -> list[dict]:
    return [st for st in session["steps"] if st.get("scoredBy") in kinds and st.get("max", 0) > 0]


def write_csv(path: Path, rows: list[dict], fields: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def read_csv(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(newline="") as f:
        return list(csv.DictReader(f))
