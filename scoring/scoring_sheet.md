# hosa27 App Scoring Sheet (DRAFT v0.2 (app v0.7.0 items), FREEZE BY DEC 4, 2026)

Human scorers and the AI use this exact sheet. Total = 30 points. Do not change it after real data collection starts.
Record the date you froze it here: ________

## General rules (all spoken items)
- Score only what the participant said in **this** recording. Ignore filler words ("um", "let me think").
- If the participant corrects themselves, score their **final** answer.
- Speech-to-text may contain small errors. Give credit when the intended answer is plainly clear, such as an obvious homophone or mis-spelling ("violen" = violin, "for" = 4 in a number list). Do **not** guess when unclear: no credit.
- No partial credit unless the item's rule says so.
- Do not use the participant's health, age or anything outside the recording.

## Orientation (6 items, 1 point each)
The answer key is filled in from the session date and the place and city the staff entered.
- **orient_day**: 1 if the weekday matches exactly.
- **orient_date**: 1 if the day-of-month number matches exactly. Saying the full date is fine if the number is correct.
- **orient_month**: 1 if the month matches exactly.
- **orient_year**: 1 if the year matches exactly ("twenty twenty-six" = 2026).
- **orient_place**: 1 if they name the place, accepting a reasonable name for it (e.g., "the senior center", the center's name, or the building's name). Naming only the city or "here" = 0.
- **orient_city**: 1 if the city matches. Accept the correct city with or without the state.

## Executive: trail (2 points, scored automatically by the app)
1 point for completing all 12 circles (1-A-2-B-3-C-4-D-5-E-6-F) in order within 150 s, plus 1 more point if there were zero wrong taps. (Not on the human sheet.)

## Visuospatial (3 points)
- **copy_box** (1, drawing): the participant copies a transparent 3-D box (two overlapping rectangles joined at their 4 corners). 1 point only if ALL are true:
  - it is a 3-D box: a front face and a back face, each with 4 sides, offset from each other;
  - all 4 connecting edges are drawn, joining matching corners (12 lines in total; no lines missing, no extra lines);
  - edges that are parallel in the model look roughly parallel (small wobbles from finger drawing are fine).
  A flat rectangle or square, a box with missing or extra lines, or corners not joined = 0. Size and position on the screen do not matter.
- **rotate_1, rotate_2** (1 each, scored automatically by the app): 1 if the first tap is the shape that is the same as the target, just turned; 0 if a flipped (mirror) shape is tapped or no answer within 60 s. (Not on the human sheet.)

## Naming (3 items, 1 point each)
- **name_1**: hourglass (also accept "sand timer", "egg timer", "sand glass").
- **name_2**: accordion (also accept "concertina", "squeezebox").
- **name_3**: peacock (also accept "peafowl", "peahen").
- A general category or description ("a timer", "an instrument", "a bird", "a fancy bird") = 0.

## Attention
- **digits_6** (1): exact sequence **7 2 8 5 1 6**, same order, nothing missing or added.
- **digits_7** (1): exact sequence **3 9 4 1 8 6 2**, same order, nothing missing or added.
- **letters** (1, scored automatically): 1 if total errors (missed M's + taps on any other letter) is 1 or fewer.
- **serial7** (3): the correct answers are 73, 66, 59, 52, 45. Judge **each answer** against the participant's *own previous answer* (subtracting 7 from it), so one mistake doesn't ruin later answers. Count correct subtractions out of their first five answers: **4–5 correct = 3 points, 2–3 = 2, 1 = 1, 0 = 0.**

## Language
- **sentence_1** (1): repeated exactly: "The woman who lives next to the bakery walks her two dogs every evening." Any word left out, added or changed = 0. Ignore minor speech-to-text noise as described in the general rules.
- **sentence_2** (1): repeated exactly: "Before the storm arrived, the farmer locked the barn and counted all of his sheep." Same rule.
- **fluency** (1): count **valid words starting with the letter P** said in 60 s (also report the count as `raw_count`).
  - Do not count: names of people or places (Peter, Paris), numbers, repeats, or the same word with a different ending ("play", "played", "playing" = 1 word). Words that start with a P sound but not the letter P ("photo", "phone") do not count.
  - **11 or more valid P words = 1 point**, otherwise 0.

## Abstraction (2 items, 1 point each)
- **abstract_1** (newspaper – radio): 1 for "they give you the news", "sources of information", "ways of communicating", "media". Answers about a single feature or how they differ ("both have words", "you can hold them", "one is paper") = 0.
- **abstract_2** (poem – painting): 1 for "they are both art", "works of art", "creative works", "ways to express feelings". "Both are made by people", "both are beautiful" or a single feature ("both have colors") = 0.

## Delayed memory: recall (5 points)
Words: **river, candle, jacket, garden, violin**. 1 point per word recalled without cues, in any order. Close forms count ("rivers", "candles"). Different words with similar meaning do not ("coat" ≠ jacket, "fiddle" ≠ violin).

## Word counts (0 points, research variables)
- **learn_1, learn_2**: score = 0. Put the number of the 5 list words (river, candle, jacket, garden, violin) said correctly in `raw_count` (0–5), using the same rules as recall.

## Not scored
welcome, trail_practice, rotate_practice, recognize (scored by the app as a research variable, not part of the 30), end.
