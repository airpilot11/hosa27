# hosa27 App Scoring Sheet (DRAFT v0.1, FREEZE BY DEC 4, 2026)

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
1 point for completing all 10 circles in order within 120 s, plus 1 more point if there were zero wrong taps. (Not on the human sheet.)

## Visuospatial: clock drawing (3 points)
Published 3-point clock convention: contour, numbers, hands. Target time: **8:20 (twenty past eight)**.
- **Contour (1)**: a clock face is drawn as a circle or close to one (minor imperfections OK; a square = 0).
- **Numbers (1)**: all 12 numbers 1–12 are present, with none extra or repeated, in the correct order, and placed roughly in the correct positions around the face (they may be inside or just outside the circle).
- **Hands (1)**: two hands, joined at or near the center. One clearly indicates the 8 (the hour hand may be at or just past 8). The other points to the 4 (twenty minutes). The hour hand should be shorter than the minute hand; if the hand lengths look equal but both positions are correct, give credit.
Score = sum (0–3).

## Naming (3 items, 1 point each)
- **name_1**: owl. **name_2**: cactus (accept "cacti"). **name_3**: kangaroo.
- A general category ("a bird", "a plant", "an animal") = 0.

## Attention
- **digits_5** (1): exact sequence **4 9 3 7 1**, same order, nothing missing or added.
- **digits_6** (1): exact sequence **8 2 6 4 9 3**, same order, nothing missing or added.
- **letters** (1, scored automatically): 1 if total errors (missed M's + taps on other letters) is 1 or fewer.
- **serial3** (3): the correct answers are 47, 44, 41, 38, 35. Judge **each answer** against the participant's *own previous answer* (subtracting 3 from it), so one mistake doesn't ruin later answers. Count correct subtractions out of their first five answers: **4–5 correct = 3 points, 2–3 = 2, 1 = 1, 0 = 0.**

## Language
- **sentence_1** (1): repeated exactly: "The tall man carried a red umbrella to the market on Tuesday." Any word left out, added or changed = 0. Ignore minor speech-to-text noise as described in the general rules.
- **sentence_2** (1): repeated exactly: "Grandma baked three loaves of bread before the snowstorm arrived." Same rule.
- **fluency** (1): count **unique fruits** named in 60 s (also report the count as `raw_count`).
  - Do not count repeats, non-fruits (vegetables, nuts, desserts), or variants of the same fruit ("green apple" after "apple").
  - Tomato, avocado and olive **count** as fruits. Juice or dessert names ("apple pie") do not.
  - **10 or more unique fruits = 1 point**, otherwise 0.

## Abstraction (2 items, 1 point each)
- **abstract_1** (piano – drum): 1 for "musical instruments", "you play music on them", or "instruments". Answers about shape, sound volume or a single feature only ("both make noise", "both have keys") = 0.
- **abstract_2** (ruler – thermometer): 1 for "measuring tools" or "they measure things". "Both have numbers" or "both are long" = 0.

## Delayed memory: recall (5 points)
Words: **river, candle, jacket, garden, violin**. 1 point per word recalled without cues, in any order. Close forms count ("rivers", "candles"). Different words with similar meaning do not ("coat" ≠ jacket, "fiddle" ≠ violin).

## Not scored
welcome, learn_1, learn_2 (learning trials), trail_practice, end.
