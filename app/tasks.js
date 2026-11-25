// =====================================================================
// hosa27 - task configuration
// ---------------------------------------------------------------------
// Edit wording, words, pictures and timing HERE (not in app.js).
// FREEZE this file by Dec 4, 2026 - do not change it once real data
// collection starts. The version number is saved into every session.
// =====================================================================

const HOSA27_VERSION = "0.10.2";

// What participants see (header, welcome screen, footer). Edit freely.
const STUDY = {
  appName: "Brain Health Check",
  tagline: "A short check of memory and thinking",
  footer: "Student research study (HOSA) · This is not a medical test and does not give a diagnosis",
  minutes: 15,
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
  rate: 0.62,          // slow, calm pace (1 = normal; was 0.72 before v0.10.0)
  sentencePauseMs: 900, // silence between sentences of an instruction (was 600)
};

// ---------------------------------------------------------------------
// v0.10.2: 19 questions (+ 3 practice screens, not counted): today's date on one screen, the 3 pictures on
// one screen (both as in the MoCA). v0.10.0 item set (based on v0.9.0): still the MoCA's 8 areas and 30 points, made SHORTER for a
// 15-minute maximum: orientation asked in 3 screens (2 questions each), no hint round after recall,
// a shorter letter task, and shorter spoken instructions (the steps stay on screen, so the voice only
// needs to say the essentials, slowly). Still avoids the paper SLUMS items (no clock, no animal naming,
// no money math, no backward digits, no story, no SLUMS words such as "apple").
// ---------------------------------------------------------------------

// 5-word list: all from ONE category (fruit), which makes it easier to learn than the MoCA's mixed list.
// Read TWICE, as in the MoCA, and each word is also SHOWN on screen while it is spoken (showSequence).
// Recalled at the end without help (5 points).
const WORD_CATEGORY = "fruit";
const WORDS = ["peach", "grape", "cherry", "lemon", "mango"];

// Letter tap (MoCA-style): tap for every A. 20 letters, 7 A's, no look-alike letters (was 24; shorter in v0.10.0).
const LETTERS = ["T","A","S","B","A","L","P","A","K","D",
                 "A","H","C","A","E","G","A","N","U","A"];

// Trail positions are percentages of the tap area (x, y).
const TRAIL_PRACTICE = [
  { label: "1", x: 22, y: 30 }, { label: "A", x: 72, y: 24 },
  { label: "2", x: 36, y: 72 }, { label: "B", x: 80, y: 70 },
];
// 10 circles, 1-5 and A-E, the same length as the MoCA trail.
const TRAIL_MAIN = [   // on a 3-row grid (rows shifted) so circles never overlap, even beside the "What to do" panel
  { label: "1", x: 32, y: 50 }, { label: "A", x: 12, y: 8 },  { label: "2", x: 64, y: 8 },
  { label: "B", x: 58, y: 50 }, { label: "3", x: 90, y: 92 }, { label: "C", x: 38, y: 92 },
  { label: "4", x: 6,  y: 50 }, { label: "D", x: 38, y: 8 },  { label: "5", x: 90, y: 8 },
  { label: "E", x: 64, y: 92 },
];

// Shape puzzles: blocks of a shape as [column, row]. The top shape is shown upright; each choice is the
// shape turned by `rot` degrees, and `mirror: true` means flipped (= NOT the same shape).
// Exactly one choice per puzzle has mirror: false - that is the correct answer. 3 choices (was 4).
const SHAPES = {
  L: [[0, 0], [0, 1], [0, 2], [1, 2]],                 // practice
  P: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]],
  L5: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]],
};

// ---------------------------------------------------------------------
// STEPS run in this order. Fields:
//   type      intro | speak | trail | draw | rotate_intro | rotate | vigilance | end
//   domain    MoCA thinking-skill area (for analysis)
//   max       points for this item (0 = not in the 30-point total)
//   scoredBy  ai_speech | ai_vision | app_logic | none
//   countOnly AI/human scorers still count words (raw_count) for a research variable, 0 points
//   say       spoken instruction (played BEFORE the Start button); text = the question shown on screen
//   howTo     numbered "What to do" steps that stay on screen the whole time (default steps are used if absent)
//   sequence  words / numbers / sentence played AFTER the participant taps Start
//   showSequence  also SHOW each sequence item on screen while it is spoken (memory words only)
//   seqRate   speaking speed for the sequence in words per minute (voice pack); slower = clearer
//   maxSeconds recording limit; countdown = show a timer, no Done button
//   allowReplay  participant may hear the question again while answering (instructions can ALWAYS be
//                replayed before Start, because the words/numbers to remember only play after Start)
//   key       answer key used by human + AI scorers
// Every item also records timing (see README "Timing variables").
// ---------------------------------------------------------------------
const STEPS = [
  { id: "welcome", type: "intro", max: 0, scoredBy: "none",
    title: "Brain Health Check",
    text: "There are no wrong answers.\nJust do your best.",
    say: "Welcome. This check takes about fifteen minutes. There are no wrong answers. Just do your best. For each question, first listen. The steps are written on the screen, so you do not have to remember them. Then tap the big green Start button, and answer. Tap Start now to begin." },

  // ---- Orientation (6): 2 screens, as in the MoCA ("tell me today's date", then place and city). 1 point per part ----
  { id: "orient_fulldate", type: "speak", domain: "Orientation", max: 4, scoredBy: "ai_speech",
    text: "What is today's date?\nSay all 4: the DAY of the week, the MONTH, the DATE, and the YEAR.",
    say: "What is today's date? Please say the day of the week, the month, the date, and the year. The four parts are written on the screen. Tap Start, and then say your answer.",
    howTo: ["Tap the green START button.", "Say the DAY of the week.", "Say the MONTH.", "Say the DATE (the number).", "Say the YEAR.", "Tap I'M DONE."],
    maxSeconds: 25, allowReplay: true,
    key: "day of the week: {weekday} (1 point); month: {month} (1 point); date number: {day_of_month} (1 point); year: {year} (1 point)" },
  { id: "orient_placecity", type: "speak", domain: "Orientation", max: 2, scoredBy: "ai_speech",
    text: "1. What is the name of this PLACE?\n2. What CITY are we in?",
    say: "What is the name of the place we are in? And what city are we in? Tap Start, and then say both answers.",
    howTo: ["Tap the green START button.", "Say the name of this PLACE (the building).", "Say the CITY.", "Tap I'M DONE."],
    maxSeconds: 20, allowReplay: true, key: "place: {place} (1 point); city: {city} (1 point)" },

  // ---- Memory: learning, the list is read TWICE as in the MoCA (0 points; words said = learning variables) ----
  { id: "learn_1", type: "speak", domain: "Memory", max: 0, scoredBy: "ai_speech", countOnly: true,
    text: "Listen to 5 fruits.\nThen say all the fruits you remember.",
    say: "Now a memory task. I will say five fruits. Each one will also appear on the screen. When I finish, say all the fruits you remember, in any order. Tap Start, and then listen.",
    howTo: ["Tap the green START button.",
            "Listen to 5 fruits. Each one appears on the screen.",
            "Wait for the chime and SPEAK NOW.",
            "Say all the fruits you remember. Any order is fine.",
            "Tap I'M DONE."],
    sequence: WORDS, showSequence: true, sequenceGapMs: 1500, maxSeconds: 25, allowReplay: false, key: WORDS.join(", ") },
  { id: "learn_2", type: "speak", domain: "Memory", max: 0, scoredBy: "ai_speech", countOnly: true,
    text: "Listen to the SAME 5 fruits again.\nThen say all the fruits you remember.",
    say: "I will say the same five fruits again. Try to remember them, because I will ask for them again at the end. When I finish, say all the fruits you remember. Tap Start, and then listen.",
    howTo: ["Tap the green START button.",
            "Listen to the SAME 5 fruits again.",
            "Wait for the chime and SPEAK NOW.",
            "Say all the fruits you remember, including the ones you said before.",
            "Tap I'M DONE.",
            "Keep the fruits in mind. You will be asked for them again at the end."],
    sequence: WORDS, showSequence: true, sequenceGapMs: 1500, maxSeconds: 25, allowReplay: false, key: WORDS.join(", ") },

  // ---- Executive function: trail, 10 circles as in the MoCA (2) ----
  { id: "trail_practice", type: "trail", domain: "Executive", max: 0, scoredBy: "none", practice: true,
    text: "Practice: tap 1 → A → 2 → B",
    say: "Let's practice. Tap the circles in order: one, then A, then two, then B. The next circle will light up to help you. Tap Start, and then begin.",
    howTo: ["Tap the green START button.",
            "Tap the circles in this order: 1 → A → 2 → B.",
            "Number, then letter, then number, then letter.",
            "In this practice, the next circle lights up to help you."],
    circles: TRAIL_PRACTICE, timeLimitSec: 60 },
  { id: "trail", type: "trail", domain: "Executive", max: 2, scoredBy: "app_logic",
    text: "Tap in order: 1 → A → 2 → B → 3 → C → 4 → D → 5 → E",
    say: "Now more circles. Tap one, then A, then two, then B, and keep going until you reach E. The order is written above the circles. Tap Start, and then begin.",
    howTo: ["Tap the green START button.",
            "Start at 1. Then A. Then 2. Then B.",
            "Keep switching: number, letter, number, letter.",
            "The order is written above the circles.",
            "Finish at E."],
    circles: TRAIL_MAIN, timeLimitSec: 150 },

  // ---- Visuospatial (3): copy a box (1, AI-scored drawing) + shape puzzles (2, scored by the app) ----
  { id: "copy_box", type: "draw", domain: "Visuospatial", max: 1, scoredBy: "ai_vision", figure: "box",
    text: "Copy this box as carefully as you can.",
    say: "Copy this box in the white space, using your finger. Draw every line you see. Tap Done when you are finished. Tap Start when you are ready.",
    howTo: ["Look at the box drawing.",
            "Tap the green START button.",
            "Copy the box in the white space with your finger.",
            "Draw every line you see. Take your time.",
            "To try again, tap ERASE.",
            "Tap DONE when you are finished."],
    allowReplay: true, key: "3-D box: 12 lines (front face, back face, 4 connecting edges), parallel edges roughly parallel" },
  // Shape puzzles: a how-it-works screen with moving examples, then a practice (repeated once if
  // answered wrong, with the answer shown), then 2 scored puzzles. The rule stays on screen.
  { id: "rotate_intro", type: "rotate_intro", domain: "Visuospatial", max: 0, scoredBy: "none", practice: true,
    shape: "L",
    text: "How the shape puzzles work",
    say: "Next, shape puzzles. On the left, a shape is turning, like a wheel. It is still the same shape. On the right, a shape is flipping, like in a mirror. A flipped shape is not the same. In each puzzle, tap the one shape that is the same, just turned. Tap Continue when you are ready.",
    howTo: ["TURNED shape (spinning like a wheel) = the SAME shape.",
            "FLIPPED shape (like a mirror) = NOT the same.",
            "In each puzzle, find the ONE shape that is the same as the top shape, just turned.",
            "Tap CONTINUE when you understand."] },
  { id: "rotate_practice", type: "rotate", domain: "Visuospatial", max: 0, scoredBy: "none", practice: true,
    shape: "L", choices: [{ rot: 0, mirror: true }, { rot: 90, mirror: false }, { rot: 180, mirror: true }],
    text: "Practice: which shape is the SAME as the top one, just turned?",
    say: "Let's practice. Tap the shape that is the same as the top shape, just turned. Tap Start when you are ready." },
  { id: "rotate_1", type: "rotate", domain: "Visuospatial", max: 1, scoredBy: "app_logic",
    shape: "P", choices: [{ rot: 90, mirror: false }, { rot: 0, mirror: true }, { rot: 90, mirror: true }],
    text: "Which shape is the SAME as the top one, just turned?",
    say: "Now a real puzzle. Tap the shape that is the same, just turned. Tap Start when you are ready." },
  { id: "rotate_2", type: "rotate", domain: "Visuospatial", max: 1, scoredBy: "app_logic",
    shape: "L5", choices: [{ rot: 180, mirror: true }, { rot: 0, mirror: true }, { rot: 180, mirror: false }],
    text: "Which shape is the SAME as the top one, just turned?",
    say: "One more puzzle. Tap Start when you are ready." },

  // ---- Naming (3): 3 common objects on ONE screen, as in the MoCA (no fruit, so it can't mix with the memory list) ----
  { id: "naming", type: "speak", domain: "Naming", max: 3, scoredBy: "ai_speech",
    text: "What are these 3 things called?", emoji: ["⚓", "🎸", "🐢"],
    say: "Look at the three pictures. Say what each one is called, starting with number one. Tap Start, and then say your answers.",
    howTo: ["Look at the 3 pictures.", "Tap the green START button.", "Say what each one is called: 1, then 2, then 3.", "Tap I'M DONE."],
    maxSeconds: 25, allowReplay: true,
    key: "1. anchor (1 point); 2. guitar (1 point); 3. turtle, also accept tortoise (1 point). Any order is fine." },

  // ---- Attention (6): short forward number lists (4 and 5 numbers), letter tap, serial 7s from 100 (MoCA) ----
  { id: "digits_4", type: "speak", domain: "Attention", max: 1, scoredBy: "ai_speech",
    text: "Listen to 4 numbers.\nThen say them back in the same order.",
    say: "Next, I will say four numbers. When I finish, say them back in the same order. Tap Start, and then listen.",
    howTo: ["Tap the green START button.", "Listen to 4 numbers.", "Wait for the chime and SPEAK NOW.",
            "Say the numbers back in the SAME order.", "Tap I'M DONE."],
    sequence: ["5", "8", "2", "6"], sequenceGapMs: 1000, maxSeconds: 15, allowReplay: false, key: "5 8 2 6" },
  { id: "digits_5", type: "speak", domain: "Attention", max: 1, scoredBy: "ai_speech",
    text: "Listen to 5 numbers.\nThen say them back in the same order.",
    say: "Now five numbers. Say them back in the same order. Tap Start, and then listen.",
    howTo: ["Tap the green START button.", "Listen to 5 numbers.", "Wait for the chime and SPEAK NOW.",
            "Say the numbers back in the SAME order.", "Tap I'M DONE."],
    sequence: ["4", "1", "7", "3", "9"], sequenceGapMs: 1000, maxSeconds: 15, allowReplay: false, key: "4 1 7 3 9" },
  { id: "letters", type: "vigilance", domain: "Attention", max: 1, scoredBy: "app_logic",
    text: "Tap the big button every time you SEE the letter A.",
    say: "Next, letters will appear, one at a time. When you see the letter A, tap the big button. Do not tap for other letters. Tap Start when you are ready.",
    howTo: ["Tap the green START button.", "Letters appear one at a time.",
            "When you see the letter A, tap the big TAP button.", "Other letters: do NOT tap."],
    letters: LETTERS, target: "A", lures: [], showMs: 1700, gapMs: 300 },  // each letter shown 1.7 s, then 0.3 s blank (~40 s total)
  { id: "serial7", type: "speak", domain: "Attention", max: 3, scoredBy: "ai_speech",
    text: "Start at 100. Take away 7.\nKeep taking away 7. Say 5 answers.",
    say: "Start at one hundred, and take away seven. Say the answer. Then keep taking away seven, until you have said five answers. Tap Start, and then begin.",
    howTo: ["Tap the green START button.", "Start at 100. Take away 7. Say the answer.",
            "Take away 7 from THAT answer. Say it.", "Keep going until you have said 5 answers.", "Tap I'M DONE."],
    maxSeconds: 60, allowReplay: true, key: "93, 86, 79, 72, 65" },

  // ---- Language (3): two short sentences said SLOWLY, letter fluency ----
  { id: "sentence_1", type: "speak", domain: "Language", max: 1, scoredBy: "ai_speech",
    text: "Listen to a sentence.\nThen repeat it exactly.",
    say: "Next, I will say a sentence, slowly. When you hear the chime, repeat it word for word. Tap Start, and then listen.",
    howTo: ["Tap the green START button.", "Listen to the whole sentence. It is said slowly.",
            "Wait for the chime and SPEAK NOW.", "Repeat the sentence word for word, slowly and clearly.", "Tap I'M DONE."],
    sequence: ["The children played in the park after lunch."], sequenceGapMs: 300, seqRate: 100,
    maxSeconds: 18, allowReplay: false, key: "The children played in the park after lunch." },
  { id: "sentence_2", type: "speak", domain: "Language", max: 1, scoredBy: "ai_speech",
    text: "Listen to a sentence.\nThen repeat it exactly.",
    say: "Here is another sentence. Repeat it word for word. Tap Start, and then listen.",
    howTo: ["Tap the green START button.", "Listen to the whole sentence. It is said slowly.",
            "Wait for the chime and SPEAK NOW.", "Repeat the sentence word for word, slowly and clearly.", "Tap I'M DONE."],
    sequence: ["My sister always brings flowers when she visits."], sequenceGapMs: 300, seqRate: 100,
    maxSeconds: 18, allowReplay: false, key: "My sister always brings flowers when she visits." },
  { id: "fluency", type: "speak", domain: "Language", max: 1, scoredBy: "ai_speech",
    text: "Say as many words as you can that start with the letter P.",
    say: "Say as many words as you can that begin with the letter P. Do not say names of people or places. You will have one minute. Tap Start, and begin when the timer starts.",
    howTo: ["Tap the green START button. A 1-minute timer starts.", "Say as many words as you can that begin with P.",
            "No names of people or places (not Peter, not Paris).", "Keep going until the timer ends."],
    maxSeconds: 60, countdown: true, allowReplay: false, key: "11 or more valid words starting with P = 1 point" },

  // ---- Abstraction (2): an example first, as in the MoCA (example is not fruit, so it can't mix with the memory list) ----
  { id: "abstract_1", type: "speak", domain: "Abstraction", max: 1, scoredBy: "ai_speech",
    text: "How are a CAR and an AIRPLANE alike?\n(Example: a hammer and a saw are both tools.)",
    say: "Next, tell me how two things are alike. For example, a hammer and a saw are alike because they are both tools. How are a car and an airplane alike? Tap Start, and then say your answer.",
    howTo: ["Listen to the example: a hammer and a saw are both TOOLS.", "Tap the green START button.",
            "Say how a car and an airplane are alike: what kind of things are they both?", "Tap I'M DONE."],
    maxSeconds: 20, allowReplay: true, key: "both are transportation / ways to travel / vehicles" },
  { id: "abstract_2", type: "speak", domain: "Abstraction", max: 1, scoredBy: "ai_speech",
    text: "How are a CLOCK and a CALENDAR alike?",
    say: "How are a clock and a calendar alike? Tap Start, and then say your answer.",
    howTo: ["Tap the green START button.", "Say how a clock and a calendar are alike: what are they both used for?", "Tap I'M DONE."],
    maxSeconds: 20, allowReplay: true, key: "both tell / measure / keep track of time" },

  // ---- Delayed memory (5): no hints ----
  { id: "recall", type: "speak", domain: "Delayed memory", max: 5, scoredBy: "ai_speech",
    text: "At the start, you heard 5 fruits two times.\nSay all the fruits you remember.",
    say: "At the start, I told you five fruits, two times. Please say all the fruits you remember, in any order. Tap Start, and then say them.",
    howTo: ["Think of the 5 fruits from the start.", "Tap the green START button.",
            "Say all the fruits you remember. Any order is fine.", "Tap I'M DONE."],
    maxSeconds: 30, allowReplay: false, key: WORDS.join(", ") + " (only these 5 fruits count; other fruits = 0)" },

  { id: "end", type: "end", max: 0, scoredBy: "none",
    text: "All done — thank you!\nPlease hand the tablet back.",
    say: "All done. Thank you very much. Please hand the tablet back." },
];
