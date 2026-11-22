// =====================================================================
// hosa27 - task configuration
// ---------------------------------------------------------------------
// Edit wording, words, pictures and timing HERE (not in app.js).
// FREEZE this file by Dec 4, 2026 - do not change it once real data
// collection starts. The version number is saved into every session.
// =====================================================================

const HOSA27_VERSION = "0.6.0";

// What participants see (header, welcome screen, footer). Edit freely.
const STUDY = {
  appName: "Brain Health Check",
  tagline: "A short check of memory and thinking",
  footer: "Student research study (HOSA) · This is not a medical test and does not give a diagnosis",
  minutes: 7,
};

// Friendly section names shown on each question card.
const DOMAIN_LABELS = {
  "Orientation": "Today & here", "Memory": "Memory", "Executive": "Connect the dots",
  "Visuospatial": "Drawing", "Naming": "Naming", "Attention": "Attention",
  "Language": "Language", "Abstraction": "Reasoning", "Delayed memory": "Memory",
};

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

// Original 5-word list (different from the SLUMS word list).
const WORDS = ["river", "candle", "jacket", "garden", "violin"];

// Letter-tap (vigilance) sequence, SHOWN on screen one letter at a time. Target letter = M (10 targets).
const LETTERS = ["K","M","T","R","M","M","B","L","M","D","S","M",
                 "F","M","M","Q","C","M","H","W","M","P","M","G"];

// Trail positions are percentages of the tap area (x, y).
const TRAIL_PRACTICE = [
  { label: "1", x: 22, y: 30 }, { label: "A", x: 72, y: 24 },
  { label: "2", x: 36, y: 72 }, { label: "B", x: 80, y: 70 },
];
const TRAIL_MAIN = [
  { label: "1", x: 15, y: 18 }, { label: "A", x: 46, y: 12 },
  { label: "2", x: 82, y: 20 }, { label: "B", x: 62, y: 40 },
  { label: "3", x: 24, y: 44 }, { label: "C", x: 12, y: 76 },
  { label: "4", x: 42, y: 66 }, { label: "D", x: 72, y: 62 },
  { label: "5", x: 88, y: 84 }, { label: "E", x: 54, y: 88 },
];

// ---------------------------------------------------------------------
// STEPS run in this order. Fields:
//   type      intro | speak | trail | draw | vigilance | end
//   domain    MoCA thinking-skill area (for analysis)
//   max       points for this item (0 = not scored)
//   scoredBy  ai_speech | ai_vision | app_logic | none
//   say       spoken instruction;  text = what is shown on screen
//   sequence  items read one at a time after `say` (words, digits...)
//   maxSeconds recording limit; countdown = show a timer, no Done button
//   allowReplay  participant may hear the instruction again
//   key       answer key used by human + AI scorers
// ---------------------------------------------------------------------
const STEPS = [
  { id: "welcome", type: "intro", max: 0, scoredBy: "none",
    title: "Brain Health Check",
    text: "There are no wrong answers.\nJust do your best.",
    say: "Welcome. This check takes about seven minutes. There are no wrong answers. Just do your best. Listen to each question. When you hear a chime and see Your turn, say your answer out loud. Tap Start when you are ready." },

  // ---- Orientation (6) ----
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

  // ---- Memory: learning (not scored, needed for delayed recall) ----
  { id: "learn_1", type: "speak", domain: "Memory", max: 0, scoredBy: "none",
    text: "Listen to 5 words.\nThen say all the words you remember.",
    say: "I will say five words. Listen carefully. When I finish, say all the words you remember. Any order is fine.",
    sequence: WORDS, sequenceGapMs: 1500, maxSeconds: 25, allowReplay: false, key: WORDS.join(", ") },
  { id: "learn_2", type: "speak", domain: "Memory", max: 0, scoredBy: "none",
    text: "Listen to the same 5 words again.\nThen say all the words you remember.",
    say: "I will say the same five words again. Try to remember them. I will ask for them again later. When I finish, say all the words you remember.",
    sequence: WORDS, sequenceGapMs: 1500, maxSeconds: 25, allowReplay: false, key: WORDS.join(", ") },

  // ---- Executive function: trail (2) ----
  { id: "trail_practice", type: "trail", domain: "Executive", max: 0, scoredBy: "none", practice: true,
    text: "Practice: tap 1, then A, then 2, then B.",
    say: "Let's practice. Tap the circles in order. Switch between numbers and letters. Tap one, then A, then two, then B.",
    circles: TRAIL_PRACTICE, timeLimitSec: 60 },
  { id: "trail", type: "trail", domain: "Executive", max: 2, scoredBy: "app_logic",
    text: "Tap in order: 1 → A → 2 → B → 3 → C …",
    say: "Now try it with more circles. Tap one, then A, then two, then B, and keep going to the end. Go as quickly and carefully as you can.",
    circles: TRAIL_MAIN, timeLimitSec: 120 },

  // ---- Visuospatial: clock (3) ----
  { id: "clock", type: "draw", domain: "Visuospatial", max: 3, scoredBy: "ai_vision",
    text: "Draw a clock. Put in all the numbers.\nSet the hands to twenty past eight (8:20).",
    say: "Please draw a clock with all the numbers. Set the hands to twenty past eight. Use your finger. Tap Done when you are finished.",
    allowReplay: true, key: "8:20" },

  // ---- Naming (3) ----
  { id: "name_1", type: "speak", domain: "Naming", max: 1, scoredBy: "ai_speech",
    text: "What is this?", say: "What is this?", image: "images/naming1.png", emoji: "🦉",
    maxSeconds: 10, allowReplay: true, key: "owl" },
  { id: "name_2", type: "speak", domain: "Naming", max: 1, scoredBy: "ai_speech",
    text: "What is this?", say: "What is this?", image: "images/naming2.png", emoji: "🌵",
    maxSeconds: 10, allowReplay: true, key: "cactus" },
  { id: "name_3", type: "speak", domain: "Naming", max: 1, scoredBy: "ai_speech",
    text: "What is this?", say: "What is this?", image: "images/naming3.png", emoji: "🦘",
    maxSeconds: 10, allowReplay: true, key: "kangaroo" },

  // ---- Attention (6) ----
  { id: "digits_5", type: "speak", domain: "Attention", max: 1, scoredBy: "ai_speech",
    text: "Listen to the numbers.\nThen say them back in the same order.",
    say: "I will say some numbers. When I finish, say them back in the same order.",
    sequence: ["4", "9", "3", "7", "1"], sequenceGapMs: 1000, maxSeconds: 15, allowReplay: false, key: "4 9 3 7 1" },
  { id: "digits_6", type: "speak", domain: "Attention", max: 1, scoredBy: "ai_speech",
    text: "Listen to the numbers.\nThen say them back in the same order.",
    say: "Here are some more numbers. When I finish, say them back in the same order.",
    sequence: ["8", "2", "6", "4", "9", "3"], sequenceGapMs: 1000, maxSeconds: 15, allowReplay: false, key: "8 2 6 4 9 3" },
  { id: "letters", type: "vigilance", domain: "Attention", max: 1, scoredBy: "app_logic",
    text: "Tap the big button every time you SEE the letter M.",
    say: "Letters will appear on the screen, one at a time. Tap the big button every time you see the letter M. Do not tap for any other letter. Get ready.",
    letters: LETTERS, target: "M", showMs: 2000, gapMs: 300 },  // each letter shown 2 s, then 0.3 s blank
  { id: "serial3", type: "speak", domain: "Attention", max: 3, scoredBy: "ai_speech",
    text: "Start at 50. Take away 3, and keep taking away 3.\nSay five answers out loud.",
    say: "Start at fifty. Take away three. Keep taking away three from each answer. Say five answers out loud.",
    maxSeconds: 45, allowReplay: true, key: "47, 44, 41, 38, 35" },

  // ---- Language (3) ----
  { id: "sentence_1", type: "speak", domain: "Language", max: 1, scoredBy: "ai_speech",
    text: "Repeat the sentence exactly.",
    say: "I will say a sentence. Repeat it exactly the way I say it.",
    sequence: ["The tall man carried a red umbrella to the market on Tuesday."], sequenceGapMs: 300,
    maxSeconds: 15, allowReplay: false, key: "The tall man carried a red umbrella to the market on Tuesday." },
  { id: "sentence_2", type: "speak", domain: "Language", max: 1, scoredBy: "ai_speech",
    text: "Repeat the sentence exactly.",
    say: "Here is another sentence. Repeat it exactly the way I say it.",
    sequence: ["Grandma baked three loaves of bread before the snowstorm arrived."], sequenceGapMs: 300,
    maxSeconds: 15, allowReplay: false, key: "Grandma baked three loaves of bread before the snowstorm arrived." },
  { id: "fluency", type: "speak", domain: "Language", max: 1, scoredBy: "ai_speech",
    text: "Name as many FRUITS as you can.\nYou have 1 minute.",
    say: "Name as many different fruits as you can. You have one minute. Start when you see the timer.",
    maxSeconds: 60, countdown: true, allowReplay: false, key: "10 or more different fruits = 1 point" },

  // ---- Abstraction (2) ----
  { id: "abstract_1", type: "speak", domain: "Abstraction", max: 1, scoredBy: "ai_speech",
    text: "How are a PIANO and a DRUM alike?", say: "How are a piano and a drum alike?",
    maxSeconds: 20, allowReplay: true, key: "musical instruments" },
  { id: "abstract_2", type: "speak", domain: "Abstraction", max: 1, scoredBy: "ai_speech",
    text: "How are a RULER and a THERMOMETER alike?", say: "How are a ruler and a thermometer alike?",
    maxSeconds: 20, allowReplay: true, key: "measuring tools / instruments" },

  // ---- Delayed memory (5) ----
  { id: "recall", type: "speak", domain: "Delayed memory", max: 5, scoredBy: "ai_speech",
    text: "Earlier you heard 5 words.\nSay all the words you remember.",
    say: "Earlier, I said five words. Please say all the words you remember.",
    maxSeconds: 30, allowReplay: false, key: WORDS.join(", ") },

  { id: "end", type: "end", max: 0, scoredBy: "none",
    text: "All done — thank you!\nPlease hand the tablet back.",
    say: "All done. Thank you very much. Please hand the tablet back." },
];
