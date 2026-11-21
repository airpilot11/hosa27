"""Step 3 - AI scoring with Claude.

Sends each spoken answer (Whisper transcript) or clock drawing (image) to Claude together with the frozen
scoring sheet (scoring/scoring_sheet.md) and saves one score per item to data/scores/ai_scores.csv.

  * Needs an Anthropic API key in the ANTHROPIC_API_KEY environment variable (set up by an adult - see README).
  * Resumable: items already in ai_scores.csv are skipped, so you can stop and re-run safely.
  * --dry-run shows what would be sent without calling the API (no cost).

Run:  .venv/bin/python scoring/score_ai.py --dry-run
      .venv/bin/python scoring/score_ai.py
"""
from __future__ import annotations

import argparse
import base64
import csv
import json
import sys
from pathlib import Path

import anthropic

from common import (MEDIA, SCORES, SCORING_SHEET, TRANSCRIPTS, ensure_dirs, load_sessions, read_csv,
                    resolve_key, scored_steps)

MODEL = "claude-opus-5-5"
FIELDS = ["code", "item_id", "domain", "max_points", "ai_score", "raw_count", "credited", "rationale",
          "input_used", "model", "request_id", "flag"]

SCHEMA = {
    "type": "object",
    "properties": {
        "score": {"type": "integer", "description": "points awarded for this item"},
        "raw_count": {"type": "integer", "description": "fluency only: number of valid unique fruits; otherwise 0"},
        "credited": {"type": "array", "items": {"type": "string"}, "description": "answers/criteria that earned credit"},
        "rationale": {"type": "string", "description": "one or two sentences citing the scoring-sheet rule applied"},
    },
    "required": ["score", "raw_count", "credited", "rationale"],
    "additionalProperties": False,
}

SYSTEM_INTRO = (
    "You are a careful research scorer for a student study of a cognitive self-check app. "
    "Score exactly one item at a time using ONLY the scoring sheet below - the same rules the human scorers use. "
    "Do not guess about the participant's health and do not give any diagnosis. "
    "Return the score as JSON matching the requested schema.\n\n"
)


def build_content(step: dict, session: dict, transcript: str | None, image_path) -> list[dict]:
    header = (f"ITEM: {step['id']}  (domain: {step['domain']}, max points: {step['max']})\n"
              f"Question shown/spoken to participant: {step.get('prompt', '').replace(chr(10), ' ')}\n"
              f"Answer key: {resolve_key(step, session)}\n"
              f"Session date: {session.get('weekday')}, {session.get('month')} {session.get('dayOfMonth')}, {session.get('year')}\n")
    if image_path is not None:
        data = base64.standard_b64encode(image_path.read_bytes()).decode()
        return [{"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": data}},
                {"type": "text", "text": header + "The image above is the participant's clock drawing. Score it."}]
    return [{"type": "text", "text": header + f'Automatic speech-to-text transcript of the participant\'s answer:\n"""{transcript}"""\nScore it.'}]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="print the first request instead of calling the API")
    ap.add_argument("--only", help="score a single participant code, e.g. P01")
    ap.add_argument("--use-corrected", action="store_true",
                    help="use human-corrected transcripts from transcripts_review.csv when present (secondary analysis)")
    ap.add_argument("--demo", action="store_true", help="include demo/test sessions")
    ap.add_argument("--out", default=str(SCORES / "ai_scores.csv"))
    args = ap.parse_args()
    ensure_dirs()

    sheet = SCORING_SHEET.read_text()
    system = [{"type": "text", "text": SYSTEM_INTRO + sheet, "cache_control": {"type": "ephemeral"}}]

    corrected = {}
    if args.use_corrected:
        for r in read_csv(TRANSCRIPTS / "transcripts_review.csv"):
            if r.get("corrected_transcript", "").strip():
                corrected[(r["code"], r["item_id"])] = r["corrected_transcript"].strip()

    out_path = Path(args.out)
    done = {(r["code"], r["item_id"]) for r in read_csv(out_path)}
    new_file = not out_path.exists()
    client = None if args.dry_run else anthropic.Anthropic()

    with out_path.open("a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        if new_file:
            w.writeheader()
        for s in load_sessions(include_demo=args.demo):
            code = s["code"]
            if args.only and code != args.only:
                continue
            tpath = TRANSCRIPTS / f"{code}.json"
            transcripts = json.loads(tpath.read_text()) if tpath.exists() else {}
            for st in scored_steps(s, ("ai_speech", "ai_vision")):
                if (code, st["id"]) in done:
                    continue
                row = {"code": code, "item_id": st["id"], "domain": st["domain"], "max_points": st["max"],
                       "model": MODEL, "flag": ""}
                image_path, transcript = None, None
                if st["scoredBy"] == "ai_vision":
                    image_path = MEDIA / code / f"{st['id']}.png"
                    if not image_path.exists():
                        row.update(ai_score="", rationale="no drawing saved (skipped or missing) - counted as missing, not 0", input_used="none", flag="MISSING_INPUT")
                        w.writerow(row); continue
                    row["input_used"] = "image"
                else:
                    transcript = corrected.get((code, st["id"]), transcripts.get(st["id"]))
                    if transcript is None:
                        row.update(ai_score="", rationale="no recording/transcript (skipped, missing, or run transcribe.py) - counted as missing, not 0", input_used="none", flag="MISSING_INPUT")
                        w.writerow(row); continue
                    row["input_used"] = "corrected_transcript" if (code, st["id"]) in corrected else "whisper_transcript"
                    if not transcript.strip():
                        row.update(ai_score=0, raw_count=0, rationale="empty transcript (no speech detected)", flag="EMPTY")
                        w.writerow(row); continue

                content = build_content(st, s, transcript, image_path)
                if args.dry_run:
                    preview = [c if c["type"] == "text" else {"type": "image", "source": "<png omitted>"} for c in content]
                    print(json.dumps({"model": MODEL, "system": "<scoring sheet, %d chars>" % len(sheet),
                                      "messages": [{"role": "user", "content": preview}]}, indent=2))
                    print("\n(dry run - nothing sent; remove --dry-run to score for real)")
                    return

                try:
                    resp = client.beta.messages.create(
                        model=MODEL,
                        max_tokens=16000,
                        betas=["server-side-fallback-2026-07-01"],
                        fallbacks="default",  # if the request is declined, the API retries on a recommended model
                        system=system,
                        output_config={"effort": "medium", "format": {"type": "json_schema", "schema": SCHEMA}},
                        messages=[{"role": "user", "content": content}],
                    )
                except anthropic.AuthenticationError:
                    sys.exit("API key missing or invalid - set ANTHROPIC_API_KEY (see README).")
                except anthropic.RateLimitError:
                    sys.exit("Rate limited - wait a minute and re-run (finished items are kept).")
                except anthropic.APIStatusError as e:
                    print(f"  ! {code} {st['id']}: API error {e.status_code}: {e.message}"); continue
                except anthropic.APIConnectionError:
                    sys.exit("Network error - check the internet connection and re-run.")

                row["request_id"] = resp._request_id
                row["model"] = resp.model
                if resp.stop_reason == "refusal":
                    row.update(ai_score="", rationale="model declined", flag="REFUSAL")
                    w.writerow(row); f.flush(); continue
                text = next((b.text for b in resp.content if b.type == "text"), "{}")
                result = json.loads(text)
                score = max(0, min(int(result["score"]), int(st["max"])))
                row.update(ai_score=score, raw_count=result.get("raw_count", 0),
                           credited="; ".join(result.get("credited", [])), rationale=result.get("rationale", ""))
                if score != result["score"]:
                    row["flag"] = "CLAMPED"
                w.writerow(row); f.flush()
                print(f"  ✓ {code} {st['id']}: {score}/{st['max']}")

    print(f"\nDone. Scores in {out_path}")


if __name__ == "__main__":
    main()
