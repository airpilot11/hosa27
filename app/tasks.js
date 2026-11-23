// =====================================================================
// hosa27 - task configuration
// ---------------------------------------------------------------------
// Edit wording, words, pictures and timing HERE (not in app.js).
// FREEZE this file by Dec 4, 2026 - do not change it once real data
// collection starts. The version number is saved into every session.
// =====================================================================

const HOSA27_VERSION = "0.8.0";

// What participants see (header, welcome screen, footer). Edit freely.
const STUDY = {
  appName: "Brain Health Check",
  tagline: "A short check of memory and thinking",
  footer: "Student research study (HOSA) · This is not a medical test and does not give a diagnosis",
  minutes: 10,
};

// (Domain names are NOT shown to participants - labels like "Memory" can change how people answer.)

// Recorded voice pack. These are filled in automatically by app/audio/audio_manifest.js,
// which tools/make_voice_audio.py creates (natural Mac voice OR your own recordings).
// Any step without a recording is read aloud by the iPad's built-in voice.
const RECORDED_AUDIO = {};   // step id -> { src, includesSequence }
const LETTER_AUDIO = {};     // (unused since v0.6.0: the letter task is shown on screen, not spoken)
const AUDIO_PACK_INFO = {};  // which voice made the pack, and when

// Speech settings for the built-in voice.
const VOICE = {
  preferredNames: ["Samantha", "Karen", "Daniel", "Google US English"],
  lang: "en-US",
  rate: 0.72,          // slow, calm pace (1 = normal)
  sentencePauseMs: 600, // silence between sentences of an instruction
};

// ---------------------------------------------------------------------
// v0.7.0 item set. Same 8 thinking-skill areas as the MoCA, 30 points total, but every
// item is ORIGINAL and none repeats the paper SLUMS (no animal naming, no clock, no money
// math, no backward digits, no story, no SLUMS words). Items are harder / more graded than
// v0.6 so healthy older adults don't all score 28-30.
// ---------------------------------------------------------------------

// 5-word list (not the SLUMS or MoCA words). Heard once, recalled at the end.
const WORDS = ["river", "candle", "jacket", "garden", "violin"];

// Letter-tap (visual vigilance): target M (8 targets) among letters, including look-alikes N and W.
const LETTERS = ["T","M","N","R","M","W","B","M","N","S","M","H",
                 "W","M","K","N","M","P","W","M","D","N","M","L"];

// Trail positions are percentages of the tap area (x, y).
const TRAIL_PRACTICE = [
  { label: "1", x: 22, y: 30 }, { label: "A", x: 72, y: 24 },
  { label: "2", x: 36, y: 72 }, { label: "B", x: 80, y: 70 },
];
// 12 circles (1-6, A-F) in 3 rows of 4; the middle row is shifted so no two circles crowd on any iPad screen.
const TRAIL_MAIN = [
  { label: "1", x: 32, y: 50 }, { label: "A", x: 12, y: 8 },  { label: "2", x: 64, y: 8 },
  { label: "B", x: 58, y: 50 }, { label: "3", x: 90, y: 92 }, { label: "C", x: 38, y: 92 },
  { label: "4", x: 6,  y: 50 }, { label: "D", x: 38, y: 8 },  { label: "5", x: 90, y: 8 },
  { label: "E", x: 84, y: 50 }, { label: "6", x: 64, y: 92 }, { label: "F", x: 12, y: 92 },
];

// Shape-turning (mental rotation): blocks of a shape as [column, row]. The top shape is shown upright;
// each choice is the shape turned by `rot` degrees, and `mirror: true` means flipped (= NOT the same shape).
// Exactly one choice per trial has mirror: false - that is the correct answer.
const SHAPES = {
  L: [[0, 0], [0, 1], [0, 2], [1, 2]],              // practice
  P: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]],
  F: [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]],
};

// ---------------------------------------------------------------------
// STEPS run in this order. Fields:
//   type      intro | speak | trail | draw | rotate_intro | rotate | vigilance | end
//   domain    MoCA thinking-skill area (for analysis)
//   max       points for this item (0 = not in the 30-point total)
//   scoredBy  ai_speech | ai_vision | app_logic | none
//   countOnly AI/human scorers still count words (raw_count) for a research variable, 0 points
//   say       spoken instruction;  text = what is shown on screen
//   sequence  items read one at a time after `say` (words, digits...)
//   maxSeconds recording limit; countdown = show a timer, no Done button
//   allowReplay  participant may hear the instruction again
//   key       answer key used by human + AI scorers
// Every item also records timing (see README "Timing variables").
// ---------------------------------------------------------------------
const STEPS = [
  { id: "welcome", type: "intro", max: 0, scoredBy: "none",
    title: "Brain Health Check",
    text: "There are no wrong answers.\nJust do your best.",
    say: "Welcome. This check takes about ten minutes. Some questions are easy and some are hard. That is normal. Just do your best. Listen to each question. When you hear a chime and see Your turn, say your answer out loud. Tap Start when you are ready." },

  // ---- Orientation (6) - kept standard: there is little room to change these ----
  { id: "orient_day", type: "speak", domain: "Orientation", max: 1, scoredBy: "ai_speech",
    text: "What day of the week is it today?", say: "What day of the week is it today?",
    maxSeconds: 15, allowReplay: true, key: "{weekday}" },
  { id: "orient_date", type: "speak", domain: "Orientation", max: 1, scoredBy: "ai_speech",
    text: "What is today's date?\n(the number)", say: "What is today's date? Please say the number.",
    maxSeconds: 15, allowReplay: true, key: "{day_of_month}" },
  { id: "orient_month", type: "speak", domain: "Orientation", max: 1, scoredBy: "ai_speech",
    text: "What month is it?", say: "What month is it?",
    maxSeconds: 15, allowReplay: true, key: "{month}" },
  { id: "orient_year", type: "speak", domain: "Orientation", max: 1, scoredBy: "ai_speech",
    text: "What year is it?", say: "What year is it?",
    maxSeconds: 15, allowReplay: true, key: "{year}" },
  { id: "orient_place", type: "speak", domain: "Orientation", max: 1, scoredBy: "ai_speech",
    text: "What is the name of the place we are in right now?", say: "What is the name of the place we are in right now?",
    maxSeconds: 15, allowReplay: true, key: "{place}" },
  { id: "orient_city", type: "speak", domain: "Orientation", max: 1, scoredBy: "ai_speech",
    text: "What city are we in?", say: "What city are we in?",
    maxSeconds: 15, allowReplay: true, key: "{city}" },

  // ---- Memory: learning, heard ONCE (0 points, but words recalled are counted = learning variable) ----
  { id: "learn_1", type: "speak", domain: "Memory", max: 0, scoredBy: "ai_speech", countOnly: true,
    text: "Listen to 5 words and try to remember them.\nThen say all the words you remember.",
    say: "I will say five words. Listen carefully, and try to remember them. I will ask for them again later. When I finish, say all the words you remember.",
    sequence: WORDS, sequenceGapMs: 1500, maxSeconds: 25, allowReplay: false, key: WORDS.join(", ") },

  // ---- Executive function: trail, 12 circles (2) ----
  { id: "trail_practice", type: "trail", domain: "Executive", max: 0, scoredBy: "none", practice: true,
    text: "Practice: tap 1, then A, then 2, then B.",
    say: "Let's practice. Tap the circles in order. Switch between numbers and letters. Tap one, then A, then two, then B.",
    circles: TRAIL_PRACTICE, timeLimitSec: 60 },
  { id: "trail", type: "trail", domain: "Executive", max: 2, scoredBy: "app_logic",
    text: "Tap in order: 1 → A → 2 → B → 3 → C … up to 6 → F",
    say: "Now try it with more circles. Tap one, then A, then two, then B, and keep going until you reach six, then F. Go as quickly and carefully as you can.",
    circles: TRAIL_MAIN, timeLimitSec: 150 },

  // ---- Visuospatial (3): copy a box (1, AI-scored drawing) + shape turning (2, scored by the app) ----
  { id: "copy_box", type: "draw", domain: "Visuospatial", max: 1, scoredBy: "ai_vision", figure: "box",
    text: "Copy this box as carefully as you can.",
    say: "Look at the box. Please copy it in the empty drawing space, as carefully as you can. Draw every line you see. Use your finger. Tap Done when you are finished.",
    allowReplay: true, key: "3-D box: 12 lines (front face, back face, 4 connecting edges), parallel edges roughly parallel" },
  // Shape turning: a how-it-works screen with moving examples, then a practice (repeated once if
  // answered wrong, with the answer shown), then 2 scored questions. A reminder stays on screen.
  { id: "rotate_intro", type: "rotate_intro", domain: "Visuospatial", max: 0, scoredBy: "none", practice: true,
    shape: "L",
    text: "How the shape questions work",
    say: "Next, some shape questions. Watch the shapes on the screen. On the left, the shape is turning around. It is still the same shape. On the right, the shape is flipping over, like in a mirror. A flipped shape is not the same. In each question, tap the shape that is the same, just turned. Tap Continue when you are ready." },
  { id: "rotate_practice", type: "rotate", domain: "Visuospatial", max: 0, scoredBy: "none", practice: true,
    shape: "L", choices: [{ rot: 90, mirror: true }, { rot: 0, mirror: true }, { rot: 180, mirror: false }, { rot: 270, mirror: true }],
    text: "Practice: tap the shape that is the SAME as the top one, just turned.",
    say: "Let's practice. Look at the shape at the top. Tap the shape below that is the same, just turned." },
  { id: "rotate_1", type: "rotate", domain: "Visuospatial", max: 1, scoredBy: "app_logic",
    shape: "P", choices: [{ rot: 180, mirror: true }, { rot: 90, mirror: false }, { rot: 270, mirror: true }, { rot: 0, mirror: true }],
    text: "Tap the shape that is the SAME as the top one, just turned.",
    say: "Now try this one. Tap the shape that is the same as the top shape, just turned." },
  { id: "rotate_2", type: "rotate", domain: "Visuospatial", max: 1, scoredBy: "app_logic",
    shape: "F", choices: [{ rot: 90, mirror: true }, { rot: 270, mirror: true }, { rot: 0, mirror: true }, { rot: 270, mirror: false }],
    text: "Tap the shape that is the SAME as the top one, just turned.",
    say: "One more. Tap the shape that is the same as the top shape, just turned." },

  // ---- Naming (3): common, familiar objects with clear pictures (the iPad's built-in emoji) ----
  { id: "name_1", type: "speak", domain: "Naming", max: 1, scoredBy: "ai_speech",
    text: "What is this called?", say: "What is this called?", emoji: "⚓",
    maxSeconds: 12, allowReplay: true, key: "anchor" },
  { id: "name_2", type: "speak", domain: "Naming", max: 1, scoredBy: "ai_speech",
    text: "What is this called?", say: "What is this called?", emoji: "🍍",
    maxSeconds: 12, allowReplay: true, key: "pineapple" },
  { id: "name_3", type: "speak", domain: "Naming", max: 1, scoredBy: "ai_speech",
    text: "What is this called?", say: "What is this called?", emoji: "🐢",
    maxSeconds: 12, allowReplay: true, key: "turtle (also accept: tortoise)" },

  // ---- Attention (6): longer forward digit spans, visual letter tap, serial 7s from 80 ----
  { id: "digits_6", type: "speak", domain: "Attention", max: 1, scoredBy: "ai_speech",
    text: "Listen to the numbers.\nThen say them back in the same order.",
    say: "I will say some numbers. When I finish, say them back in the same order.",
    sequence: ["7", "2", "8", "5", "1", "6"], sequenceGapMs: 1000, maxSeconds: 15, allowReplay: false, key: "7 2 8 5 1 6" },
  { id: "digits_7", type: "speak", domain: "Attention", max: 1, scoredBy: "ai_speech",
    text: "Listen to the numbers.\nThen say them back in the same order.",
    say: "Now a longer list. When I finish, say the numbers back in the same order.",
    sequence: ["3", "9", "4", "1", "8", "6", "2"], sequenceGapMs: 1000, maxSeconds: 18, allowReplay: false, key: "3 9 4 1 8 6 2" },
  { id: "letters", type: "vigilance", domain: "Attention", max: 1, scoredBy: "app_logic",
    text: "Tap the big button every time you SEE the letter M.",
    say: "Letters will appear on the screen, one at a time. Tap the big button every time you see the letter M. Do not tap for any other letter, even if it looks like M. Get ready.",
    letters: LETTERS, target: "M", lures: ["N", "W"], showMs: 2000, gapMs: 300 },  // each letter shown 2 s, then 0.3 s blank
  { id: "serial7", type: "speak", domain: "Attention", max: 3, scoredBy: "ai_speech",
    text: "Start at 80. Take away 7, and keep taking away 7.\nSay five answers out loud.",
    say: "Start at eighty. Take away seven. Keep taking away seven from each answer. Say five answers out loud.",
    maxSeconds: 60, allowReplay: true, key: "73, 66, 59, 52, 45" },

  // ---- Language (3): two longer sentences with a clause, letter fluency ----
  { id: "sentence_1", type: "speak", domain: "Language", max: 1, scoredBy: "ai_speech",
    text: "Repeat the sentence exactly.",
    say: "I will say a sentence. Repeat it exactly the way I say it.",
    sequence: ["The woman who lives next to the bakery walks her two dogs every evening."], sequenceGapMs: 300,
    maxSeconds: 18, allowReplay: false, key: "The woman who lives next to the bakery walks her two dogs every evening." },
  { id: "sentence_2", type: "speak", domain: "Language", max: 1, scoredBy: "ai_speech",
    text: "Repeat the sentence exactly.",
    say: "Here is another sentence. Repeat it exactly the way I say it.",
    sequence: ["Before the storm arrived, the farmer locked the barn and counted all of his sheep."], sequenceGapMs: 300,
    maxSeconds: 18, allowReplay: false, key: "Before the storm arrived, the farmer locked the barn and counted all of his sheep." },
  { id: "fluency", type: "speak", domain: "Language", max: 1, scoredBy: "ai_speech",
    text: "Say as many words as you can that start with the letter P.\nNo names of people or places. You have 1 minute.",
    say: "Say as many words as you can that start with the letter P, as in Peter. Do not use names of people or places. You have one minute. Start when you see the timer.",
    maxSeconds: 60, countdown: true, allowReplay: false, key: "11 or more valid words starting with P = 1 point" },

  // ---- Abstraction (2) ----
  { id: "abstract_1", type: "speak", domain: "Abstraction", max: 1, scoredBy: "ai_speech",
    text: "How are a NEWSPAPER and a RADIO alike?", say: "How are a newspaper and a radio alike?",
    maxSeconds: 20, allowReplay: true, key: "both give news / information; both are ways of communicating (media)" },
  { id: "abstract_2", type: "speak", domain: "Abstraction", max: 1, scoredBy: "ai_speech",
    text: "How are a POEM and a PAINTING alike?", say: "How are a poem and a painting alike?",
    maxSeconds: 20, allowReplay: true, key: "both are art / works of art / creative expression" },

  // ---- Delayed memory (5) ----
  { id: "recall", type: "speak", domain: "Delayed memory", max: 5, scoredBy: "ai_speech",
    text: "Earlier you heard 5 words.\nSay all the words you remember.",
    say: "Earlier, I said five words. Please say all the words you remember.",
    maxSeconds: 30, allowReplay: false, key: WORDS.join(", ") },

  { id: "end", type: "end", max: 0, scoredBy: "none",
    text: "All done — thank you!\nPlease hand the tablet back.",
    say: "All done. Thank you very much. Please hand the tablet back." },
];
