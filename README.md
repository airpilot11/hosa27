# hosa27: AI Cognitive Self-Check (HOSA Research Poster 2026–27)

This folder has two parts:

| Part | Folder | Runs on | What it does |
|---|---|---|---|
| **Participant app** | `app/` | **iPad** (Safari, added to the Home Screen) | A ~15-minute self-check: speaks every instruction, records spoken answers, has a drawing pad and tap tasks, times every answer, and saves everything on the iPad |
| **Scoring tools** | `scoring/` | **Mac** | Speech-to-text (on this Mac), AI scoring with Claude, blank blind human-scoring sheets, and a final dataset for jamovi/JASP |

`data/` holds participant data. It stays on this Mac and is excluded from GitHub by `.gitignore`.

---

## 1. Try the app on the Mac first

```bash
cd ~/Desktop/hosa27
python3 -m http.server 8027 -d app
```
Open **http://localhost:8027/?demo=1** in Chrome or Safari. Demo mode skips the microphone and marks the data as demo. To test with the microphone, use **http://localhost:8027**.

Change the wording, words, pictures or timing in **`app/tasks.js`** only.

### Researcher mode (fast walkthrough)
Open **http://localhost:8027/?researcher=1**, or tick **🔧 Researcher mode** on the setup screen. The code, place, city and consent are filled in for you. A toolbar appears at the top:

| Button | What it does |
|---|---|
| ◀ Back / Skip ▶ | Go to the previous or next step |
| Step menu | Jump straight to any of the 31 steps (points shown) |
| 🔊 Voice | normal → fast → mute |
| ⏱ Timers | real → short (recordings stop after 4 s, the word-fluency timer after 6 s, the trail after 20 s, shape questions after 8 s) |
| 📋 Saved data | See what has been saved so far (audio length, drawing, automatic scores) |
| ✕ Exit | End the practice run and go back to the staff screen |

Practice runs are marked as practice and the scoring tools ignore them. The microphone is off unless you tick "Also record with the microphone".

### Voice and subtitles
- **Subtitles:** every spoken instruction appears under the question with the current word highlighted as it's spoken. Words, numbers and sentences that participants must **remember or repeat are never shown**; the subtitle says "🔊 Listen carefully…" instead, so the memory tasks stay listening tasks.
- **Why audio files:** the browser's built-in voice can silently fail. This happened in Chrome on the Mac: it accepted the request but never spoke. The app therefore plays a **voice pack** of real audio files through Web Audio, which is reliable on iPad and Mac. If there's no pack and the device voice stalls, the app detects it after 2.5 s, shows a staff warning, and continues with subtitles only.
- A voice pack made with the Mac's **Ava (Enhanced)** voice is included now (one file per sentence, plus one per word or number to remember). The two sentences to repeat are slowed to about 95 words per minute with short pauses between words (`seqRate` in `tasks.js`), because Enhanced voices ignore the speed setting. Re-run the tool after changing any `say` text in `tasks.js`:

### Voice (less robotic)
The app plays a **voice pack** (one audio file per instruction) when there is one. Otherwise it uses the device's built-in voice. A voice pack sounds more natural, and every participant hears the identical recording, which is better standardization for your Methods section.

- **Option A: Mac voice (current).** The pack uses **Ava (Enhanced)** at 135 words per minute, with short pauses at commas, saved at 44.1 kHz / 96 kbps (the old 22 kHz / 35 kbps files sounded muffled). Ava's own quality is limited, so some words can still sound slurred. Rebuild after changing any `say` text:
  ```bash
  python3 tools/make_voice_audio.py
  ```
  To pick the voice and speed yourself: `--voice "Ava (Enhanced)" --rate 125`. To see installed voices: `--list-voices`.
- **Option B: a real person's voice (clearest; recommended for older adults).** One person records every line in **`app/audio/RECORDING_SCRIPT.md`**: one short sentence, word or number per file, so a mistake means re-recording one line. Use Voice Memos in a quiet room, speak slowly and pronounce every consonant, and save each file with the listed name in **`app/audio/own/`**. Then run:
  ```bash
  python3 tools/make_voice_audio.py --own
  ```
  Any line without a recording falls back to the Mac voice, so you can record in batches.
- **Undo:** `python3 tools/make_voice_audio.py --remove` goes back to the built-in voice.
- **Without a pack:** the setup screen has a voice menu. ★ marks natural (Premium/Enhanced) voices installed on that device. On the iPad you can download one under **Settings → Accessibility → Spoken Content → Voices**.

After making or changing a pack, bump `CACHE` in `app/sw.js` and re-upload the app so the iPads get it.

## 2. Put the app on the iPad

An iPad only allows microphone access on a secure (**https**) website, so the app needs to be hosted online. **GitHub Pages** is free.

1. Create a free GitHub account (an adult may need to help).
2. Create a new repository named `hosa27` and upload this folder. Only the code goes up: `data/` is excluded automatically.
3. In the repository, go to **Settings → Pages → Source: "Deploy from a branch" → main → `/ (root)`** and click Save.
4. After about a minute the app is live at **`https://<your-username>.github.io/hosa27/app/`**.

On **each iPad**:

1. Open that link in **Safari** (it must be Safari).
2. Tap **Share (□↑) → Add to Home Screen → Add**. A **hosa27** icon appears.
3. Open hosa27 from the Home Screen. It runs full-screen like a normal app and keeps working without Wi-Fi after the first load.
4. Tap **Test speaker + microphone** and allow microphone access when asked.

**iPad settings for testing days:**
- **Settings → Display & Brightness → Auto-Lock → Never.**
- **Volume up**, and turn on **Do Not Disturb**.
- **Guided Access** keeps participants inside the app: Settings → Accessibility → Guided Access → On, then triple-click the top button while in hosa27 to start or stop it.
- Run one full **demo** session on the actual iPad before the first real session.

**Updating the app later:** change the files, bump `CACHE` in `app/sw.js` (e.g. `hosa27-v0.1.1`) and `HOSA27_VERSION` in `app/tasks.js`, then upload again. **Freeze everything by Dec 4.**

## 3. On a session day (staff)

1. Check eligibility first (age 60+, see the pre-study checklist doc). Fill in the staff setup screen: study code (P01, P02…; the test order is filled in automatically, odd = app first), **age, gender and years of school** (staff ask and type these; the app won't start a real session under 60), place name, city, observer initials, and the consent checkbox.
2. Tap **Start the check**. The app then **guides the whole visit in the right order**:
   - **Odd codes (App → paper SLUMS):** hand the iPad over → participant does the app → at "All done", hold the top-right corner → **2–3 min break screen** → **"Give the paper SLUMS now" screen** with a timer → session saved.
   - **Even codes (Paper SLUMS → app):** **"Give the paper SLUMS now" screen** first (keep the iPad screen-down; tap Start SLUMS timer, then SLUMS finished) → **break screen** → **Start the app** → hand the iPad over.
   - The SLUMS is always on paper. The app only times it and records that it was done (shown in View, the CSV and final_dataset.csv).
3. If you help the participant, tap the faint **"staff"** button (bottom-left) so the help is logged.
4. **Press and hold the top-right corner for 2 seconds** for the staff menu (pause, restart step, end and save). At the "All done" screen, the same hold returns to the staff screen.
5. Everything is saved on the iPad after **every step**, so a crash loses at most one item.
6. At the end of the day: **Saved sessions → Export all → AirDrop to the Mac** (or Save to Files). Put the files in **`hosa27/data/raw/`**.
7. **To see everything that was saved:** go to **Saved sessions** and tap **View** next to a session. It shows every step's status, a playable recording for each spoken answer, the box drawing, automatic scores (trail, shapes, letters), answer timing, replays and staff help. **Summary spreadsheet (CSV)** exports one row per participant × step (no audio) for a quick check in Excel or Google Sheets.
8. Data is stored in the browser's storage on that iPad. Clearing Safari website data or deleting the app icon can erase it, so **export every day**.

Participants never see a score.

### Safeguards against mistakes (built into real sessions)
| Feature | What it prevents |
|---|---|
| **Review screen before starting** | Typos in the code, place or city; wrong visit order (warns if it breaks the odd/even rule); wrong iPad date (the answer key for the date questions); practice mode left on by accident (big PRACTICE / REAL label) |
| **Duplicate-code check** | Two participants with the same code. **Begin** stays disabled until you confirm a deliberate re-test |
| **Microphone check** (3 s live meter) | Silent recordings. Required unless you tap Skip, which is logged |
| **Staff menu** (hold top-right corner 2 s): ▶ Resume · ◀ Previous question · ↺ Redo · Skip ▶ · End | Fixes for interruptions, staff mistakes or technical problems. **Every correction asks for a reason, is logged, and keeps the earlier attempt** (nothing is overwritten) |
| **Memory warning** | Redoing word-list or recall items adds exposure; the app warns you and flags the item |
| **Pause is locked while words or numbers to remember are playing**; a paused question restarts and is flagged | Extra exposure to memory items |
| **Skipped = missing, never 0** | Skipped or missing items are left blank in all scores; a total is only calculated when every item has a score |
| **Quality check before finishing** | Lists missing, skipped, silent or very short answers, unfinished dot task and empty drawing, with a one-tap ↺ Redo |
| **No-speech alert** | After 2 answers in a row with no speech detected, staff get a warning to check the microphone |
| **Resume after crash or reload** | If the app closes mid-visit, the setup screen offers to continue where it stopped (logged; never in demo mode) |
| **Practice mode turns itself off** after each session | Running a real participant as "practice" by mistake |
| **Help button needs a press-and-hold** | Participants logging "staff helped" by accident |
| **Export tracking** | Header shows how many real sessions haven't been exported; each session card shows Exported / Not exported |
| **Typed confirmation to delete a real session** | Accidental deletion |

All corrections appear in **View** (corrections log), the summary CSV and `final_dataset.csv` (corrections_total, redo_count, skipped_count, pauses_total, mic_check, retest). They give you the numbers you need for the Methods section and any decisions about excluding data.

## Item set and research variables (app v0.9.0)

**How every question works (v0.9.0):** the instructions play first (with subtitles), and a **"What to do" panel lists the steps on screen for the whole question** (beside the question in landscape, above it in portrait), so participants never have to memorize instructions. Then a big green **START** button appears, with **Hear the instructions again**. Nothing is played, shown or timed until the participant taps START: the words / numbers / sentence to remember play *after* START, the trail circles and drawing pad unlock, the shape choices appear, the letters begin. Then a chime and **SPEAK NOW** for spoken answers.

No topic labels (e.g. "Memory") are shown to participants. **Same 8 areas and point values as the MoCA, 30 points**, made easier and closer to the MoCA than v0.8 (which had harder items and produced unusually low scores). Items still avoid the paper SLUMS (no clock, animal naming, money math, backward digits, story or SLUMS words).

| Area (points) | Items | MoCA equivalent |
|---|---|---|
| Orientation (6) | day, date, month, year, place, city | same |
| Executive (2) | trail with **10 circles**, 1-A-2-B … 5-E (practice first); 1 pt finished in order + 1 pt if ≤1 wrong tap | same 10-circle trail |
| Visuospatial (3) | copy a 3-D box (1, AI-scored) + 2 shape puzzles with **3 choices** (1 each), after a how-it-works screen and a practice | cube (1) + clock (3; clock is in the SLUMS) |
| Naming (3) | anchor, pineapple, turtle | lion, rhino, camel |
| Attention (6) | **4 and 5** numbers in the same order (1 each), tap for every **A** (no look-alike letters) (1), serial 7s **from 100** (3) | 5 forward + 3 backward, tap for A, serial 7s from 100 |
| Language (3) | two **short 8-word sentences, played slowly** (~95 words/min) (1 each), P words in 1 minute (1; 11+) | 2 sentences, F words (11+) |
| Abstraction (2) | car–airplane, clock–calendar, after the example "an orange and a banana are both fruit" | train–bicycle, watch–ruler, same example |
| Delayed memory (5) | **hand, shirt, school, rose, blue**: one word from each category (body part, clothing, building, flower, color), the categories are named before the list, and the list is **read twice** | face, velvet, church, daisy, red; read twice |

**Education adjustment:** as in the MoCA, `merge.py` adds 1 point (max 30) for 12 or fewer years of school (`app_total_ai_edu_adj`, `app_total_human_edu_adj`). Years of school come from the staff setup screen.

**Research variables (not in the 30):** words said after the 1st and 2nd reading (`learn_words_1`, `learn_words_2`), words said after category hints at the end (`cued_recall_words`, like the MoCA memory index), P-word count, trail time and first-tap time, shape accuracy and time, box drawing time, letter-tap misses, false taps and mean reaction time.

**Timing variables (reaction time):** yes, every item is timed. In the summary CSV, **`reaction_time_seconds`** is one reaction time per item, measured from when the participant could start answering: spoken items = from the chime / SPEAK NOW to the first sound lasting ≥150 ms (approximate in noisy rooms); shapes = choices shown → tap; trail = START → first circle; drawing = START → first line; letters = mean time from each A appearing → tap. **`start_tap_seconds`** = how long after the instructions ended the participant tapped START (readiness). Also saved: `latency_seconds`, `speech_end_seconds`, `response_seconds`, `instruction_seconds`, `total_seconds`. `extract.py` writes one row per item to `item_timing.csv` and adds `speech_latency_mean_s`, `start_tap_mean_s`, `latency_<area>_s` and `time_<area>_s` per participant.

**Demographics:** age, gender and years of school are typed by staff on the setup screen and appear in View, the summary CSV (`age`, `gender`, `education_years`), `session_meta.csv` and `final_dataset.csv`. They are never shown to the participant, on the blind scoring sheets, or sent to the AI.

## 4. Scoring on the Mac (after data collection)

```bash
cd ~/Desktop/hosa27
.venv/bin/python scoring/extract.py       # unpack audio + drawings, automatic scores, timing, blank human sheets
.venv/bin/python scoring/transcribe.py    # speech-to-text on this Mac (first run downloads the model)
.venv/bin/python scoring/score_ai.py --dry-run   # preview one AI request (free)
.venv/bin/python scoring/score_ai.py      # AI scoring with Claude
.venv/bin/python scoring/merge.py         # final_dataset.csv + item_level.csv for jamovi/JASP
```

- **Human scoring (blind):** open `data/human_scoring/<code>_human_scoring.csv`. Listen to each audio file or look at the box drawing in `data/media/<code>/` and enter scores using **`scoring/scoring_sheet.md`**. Each partner scores only participants whose SLUMS they did **not** give. Do this **before** looking at `ai_scores.csv`.
- **Paper data:** enter SLUMS totals, SUS totals and background answers in `data/scores/paper_scores.csv`, including **group** (A = no reported impairment, B = reported MCI / mild dementia), reported_status, who reported it, consent type and site. (Age, gender and years of school come from the app.) Group status lives **only** in this file. It is never on the blind scoring sheets or sent to the AI.
- `final_dataset.csv` also includes the **extra research variables** (see “Item set and research variables” below), a **speed_fluency** composite (P words + words recalled + trail speed, standardized), and **at_ceiling** flags for the ceiling-effect check. Per-item timing is in `data/scores/item_timing.csv`.
- **SUS scoring:** for each item, odd items score (response − 1) and even items score (5 − response). Add them up and multiply by 2.5 to get a 0–100 score.

### AI setup (an adult does this once)
Anthropic API accounts require an adult. Create an account at console.anthropic.com, add a small amount of credit ($10–20 is plenty), create an API key, and then in Terminal:
```bash
export ANTHROPIC_API_KEY="paste-key-here"
```
Never put the key in the app or upload it to GitHub.
- **Model:** `claude-opus-5-5`, fixed in `scoring/score_ai.py`.
- **Server-side refusal fallback:** turned on, so a declined request is retried on Anthropic's recommended model.
- **Resuming:** re-running the script skips items that are already scored.

## Files

```
app/        index.html, styles.css, app.js (logic), tasks.js (EDIT THIS: items/wording), sw.js (offline), manifest + icons
app/images/ optional naming pictures naming1.png, naming2.png, naming3.png (emoji are used until you add them)
app/audio/  voice pack (made by tools/make_voice_audio.py), RECORDING_SCRIPT.md, own/ (your recordings)
scoring/    extract.py, transcribe.py, score_ai.py, merge.py, scoring_sheet.md (FREEZE), requirements.txt
data/       raw/ (iPad exports), media/, transcripts/, scores/, human_scoring/   <- never uploaded
```

Acknowledge AI coding assistance in the poster's Acknowledgements.
