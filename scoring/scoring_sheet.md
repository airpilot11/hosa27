# hosa27 App Scoring Sheet (DRAFT v0.7 (app v0.10.3 items), FREEZE BY DEC 4, 2026)

Human scorers and the AI use this exact sheet. Total = 30 points, in the same 8 areas and with the same point values as the MoCA. Do not change it after real data collection starts.
Record the date you froze it here: ________

## General rules (all spoken items)
- Score only what the participant said in **this** recording. Ignore filler words ("um", "let me think").
- If the participant corrects themselves, score their **final** answer.
- Speech-to-text may contain small errors. Give credit when the intended answer is plainly clear, such as an obvious homophone or misspelling ("rows" = rose, "for" = 4 in a number list). Do **not** guess when unclear: no credit.
- No partial credit unless the item's rule says so.
- Do not use the participant's health, age, education or anything outside the recording.

## Orientation (2 recordings, 1 point per part = 6 points)
Score each part separately and add them.
- **orient_fulldate** (0–4): 1 if the weekday matches exactly + 1 if the month matches exactly + 1 if the day-of-month number matches exactly + 1 if the year matches exactly ("twenty twenty-six" = 2026). Any order is fine.
- **orient_placecity**: 1 if they name the place, accepting a reasonable name for it (e.g., "the senior center", the center's name, or the building's name; naming only the city or "here" = 0 for this part) + 1 if the city matches (with or without the state).
- A part that is not said = 0 for that part. A self-correction counts: score the final answer.

## Executive: trail (2 points, scored automatically by the app)
10 circles, 1-A-2-B-3-C-4-D-5-E (the same length as the MoCA trail). 1 point for tapping all 10 circles in order within 150 s, plus 1 more point if there was **at most 1** wrong tap (one touch-screen slip is allowed). A wrong tap does not move the trail forward, so the participant must find the right circle. (Not on the human sheet.)

## Visuospatial (3 points)
- **copy_box** (1, drawing): the participant copies a transparent 3-D box (two overlapping rectangles joined at their 4 corners). 1 point only if ALL are true:
  - it is a 3-D box: a front face and a back face, each with 4 sides, offset from each other;
  - all 4 connecting edges are drawn, joining matching corners (12 lines in total; no lines missing, no extra lines);
  - edges that are parallel in the model look roughly parallel (small wobbles from finger drawing are fine).
  A flat rectangle or square, a box with missing or extra lines, or corners not joined = 0. Size and position on the screen do not matter.
- **rotate_1, rotate_2** (1 each, scored automatically by the app): 3 choices per puzzle. 1 if the first tap is the shape that is the same as the top shape, just turned; 0 if a flipped (mirror) shape is tapped or there is no answer within 60 s. (Not on the human sheet.)

## Naming (1 recording, 3 pictures, 1 point each = 0–3)
- **naming**: 1. key (also accept "keys"), 2. scissors (also accept "shears"), 3. umbrella. Any order is fine; 1 point for each correct name.
- A general category or description ("something to cut with", "a rain thing", "a tool") = 0.

## Attention (6 points)
- **digits_4** (1): exact sequence **5 8 2 6**, same order, nothing missing or added.
- **digits_5** (1): exact sequence **4 1 7 3 9**, same order, nothing missing or added.
- **letters** (1, scored automatically): tap for every letter A (7 A's among 20 letters). 1 if total errors (missed A's + taps on any other letter) is 1 or fewer, as in the MoCA.
- **serial7** (3): start at 100. The correct answers are 93, 86, 79, 72, 65. Judge **each answer** against the participant's *own previous answer* (subtracting 7 from it), so one mistake doesn't ruin later answers. Count correct subtractions out of their first five answers: **4–5 correct = 3 points, 2–3 = 2, 1 = 1, 0 = 0** (MoCA rule).

## Language (3 points)
- **sentence_1** (1): repeated exactly: "The children played in the park after lunch." Any word left out, added or changed = 0. Ignore minor speech-to-text noise as described in the general rules.
- **sentence_2** (1): repeated exactly: "My sister always brings flowers when she visits." Same rule.
- **fluency** (1): count **valid words starting with the letter P** said in 60 s (also report the count as `raw_count`).
  - Do not count: names of people or places (Peter, Paris), numbers, repeats, or the same word with a different ending ("play", "played", "playing" = 1 word). Words that start with a P sound but not the letter P ("photo", "phone") do not count.
  - **11 or more valid P words = 1 point**, otherwise 0 (MoCA rule).

## Abstraction (2 items, 1 point each)
The participant first hears the example "a hammer and a saw are both tools" (not scored).
- **abstract_1** (car – airplane): 1 for "transportation", "ways to travel", "vehicles", "you ride in both to go places". A single feature or a difference ("both have wheels", "both have engines", "one flies") = 0.
- **abstract_2** (clock – calendar): 1 for "they both tell time", "keep track of time", "measure time", "tell you the date and time". A single feature ("both have numbers", "both hang on the wall") = 0.

## Delayed memory: recall (5 points)
Words (all fruits): **peach, grape, cherry, lemon, mango**. 1 point per word recalled, in any order. Close forms count ("peaches", "grapes", "cherries", "lemons", "mangoes"). Other fruits do not count ("plum" ≠ peach, "lime" ≠ lemon, "raisin" ≠ grape, "apple" = 0). Saying "fruit" without a list word = 0. No hints are given.

## Word counts (0 points, research variables)
For each of these, score = 0 and put the number of the 5 list words (peach, grape, cherry, lemon, mango) said correctly in `raw_count` (0–5), using the same rules as recall:
- **learn_1**: right after hearing the list the first time.
- **learn_2**: right after hearing the list the second time.

## Not scored
welcome, trail_practice, rotate_intro, rotate_practice, end.

## Education adjustment (done by `merge.py`, not by scorers)
As in the MoCA, `merge.py` adds 1 point to the total (up to 30) when the participant has 12 or fewer years of school (`app_total_*_edu_adj`). The unadjusted total is kept as well.
