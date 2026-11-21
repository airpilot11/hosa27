"""Step 2 - speech-to-text, run locally on this Mac (audio never leaves the computer).

Uses faster-whisper (open-source Whisper). The first run downloads the speech model (~0.5 GB for small.en).
Deliberately gives Whisper NO hint about the correct answers, so transcripts aren't biased toward them.

Output: data/transcripts/<code>.json  and  data/transcripts/transcripts_review.csv

Run:  .venv/bin/python scoring/transcribe.py              (add --force to redo, --model medium.en for higher accuracy)
"""
from __future__ import annotations

import argparse
import json

from common import MEDIA, TRANSCRIPTS, ensure_dirs, write_csv

AUDIO_SUFFIXES = {".m4a", ".webm", ".ogg", ".wav", ".mp4", ".aiff"}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="small.en", help="tiny.en | base.en | small.en (default) | medium.en")
    ap.add_argument("--force", action="store_true", help="re-transcribe participants that already have transcripts")
    args = ap.parse_args()
    ensure_dirs()

    from faster_whisper import WhisperModel  # imported here so --help is fast
    print(f"Loading Whisper model '{args.model}' (first run downloads it)…")
    model = WhisperModel(args.model, device="cpu", compute_type="int8")

    review = []
    for folder in sorted(p for p in MEDIA.iterdir() if p.is_dir()):
        code = folder.name
        out = TRANSCRIPTS / f"{code}.json"
        if out.exists() and not args.force:
            data = json.loads(out.read_text())
            print(f"  - {code}: already transcribed (use --force to redo)")
        else:
            data = {}
            for audio in sorted(p for p in folder.iterdir() if p.suffix.lower() in AUDIO_SUFFIXES):
                segments, _ = model.transcribe(str(audio), language="en", beam_size=5,
                                               condition_on_previous_text=False, vad_filter=False)
                data[audio.stem] = " ".join(seg.text.strip() for seg in segments).strip()
            out.write_text(json.dumps(data, indent=2))
            print(f"  ✓ {code}: {len(data)} recordings transcribed")
        review += [{"code": code, "item_id": k, "transcript": v, "transcript_ok_yes_no": "", "corrected_transcript": ""}
                   for k, v in data.items()]

    write_csv(TRANSCRIPTS / "transcripts_review.csv", review,
              ["code", "item_id", "transcript", "transcript_ok_yes_no", "corrected_transcript"])
    print("\nDone. Optional: spot-check data/transcripts/transcripts_review.csv against the audio.")


if __name__ == "__main__":
    main()
