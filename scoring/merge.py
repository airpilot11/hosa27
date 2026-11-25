"""Step 4 - build the final dataset for jamovi / JASP.

Combines app-logic scores, AI scores, the FILLED human scoring sheets, and paper_scores.csv (SLUMS, SUS,
background answers) into:

  data/scores/final_dataset.csv   one row per participant (totals + SLUMS + SUS)  -> correlation, ROC
  data/scores/item_level.csv      one row per participant x item (AI vs human)   -> kappa / ICC / agreement
  (per-item timing is in data/scores/item_timing.csv, written by extract.py)

Run:  .venv/bin/python scoring/merge.py
"""
from __future__ import annotations

from collections import defaultdict
from statistics import mean, pstdev

from common import HUMAN, SCORES, load_sessions, read_csv, scored_steps, write_csv


def fmt(v):
    """Whole-number floats print as integers (17.0 -> 17); everything else unchanged."""
    return int(v) if isinstance(v, float) and v.is_integer() else v


def expected_items(codes, human: dict, ai: dict) -> dict:
    """{code: [(item_id, domain, max_points)]} for every AI/human-scored item, taken from the session itself,
    so an item missing from EITHER the AI file or the human sheet is counted as missing (total left blank)."""
    sessions = {s["code"]: s for s in load_sessions(include_demo=True)}
    out = {}
    for code in codes:
        if code in sessions:
            out[code] = [(st["id"], st["domain"], st["max"]) for st in scored_steps(sessions[code], ("ai_speech", "ai_vision"))]
        else:  # raw export not available - fall back to whatever items either source lists
            seen = {}
            for src in (human, ai):
                for (c, item), r in src.items():
                    if c == code:
                        seen.setdefault(item, (item, r["domain"], r["max_points"]))
            out[code] = list(seen.values())
    return out


def num(v):
    try:
        return float(v) if v not in ("", None) else None
    except ValueError:
        return None


def zscores(values: dict) -> dict:
    """Standardize {code: value} (ignoring blanks) -> {code: z}."""
    vals = {k: v for k, v in values.items() if v is not None}
    if len(vals) < 3 or pstdev(vals.values()) == 0:
        return {}
    m, sd = mean(vals.values()), pstdev(vals.values())
    return {k: (v - m) / sd for k, v in vals.items()}


def speed_fluency(fluency: dict, recall: dict, trail_sec: dict) -> dict:
    """Composite that keeps varying when point totals hit the ceiling: mean of z(P words), z(words recalled), -z(trail time)."""
    zf, zr, zt = zscores(fluency), zscores(recall), zscores(trail_sec)
    out = {}
    for code in set(fluency) | set(recall) | set(trail_sec):
        parts = [p for p in (zf.get(code), zr.get(code), -zt[code] if code in zt else None) if p is not None]
        if len(parts) == 3:
            out[code] = round(mean(parts), 3)
    return out


def main() -> None:
    meta = {r["code"]: r for r in read_csv(SCORES / "session_meta.csv")}
    if not meta:
        print("Run extract.py first."); return
    logic = read_csv(SCORES / "app_logic_scores.csv")
    ai = {(r["code"], r["item_id"]): r for r in read_csv(SCORES / "ai_scores.csv")}
    human = {}
    for sheet in sorted(HUMAN.glob("*_human_scoring.csv")):
        for r in read_csv(sheet):
            human[(r["code"], r["item_id"])] = r
    paper = {r["code"]: r for r in read_csv(SCORES / "paper_scores.csv")}

    item_rows, totals = [], defaultdict(lambda: defaultdict(float))
    missing = defaultdict(lambda: {"ai": 0, "human": 0})
    for r in logic:  # automatic items count the same in both totals; blank (skipped/missing) makes the total blank
        s = num(r["score"])
        for kind in ("ai", "human"):
            if s is None:
                missing[r["code"]][kind] += 1
                continue
            totals[r["code"]][f"app_total_{kind}"] += s
            totals[r["code"]][f"{r['domain']}_{kind}"] += s
    expected = expected_items(meta, human, ai)
    for code, item, domain, max_points in ((c, *it) for c, items in expected.items() for it in items):
        h, a = human.get((code, item), {}), ai.get((code, item), {})
        a_s, h_s = num(a.get("ai_score")), num(h.get("score"))
        item_rows.append({"code": code, "item_id": item, "domain": domain, "max_points": max_points,
                          "ai_score": "" if a_s is None else int(a_s), "human_score": "" if h_s is None else int(h_s),
                          "agree": "" if a_s is None or h_s is None else int(a_s == h_s),
                          "ai_raw_count": a.get("raw_count", ""), "human_raw_count": h.get("raw_count", h.get("raw_count_if_fluency", "")),
                          "ai_flag": a.get("flag", "")})
        for kind, val in (("ai", a_s), ("human", h_s)):
            if val is None:
                missing[code][kind] += 1
            else:
                totals[code][f"app_total_{kind}"] += val
                totals[code][f"{domain}_{kind}"] += val

    # speed & fluency composite (AI and human versions)
    trail_sec = {c: num(m.get("trail_seconds")) for c, m in meta.items()}
    def raw(src, c, item):
        r = src.get((c, item), {})
        return num(r.get("raw_count", r.get("raw_count_if_fluency")))
    flu_ai = {c: raw(ai, c, "fluency") for c in meta}
    flu_h = {c: raw(human, c, "fluency") for c in meta}
    counts = {(c, kind, item): raw(src, c, item) for c in meta for kind, src in (("ai", ai), ("human", human))
              for item in ("learn_1", "learn_2", "recall_cued")}
    recall_ai = {c: num(ai.get((c, "recall"), {}).get("ai_score")) for c in meta}
    recall_h = {c: num(human.get((c, "recall"), {}).get("score")) for c in meta}
    sf_ai, sf_h = speed_fluency(flu_ai, recall_ai, trail_sec), speed_fluency(flu_h, recall_h, trail_sec)

    domains = sorted({k.rsplit("_", 1)[0] for t in totals.values() for k in t if not k.startswith("app_total")})
    final = []
    for code, m in sorted(meta.items()):
        t, p = totals[code], paper.get(code, {})
        row = {"code": code, "age": m.get("age", ""), "gender": m.get("gender", ""),
               "education_years": m.get("education_years", ""), "order": m["order"], "completed": m["completed"], "help_events": m["help_events"],
               "app_total_ai": fmt(t.get("app_total_ai", 0.0)) if missing[code]["ai"] == 0 else "",
               "app_total_human": fmt(t.get("app_total_human", 0.0)) if missing[code]["human"] == 0 else "",
               "ai_items_missing": missing[code]["ai"], "human_items_missing": missing[code]["human"]}
        for d in domains:
            row[f"{d}_ai"], row[f"{d}_human"] = fmt(t.get(f"{d}_ai", "")), fmt(t.get(f"{d}_human", ""))
        row.update({"at_ceiling_ai": int(row["app_total_ai"] == 30) if row["app_total_ai"] != "" else "",
                    "at_ceiling_human": int(row["app_total_human"] == 30) if row["app_total_human"] != "" else "",
                    "fluency_count_ai": fmt(flu_ai.get(code)) if flu_ai.get(code) is not None else "",
                    "fluency_count_human": fmt(flu_h.get(code)) if flu_h.get(code) is not None else "",
                    "speed_fluency_ai": sf_ai.get(code, ""), "speed_fluency_human": sf_h.get(code, "")})
        # MoCA-style education adjustment: +1 point (max 30) for 12 or fewer years of school
        edu = num(m.get("education_years"))
        for kind in ("ai", "human"):
            tot = row[f"app_total_{kind}"]
            row[f"app_total_{kind}_edu_adj"] = "" if tot == "" or edu is None else fmt(min(30, tot + (1 if edu <= 12 else 0)))
        for kind in ("ai", "human"):  # list words said after hearing the list once / twice, and with category hints
            for item, col in (("learn_1", "learn_words_1"), ("learn_2", "learn_words_2"), ("recall_cued", "cued_recall_words")):
                v = counts.get((code, kind, item))
                row[f"{col}_{kind}"] = fmt(v) if v is not None else ""
        timing_keys = [k for k in m if k.startswith(("latency_", "time_", "speech_latency", "start_tap"))]
        for k in ("trail_seconds", "trail_errors", "trail_first_tap_s", "letters_misses", "letters_false_taps",
                  "letters_lure_taps", "letters_mean_rt_ms", "rotate_correct", "rotate_mean_rt_s", "copy_box_draw_s",
                  *timing_keys,
                  "app_minutes", "replays_total",
                  "slums_status", "slums_minutes", "break_minutes", "corrections_total", "redo_count",
                  "skipped_count", "pauses_total", "mic_check", "retest"):
            row[k] = m.get(k, "")
        row.update({k: v for k, v in p.items() if k != "code"})
        final.append(row)

    fields = list(dict.fromkeys(k for r in final for k in r))
    write_csv(SCORES / "final_dataset.csv", final, fields)
    write_csv(SCORES / "item_level.csv", item_rows,
              ["code", "item_id", "domain", "max_points", "ai_score", "human_score", "agree",
               "ai_raw_count", "human_raw_count", "ai_flag"])
    print(f"Wrote final_dataset.csv ({len(final)} participants) and item_level.csv ({len(item_rows)} rows).")
    print("Totals are left blank for anyone with unscored items - finish those sheets first.")


if __name__ == "__main__":
    main()
