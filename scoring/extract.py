"""Step 1 - unpack exported iPad sessions.

  * saves each spoken answer (audio) and the box drawing (PNG) into data/media/<code>/
  * computes the automatic app-logic scores (trail, shape turning, letter tap) -> data/scores/app_logic_scores.csv
  * writes per-item timing (answer latency, response time)        -> data/scores/item_timing.csv
  * writes one BLANK, BLIND human scoring sheet per participant  -> data/human_scoring/<code>_human_scoring.csv
  * creates data/scores/paper_scores.csv (template for SLUMS, SUS and background answers) if it doesn't exist

Run:  .venv/bin/python scoring/extract.py          (add --demo to include demo sessions)
"""
from __future__ import annotations

import argparse
from datetime import datetime

from statistics import mean

from common import (HUMAN, MEDIA, SCORES, ai_steps, audio_ext, decode_data_url, domain_slug, ensure_dirs,
                    load_sessions, read_csv, resolve_key, scored_steps, write_csv)


def sec(ms):
    return round(ms / 1000, 2) if isinstance(ms, (int, float)) else ""


def response_ms(it: dict):
    """How long the participant took to respond on this item (instructions not included)."""
    for k in ("responseMs", "rtMs", "drawMs"):
        if isinstance(it.get(k), (int, float)):
            return it[k]
    if it.get("type") == "trail" and it.get("completed"):
        return it.get("durationMs")
    return None

# Paper data entered by hand. `group` = A (no reported impairment) or B (reported MCI / mild dementia).
# Group status is kept ONLY here - never on the blind human scoring sheets or in the AI prompts.
# Age, gender and years of school are typed into the app by staff (session file), so they are not repeated here.
PAPER_FIELDS = ["code", "group", "reported_status", "status_reported_by", "diagnosis_year", "consent_type", "site",
                "tech_comfort_1to5", "prior_memory_check_yes_no",
                "physical_activity_yes_no", "activity_minutes_per_week", "chair_yoga_yes_no",
                "slums_total", "slums_given_by", "sus_total", "notes"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--demo", action="store_true", help="include demo sessions")
    args = ap.parse_args()
    ensure_dirs()

    sessions = load_sessions(include_demo=args.demo)
    if not sessions:
        print("No sessions found. Put the exported hosa27_*.json files in data/raw/ first.")
        return

    meta_rows, logic_rows, timing_rows = [], [], []
    for s in sessions:
        code = s["code"]
        out = MEDIA / code
        out.mkdir(parents=True, exist_ok=True)
        items = s.get("items", {})

        # media files
        for item_id, it in items.items():
            if it.get("audio"):
                (out / f"{item_id}{audio_ext(it.get('audioMime'))}").write_bytes(decode_data_url(it["audio"]))
            if it.get("image"):
                (out / f"{item_id}.png").write_bytes(decode_data_url(it["image"]))

        # automatic (app-logic) scores
        for st in scored_steps(s, ("app_logic",)):
            it = items.get(st["id"], {})
            if st["id"].startswith("trail"):
                detail = f"completed={it.get('completed')}; errors={it.get('errors')}; seconds={round((it.get('durationMs') or 0) / 1000, 1)}"
            elif st.get("type") == "rotate" or st["id"].startswith("rotate"):
                detail = f"choice={it.get('choice')}; correct={it.get('correct')}; seconds={sec(it.get('rtMs'))}"
            else:
                detail = f"hits={it.get('hits')}; misses={it.get('misses')}; false_alarms={it.get('falseAlarms')}"
            missing = (not it) or it.get("skipped") or it.get("appScore") is None
            logic_rows.append({"code": code, "item_id": st["id"], "domain": st["domain"], "max_points": st["max"],
                               "score": "" if missing else it["appScore"],   # missing/skipped = blank, never 0
                               "details": ("SKIPPED: " + it.get("skipReason", "")) if it.get("skipped") else (detail if it else "item missing")})

        # blind human scoring sheet (AI-scored items only; no AI or SLUMS scores shown)
        human_rows = []
        for st in ai_steps(s):
            it = items.get(st["id"], {})
            media = f"{st['id']}{audio_ext(it.get('audioMime'))}" if st["scoredBy"] == "ai_speech" else f"{st['id']}.png"
            has_media = bool(it.get("audio") or it.get("image"))
            human_rows.append({"code": code, "item_id": st["id"], "domain": st["domain"], "max_points": st["max"],
                               "media_file": f"data/media/{code}/{media}" if has_media else "NO MEDIA (skipped/missing) - leave score blank",
                               "item_flags": "; ".join(it.get("flags", [])) if it else "",
                               "answer_key": resolve_key(st, s), "score": "", "raw_count": "",
                               "scorer_initials": "", "notes": ""})
        sheet = HUMAN / f"{code}_human_scoring.csv"
        if sheet.exists():
            print(f"  - {sheet.name} already exists (not overwritten)")
        else:
            write_csv(sheet, human_rows, list(human_rows[0].keys()) if human_rows else ["code"])

        # per-item timing + per-domain totals (latency = "Your turn" -> first speech; response = time to answer)
        by_domain_resp, by_domain_lat, speech_lat = {}, {}, []
        for st in s["steps"]:
            it = items.get(st["id"])
            if not it or it.get("skipped") or st.get("type") in ("intro", "end"):
                continue
            r = response_ms(it)
            timing_rows.append({"code": code, "item_id": st["id"], "domain": st.get("domain"), "type": st.get("type"),
                                "practice": "yes" if st["id"].endswith("practice") else "",
                                "latency_s": sec(it.get("latencyMs")), "speech_end_s": sec(it.get("speechEndMs")),
                                "response_s": sec(r), "start_tap_s": sec(it.get("startTapMs")),
                                "instruction_s": sec(it.get("instructionMs")),
                                "total_s": sec(it.get("totalMs")), "replays": it.get("replays", 0)})
            if st["id"].endswith("practice") or not st.get("domain"):
                continue
            d = domain_slug(st["domain"])
            if r is not None and st.get("type") != "vigilance":
                by_domain_resp[d] = by_domain_resp.get(d, 0) + r
            if st.get("type") == "speak" and isinstance(it.get("latencyMs"), (int, float)) and not st.get("countdown"):
                by_domain_lat.setdefault(d, []).append(it["latencyMs"])
                speech_lat.append(it["latencyMs"])
        start_taps = [it["startTapMs"] for st in s["steps"] if (it := items.get(st["id"])) and not it.get("skipped")
                      and not st["id"].endswith("practice") and isinstance(it.get("startTapMs"), (int, float))]
        rot = [items.get(k, {}) for k in ("rotate_1", "rotate_2") if items.get(k) and not items[k].get("skipped")]
        rot_rt = [x["rtMs"] for x in rot if isinstance(x.get("rtMs"), (int, float))]
        trail, letters = items.get("trail", {}), items.get("letters", {})
        minutes = ""
        if s.get("completedAt"):
            t0, t1 = (datetime.fromisoformat(x.replace("Z", "+00:00")) for x in (s["startedAt"], s["completedAt"]))
            minutes = round((t1 - t0).total_seconds() / 60, 1)
        meta_rows.append({"code": code, "age": s.get("age", ""), "gender": s.get("gender") or "",
                          "education_years": s.get("educationYears", ""),
                          "order": s.get("order"), "local_date": s.get("localDate"),
                          "trail_seconds": round(trail["durationMs"] / 1000, 1) if trail.get("completed") and trail.get("durationMs") else "",
                          "trail_errors": trail.get("errors", ""), "letters_misses": letters.get("misses", ""),
                          "letters_false_taps": letters.get("falseAlarms", ""),
                          "letters_lure_taps": letters.get("lureTaps", ""), "letters_mean_rt_ms": letters.get("meanHitRtMs", "") or "",
                          "trail_first_tap_s": sec(trail.get("firstTapMs")),
                          "rotate_correct": sum(1 for x in rot if x.get("correct")) if len(rot) == 2 else "",
                          "rotate_mean_rt_s": sec(mean(rot_rt)) if rot_rt else "",
                          "copy_box_draw_s": sec(items.get("copy_box", {}).get("drawMs")),
                          "speech_latency_mean_s": sec(mean(speech_lat)) if speech_lat else "",
                          "start_tap_mean_s": sec(mean(start_taps)) if start_taps else "",
                          **{f"latency_{d}_s": sec(mean(v)) for d, v in sorted(by_domain_lat.items())},
                          **{f"time_{d}_s": sec(v) for d, v in sorted(by_domain_resp.items())},
                          "app_minutes": minutes,
                          "replays_total": sum(int(i.get("replays") or 0) for i in items.values()),
                          "corrections_total": len(s.get("corrections", [])),
                          "redo_count": sum(1 for c in s.get("corrections", []) if c["type"].startswith("redo") or c["type"] == "back"),
                          "skipped_count": sum(1 for i in items.values() if i.get("skipped")),
                          "pauses_total": len(s.get("pauses", [])),
                          "mic_check": ("not_needed" if (s.get("micCheck") or {}).get("notNeeded") else "passed" if (s.get("micCheck") or {}).get("passed")
                                        else "skipped" if (s.get("micCheck") or {}).get("skipped") else "failed_or_missing"),
                          "retest": bool(s.get("retest")),
                          "slums_status": (s.get("slums") or {}).get("status", "not_recorded"),
                          "slums_minutes": (s.get("slums") or {}).get("minutes", ""),
                          "break_minutes": s.get("breakMinutes", ""),
                          "completed": s.get("completed"), "ended_early_at": s.get("endedEarlyAt", ""),
                          "help_events": len(s.get("helpEvents", [])), "observer": s.get("observer"),
                          "place": s.get("place"), "city": s.get("city"), "app_version": s.get("version")})
        print(f"  ✓ {code}: {len(items)} items extracted")

    meta_fields = list(dict.fromkeys(k for r in meta_rows for k in r))  # domains can differ between versions
    write_csv(SCORES / "session_meta.csv", meta_rows, meta_fields)
    write_csv(SCORES / "item_timing.csv", timing_rows,
              ["code", "item_id", "domain", "type", "practice", "latency_s", "speech_end_s", "response_s",
               "start_tap_s", "instruction_s", "total_s", "replays"])
    write_csv(SCORES / "app_logic_scores.csv", logic_rows, ["code", "item_id", "domain", "max_points", "score", "details"])

    paper = SCORES / "paper_scores.csv"
    existing = {r["code"] for r in read_csv(paper)}
    rows = read_csv(paper) + [{"code": s["code"]} for s in sessions if s["code"] not in existing]
    write_csv(paper, sorted(rows, key=lambda r: r["code"]), PAPER_FIELDS)
    print(f"\nDone. {len(sessions)} participants. Fill in data/scores/paper_scores.csv with SLUMS/SUS/background answers.")


if __name__ == "__main__":
    main()
