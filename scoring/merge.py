"""Step 4 - build the final dataset for jamovi / JASP.

Combines app-logic scores, AI scores, the FILLED human scoring sheets, and paper_scores.csv (SLUMS, SUS,
background answers) into:

  data/scores/final_dataset.csv   one row per participant (totals + SLUMS + SUS)  -> correlation, ROC
  data/scores/item_level.csv      one row per participant x item (AI vs human)   -> kappa / ICC / agreement

Run:  .venv/bin/python scoring/merge.py
"""
from __future__ import annotations

from collections import defaultdict
from statistics import mean, pstdev

from common import HUMAN, SCORES, read_csv, write_csv


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


def speed_fluency(fruit: dict, recall: dict, trail_sec: dict) -> dict:
    """Composite that keeps varying when point totals hit the ceiling: mean of z(fruits), z(words recalled), -z(trail time)."""
    zf, zr, zt = zscores(fruit), zscores(recall), zscores(trail_sec)
    out = {}
    for code in set(fruit) | set(recall) | set(trail_sec):
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
    for key, h in human.items():
        code, item = key
        a = ai.get(key, {})
        a_s, h_s = num(a.get("ai_score")), num(h.get("score"))
        item_rows.append({"code": code, "item_id": item, "domain": h["domain"], "max_points": h["max_points"],
                          "ai_score": "" if a_s is None else int(a_s), "human_score": "" if h_s is None else int(h_s),
                          "agree": "" if a_s is None or h_s is None else int(a_s == h_s),
                          "ai_raw_count": a.get("raw_count", ""), "human_raw_count": h.get("raw_count_if_fluency", ""),
                          "ai_flag": a.get("flag", "")})
        for kind, val in (("ai", a_s), ("human", h_s)):
            if val is None:
                missing[code][kind] += 1
            else:
                totals[code][f"app_total_{kind}"] += val
                totals[code][f"{h['domain']}_{kind}"] += val

    # speed & fluency composite (AI and human versions)
    trail_sec = {c: num(m.get("trail_seconds")) for c, m in meta.items()}
    fruit_ai = {c: num(ai.get((c, "fluency"), {}).get("raw_count")) for c in meta}
    fruit_h = {c: num(human.get((c, "fluency"), {}).get("raw_count_if_fluency")) for c in meta}
    recall_ai = {c: num(ai.get((c, "recall"), {}).get("ai_score")) for c in meta}
    recall_h = {c: num(human.get((c, "recall"), {}).get("score")) for c in meta}
    sf_ai, sf_h = speed_fluency(fruit_ai, recall_ai, trail_sec), speed_fluency(fruit_h, recall_h, trail_sec)

    domains = sorted({k.rsplit("_", 1)[0] for t in totals.values() for k in t if not k.startswith("app_total")})
    final = []
    for code, m in sorted(meta.items()):
        t, p = totals[code], paper.get(code, {})
        row = {"code": code, "order": m["order"], "completed": m["completed"], "help_events": m["help_events"],
               "app_total_ai": t.get("app_total_ai", "") if missing[code]["ai"] == 0 else "",
               "app_total_human": t.get("app_total_human", "") if missing[code]["human"] == 0 else "",
               "ai_items_missing": missing[code]["ai"], "human_items_missing": missing[code]["human"]}
        for d in domains:
            row[f"{d}_ai"], row[f"{d}_human"] = t.get(f"{d}_ai", ""), t.get(f"{d}_human", "")
        row.update({"at_ceiling_ai": int(row["app_total_ai"] == 30) if row["app_total_ai"] != "" else "",
                    "fruit_count_ai": fruit_ai.get(code) if fruit_ai.get(code) is not None else "",
                    "fruit_count_human": fruit_h.get(code) if fruit_h.get(code) is not None else "",
                    "speed_fluency_ai": sf_ai.get(code, ""), "speed_fluency_human": sf_h.get(code, "")})
        for k in ("trail_seconds", "trail_errors", "letters_misses", "letters_false_taps", "app_minutes", "replays_total",
                  "slums_status", "slums_minutes", "break_minutes", "corrections_total", "redo_count",
                  "skipped_count", "pauses_total", "mic_check", "retest"):
            row[k] = m.get(k, "")
        row.update({k: v for k, v in p.items() if k != "code"})
        final.append(row)

    fields = list(final[0].keys())
    write_csv(SCORES / "final_dataset.csv", final, fields)
    write_csv(SCORES / "item_level.csv", item_rows,
              ["code", "item_id", "domain", "max_points", "ai_score", "human_score", "agree",
               "ai_raw_count", "human_raw_count", "ai_flag"])
    print(f"Wrote final_dataset.csv ({len(final)} participants) and item_level.csv ({len(item_rows)} rows).")
    print("Totals are left blank for anyone with unscored items - finish those sheets first.")


if __name__ == "__main__":
    main()
