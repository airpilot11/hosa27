// =====================================================================
// hosa27 - task configuration
// ---------------------------------------------------------------------
// Edit wording, words, pictures and timing HERE (not in app.js).
// FREEZE this file by Dec 4, 2026 - do not change it once real data
// collection starts. The version number is saved into every session.
// =====================================================================

const HOSA27_VERSION = "0.9.0";

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
  rate: 0.72,          // slow, calm pace (1 = normal)
  sentencePauseMs: 600, // silence between sentences of an instruction
};

// ---------------------------------------------------------------------
// v0.9.0 item set: EASIER and closer to the MoCA (same 8 areas, same points, same scoring rules where
// possible), with clear step-by-step instructions on screen and a START button before every task.
// Still avoids the paper SLUMS items (no clock, no animal naming, no money math, no backward digits,
// no story, no SLUMS words), so giving both tests in one visit does not repeat items.
// ---------------------------------------------------------------------

// 5-word list, one word from each everyday category (the MoCA list is built the same way).
// Read TWICE, as in the MoCA. Recalled at the end without hints (5 points), then with category hints (0 points).
const WORD_CATEGORIES = ["a body part", "a piece of clothing", "a building", "a flower", "a color"];
const WORDS = ["hand", "shirt", "school", "rose", "blue"];

// Letter tap (MoCA-style): tap for every A. 24 letters, 8 A's, no look-alike letters.
const LETTERS = ["T","A","S","B","A","A","L","P","A","K","D","M",
                 "A","H","C","O","A","E","G","A","N","U","A","R"];

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
//   sequence  words / numbers / sentence played AFTER the participant taps Start (never shown on screen)
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
    say: "Welcome. This check takes about fifteen minutes. Some questions are easy and some are harder. That is normal. Just do your best. Every question works the same way. First, listen to the instructions. The steps are also written on the screen, so you do not have to remember them. Then, when you are ready, tap the big green Start button. After that, answer out loud, or tap, or draw. Tap Start now to begin." },

  // ---- Orientation (6) ----
  { id: "orient_day", type: "speak", domain: "Orientation", max: 1, scoredBy: "ai_speech",
    text: "What day of the week is it today?", say: "What day of the week is it today? Tap Start, and then say your answer.",
    maxSeconds: 15, allowReplay: true, key: "{weekday}" },
  { id: "orient_date", type: "speak", domain: "Orientation", max: 1, scoredBy: "ai_speech",
    text: "What is today's date?\n(the number)", say: "What is today's date? Please say the number. Tap Start, and then say your answer.",
    maxSeconds: 15, allowReplay: true, key: "{day_of_month}" },
  { id: "orient_month", type: "speak", domain: "Orientation", max: 1, scoredBy: "ai_speech",
    text: "What month is it?", say: "What month is it? Tap Start, and then say your answer.",
    maxSeconds: 15, allowReplay: true, key: "{month}" },
  { id: "orient_year", type: "speak", domain: "Orientation", max: 1, scoredBy: "ai_speech",
    text: "What year is it?", say: "What year is it? Tap Start, and then say your answer.",
    maxSeconds: 15, allowReplay: true, key: "{year}" },
  { id: "orient_place", type: "speak", domain: "Orientation", max: 1, scoredBy: "ai_speech",
    text: "What is the name of the place we are in right now?", say: "What is the name of the place we are in right now? Tap Start, and then say your answer.",
    maxSeconds: 15, allowReplay: true, key: "{place}" },
  { id: "orient_city", type: "speak", domain: "Orientation", max: 1, scoredBy: "ai_speech",
    text: "What city are we in?", say: "What city are we in? Tap Start, and then say your answer.",
    maxSeconds: 15, allowReplay: true, key: "{city}" },

  // ---- Memory: learning, the list is read TWICE as in the MoCA (0 points; words said = learning variables) ----
  { id: "learn_1", type: "speak", domain: "Memory", max: 0, scoredBy: "ai_speech", countOnly: true,
    text: "Listen to 5 words.\nThen say all the words you remember.",
    say: "Now a memory task. After you tap Start, I will read five words. Each word is a different kind of everyday thing: a body part, a piece of clothing, a building, a flower, and a color. Listen carefully. When I finish, say all the words you remember, in any order. Tap Start, and then listen.",
    howTo: ["Tap the green START button.",
            "Listen to 5 words: a body part, a piece of clothing, a building, a flower, and a color.",
            "Wait for the chime and SPEAK NOW.",
            "Say all the words you remember. Any order is fine.",
            "Tap I'M DONE."],
    sequence: WORDS, sequenceGapMs: 1500, maxSeconds: 25, allowReplay: false, key: WORDS.join(", ") },
  { id: "learn_2", type: "speak", domain: "Memory", max: 0, scoredBy: "ai_speech", countOnly: true,
    text: "Listen to the SAME 5 words again.\nThen say all the words you remember.",
    say: "I will read the same five words again. Try to remember them, because I will ask you for them again at the end. When I finish, say all the words you remember, including the words you said the first time. Tap Start, and then listen.",
    howTo: ["Tap the green START button.",
            "Listen to the SAME 5 words again.",
            "Wait for the chime and SPEAK NOW.",
            "Say all the words you remember, including the ones you said before.",
            "Tap I'M DONE.",
            "Keep the words in mind. You will be asked for them again at the end."],
    sequence: WORDS, sequenceGapMs: 1500, maxSeconds: 25, allowReplay: false, key: WORDS.join(", ") },

  // ---- Executive function: trail, 10 circles as in the MoCA (2) ----
  { id: "trail_practice", type: "trail", domain: "Executive", max: 0, scoredBy: "none", practice: true,
    text: "Practice: tap 1 → A → 2 → B",
    say: "Let's practice connecting circles. You will tap the circles in order, switching between a number and a letter. One, then A, then two, then B. The next circle will light up to help you. Tap Start, and then begin.",
    howTo: ["Tap the green START button.",
            "Tap the circles in this order: 1 → A → 2 → B.",
            "Number, then letter, then number, then letter.",
            "In this practice, the next circle lights up to help you."],
    circles: TRAIL_PRACTICE, timeLimitSec: 60 },
  { id: "trail", type: "trail", domain: "Executive", max: 2, scoredBy: "app_logic",
    text: "Tap in order: 1 → A → 2 → B → 3 → C → 4 → D → 5 → E",
    say: "Now the same thing with more circles. Tap one, then A, then two, then B, then three, then C, and keep going until you reach five, and then E. This time the circles will not light up. Take your time and be careful. Tap Start, and then begin.",
    howTo: ["Tap the green START button.",
            "Start at 1. Then A. Then 2. Then B.",
            "Keep switching: number, letter, number, letter.",
            "The order is written above the circles.",
            "Finish at E."],
    circles: TRAIL_MAIN, timeLimitSec: 150 },

  // ---- Visuospatial (3): copy a box (1, AI-scored drawing) + shape puzzles (2, scored by the app) ----
  { id: "copy_box", type: "draw", domain: "Visuospatial", max: 1, scoredBy: "ai_vision", figure: "box",
    text: "Copy this box as carefully as you can.",
    say: "Look at the drawing of a box. After you tap Start, copy the box in the white space, using your finger. Draw every line you see. Take your time. If you want to try again, tap Erase. Tap Done when you are finished. Tap Start when you are ready.",
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
    say: "Next, some shape puzzles. Look at the two examples on the screen. On the left, a shape is turning around, like a wheel. It is still the same shape. On the right, a shape is flipping over, like its reflection in a mirror. A flipped shape is not the same shape. In each puzzle, you will see one shape at the top, and three shapes below it. Only one of the three is the same shape, just turned. Tap that one. Tap Continue when you are ready.",
    howTo: ["TURNED shape (spinning like a wheel) = the SAME shape.",
            "FLIPPED shape (like a mirror) = NOT the same.",
            "In each puzzle, find the ONE shape that is the same as the top shape, just turned.",
            "Tap CONTINUE when you understand."] },
  { id: "rotate_practice", type: "rotate", domain: "Visuospatial", max: 0, scoredBy: "none", practice: true,
    shape: "L", choices: [{ rot: 0, mirror: true }, { rot: 90, mirror: false }, { rot: 180, mirror: true }],
    text: "Practice: which shape is the SAME as the top one, just turned?",
    say: "Let's practice. After you tap Start, three shapes will appear. Tap the one that is the same as the top shape, just turned. The other two are flipped, like a mirror. Tap Start when you are ready." },
  { id: "rotate_1", type: "rotate", domain: "Visuospatial", max: 1, scoredBy: "app_logic",
    shape: "P", choices: [{ rot: 90, mirror: false }, { rot: 0, mirror: true }, { rot: 90, mirror: true }],
    text: "Which shape is the SAME as the top one, just turned?",
    say: "Now a real puzzle. After you tap Start, tap the shape that is the same as the top shape, just turned. Tap Start when you are ready." },
  { id: "rotate_2", type: "rotate", domain: "Visuospatial", max: 1, scoredBy: "app_logic",
    shape: "L5", choices: [{ rot: 180, mirror: true }, { rot: 0, mirror: true }, { rot: 180, mirror: false }],
    text: "Which shape is the SAME as the top one, just turned?",
    say: "One more puzzle. After you tap Start, tap the shape that is the same as the top shape, just turned. Tap Start when you are ready." },

  // ---- Naming (3): common, familiar objects with clear pictures ----
  { id: "name_1", type: "speak", domain: "Naming", max: 1, scoredBy: "ai_speech",
    text: "What is this called?", say: "Look at the picture. What is this called? Tap Start, and then say your answer.", emoji: "⚓",
    howTo: ["Look at the picture.", "Tap the green START button.", "Say what it is called.", "Tap I'M DONE."],
    maxSeconds: 12, allowReplay: true, key: "anchor" },
  { id: "name_2", type: "speak", domain: "Naming", max: 1, scoredBy: "ai_speech",
    text: "What is this called?", say: "What is this called? Tap Start, and then say your answer.", emoji: "🍍",
    howTo: ["Look at the picture.", "Tap the green START button.", "Say what it is called.", "Tap I'M DONE."],
    maxSeconds: 12, allowReplay: true, key: "pineapple" },
  { id: "name_3", type: "speak", domain: "Naming", max: 1, scoredBy: "ai_speech",
    text: "What is this called?", say: "What is this called? Tap Start, and then say your answer.", emoji: "🐢",
    howTo: ["Look at the picture.", "Tap the green START button.", "Say what it is called.", "Tap I'M DONE."],
    maxSeconds: 12, allowReplay: true, key: "turtle (also accept: tortoise)" },

  // ---- Attention (6): short forward number lists (4 and 5 numbers), letter tap, serial 7s from 100 (MoCA) ----
  { id: "digits_4", type: "speak", domain: "Attention", max: 1, scoredBy: "ai_speech",
    text: "Listen to 4 numbers.\nThen say them back in the same order.",
    say: "Next, some numbers. After you tap Start, I will say four numbers, slowly. When I finish, say them back to me in the same order. Tap Start, and then listen.",
    howTo: ["Tap the green START button.", "Listen to 4 numbers.", "Wait for the chime and SPEAK NOW.",
            "Say the numbers back in the SAME order.", "Tap I'M DONE."],
    sequence: ["5", "8", "2", "6"], sequenceGapMs: 1000, maxSeconds: 15, allowReplay: false, key: "5 8 2 6" },
  { id: "digits_5", type: "speak", domain: "Attention", max: 1, scoredBy: "ai_speech",
    text: "Listen to 5 numbers.\nThen say them back in the same order.",
    say: "Now five numbers. After you tap Start, listen to the numbers. When I finish, say them back in the same order. Tap Start, and then listen.",
    howTo: ["Tap the green START button.", "Listen to 5 numbers.", "Wait for the chime and SPEAK NOW.",
            "Say the numbers back in the SAME order.", "Tap I'M DONE."],
    sequence: ["4", "1", "7", "3", "9"], sequenceGapMs: 1000, maxSeconds: 15, allowReplay: false, key: "4 1 7 3 9" },
  { id: "letters", type: "vigilance", domain: "Attention", max: 1, scoredBy: "app_logic",
    text: "Tap the big button every time you SEE the letter A.",
    say: "Next, letters will appear on the screen, one at a time. Every time you see the letter A, tap the big TAP button. Do not tap for any other letter. Tap Start when you are ready.",
    howTo: ["Tap the green START button.", "Letters appear one at a time.",
            "When you see the letter A, tap the big TAP button.", "Other letters: do NOT tap."],
    letters: LETTERS, target: "A", lures: [], showMs: 2000, gapMs: 300 },  // each letter shown 2 s, then 0.3 s blank
  { id: "serial7", type: "speak", domain: "Attention", max: 3, scoredBy: "ai_speech",
    text: "Start at 100. Take away 7.\nKeep taking away 7. Say 5 answers.",
    say: "Now some subtraction. Start at one hundred, and take away seven. Say the answer. Then take away seven from your answer, and say that. Keep going until you have said five answers. Tap Start, and then begin.",
    howTo: ["Tap the green START button.", "Start at 100. Take away 7. Say the answer.",
            "Take away 7 from THAT answer. Say it.", "Keep going until you have said 5 answers.", "Tap I'M DONE."],
    maxSeconds: 60, allowReplay: true, key: "93, 86, 79, 72, 65" },

  // ---- Language (3): two short sentences said SLOWLY, letter fluency ----
  { id: "sentence_1", type: "speak", domain: "Language", max: 1, scoredBy: "ai_speech",
    text: "Listen to a sentence.\nThen repeat it exactly.",
    say: "Next, I will say a sentence, slowly. Listen to the whole sentence. When you hear the chime, repeat it exactly the way I said it, word for word. Speak slowly and clearly. Tap Start, and then listen.",
    howTo: ["Tap the green START button.", "Listen to the whole sentence. It is said slowly.",
            "Wait for the chime and SPEAK NOW.", "Repeat the sentence word for word, slowly and clearly.", "Tap I'M DONE."],
    sequence: ["The children played in the park after lunch."], sequenceGapMs: 300, seqRate: 100,
    maxSeconds: 18, allowReplay: false, key: "The children played in the park after lunch." },
  { id: "sentence_2", type: "speak", domain: "Language", max: 1, scoredBy: "ai_speech",
    text: "Listen to a sentence.\nThen repeat it exactly.",
    say: "Here is another sentence. Listen to the whole sentence. When you hear the chime, repeat it exactly, word for word. Speak slowly and clearly. Tap Start, and then listen.",
    howTo: ["Tap the green START button.", "Listen to the whole sentence. It is said slowly.",
            "Wait for the chime and SPEAK NOW.", "Repeat the sentence word for word, slowly and clearly.", "Tap I'M DONE."],
    sequence: ["My sister always brings flowers when she visits."], sequenceGapMs: 300, seqRate: 100,
    maxSeconds: 18, allowReplay: false, key: "My sister always brings flowers when she visits." },
  { id: "fluency", type: "speak", domain: "Language", max: 1, scoredBy: "ai_speech",
    text: "Say as many words as you can that start with the letter P.",
    say: "Now, say as many words as you can that begin with the letter P, as in Peter. Do not say names of people or places, and do not say numbers. You will have one minute. Tap Start, and begin talking when the timer starts.",
    howTo: ["Tap the green START button. A 1-minute timer starts.", "Say as many words as you can that begin with P.",
            "No names of people or places (not Peter, not Paris).", "Keep going until the timer ends."],
    maxSeconds: 60, countdown: true, allowReplay: false, key: "11 or more valid words starting with P = 1 point" },

  // ---- Abstraction (2): an example first, as in the MoCA ----
  { id: "abstract_1", type: "speak", domain: "Abstraction", max: 1, scoredBy: "ai_speech",
    text: "How are a CAR and an AIRPLANE alike?\n(Example: an orange and a banana are both fruit.)",
    say: "Next, tell me how two things are alike. For example, an orange and a banana are alike because they are both fruit. Now, how are a car and an airplane alike? Tap Start, and then say your answer.",
    howTo: ["Listen to the example: an orange and a banana are both FRUIT.", "Tap the green START button.",
            "Say how a car and an airplane are alike: what kind of things are they both?", "Tap I'M DONE."],
    maxSeconds: 20, allowReplay: true, key: "both are transportation / ways to travel / vehicles" },
  { id: "abstract_2", type: "speak", domain: "Abstraction", max: 1, scoredBy: "ai_speech",
    text: "How are a CLOCK and a CALENDAR alike?",
    say: "How are a clock and a calendar alike? Tap Start, and then say your answer.",
    howTo: ["Tap the green START button.", "Say how a clock and a calendar are alike: what are they both used for?", "Tap I'M DONE."],
    maxSeconds: 20, allowReplay: true, key: "both tell / measure / keep track of time" },

  // ---- Delayed memory (5): no hints ----
  { id: "recall", type: "speak", domain: "Delayed memory", max: 5, scoredBy: "ai_speech",
    text: "At the start, you heard 5 words two times.\nSay all the words you remember.",
    say: "At the start, I read five words to you, two times. Please say all of those words that you remember, in any order. Tap Start, and then say the words.",
    howTo: ["Think of the 5 words from the start.", "Tap the green START button.",
            "Say all the words you remember. Any order is fine.", "Tap I'M DONE."],
    maxSeconds: 30, allowReplay: false, key: WORDS.join(", ") },
  // Category hints AFTER free recall (0 points; MoCA-style "memory index" research variable).
  { id: "recall_cued", type: "speak", domain: "Memory", max: 0, scoredBy: "ai_speech", countOnly: true,
    text: "Here are some hints.\nSay the 5 words again.",
    say: "Thank you. Here are some hints. One word was a body part. One was a piece of clothing. One was a building. One was a flower. And one was a color. Please say all five words again, including any you already said. Tap Start, and then say the words.",
    howTo: ["Hints: a body part, a piece of clothing, a building, a flower, a color.", "Tap the green START button.",
            "Say all the words you remember, including ones you already said.", "Tap I'M DONE."],
    maxSeconds: 30, allowReplay: false, key: WORDS.join(", ") },

  { id: "end", type: "end", max: 0, scoredBy: "none",
    text: "All done — thank you!\nPlease hand the tablet back.",
    say: "All done. Thank you very much. Please hand the tablet back." },
];
