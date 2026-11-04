// How each portfolio design's hero summary should sound, and how many words
// fit its hero. The ids match client/src/pages/Portfolio/designs.js.
//
// A voice changes the framing and tone only: the facts always come from the
// person's portfolio, and the summary stays plain, professional English a
// recruiter can read.

const HERO_VOICES = {
  mono: { words: [16, 24], voice: "Minimal and exact. Two short, plain sentences; no adjectives." },
  midnight: { words: [22, 34], voice: "Confident and modern, with a little shine. Lead with what gets built." },
  editorial: { words: [24, 36], voice: "A magazine standfirst: an elegant sentence that invites reading on." },
  fresh: { words: [20, 30], voice: "Friendly and upbeat, warm but still professional." },
  terminal: { words: [14, 22], voice: "Like a program's one-line description: terse, technical, lowercase-friendly but grammatical." },
  aurora: { words: [20, 30], voice: "Calm and polished, soft-spoken confidence." },
  brutal: { words: [12, 20], voice: "Blunt and punchy. Very short sentences. Facts only." },
  bento: { words: [18, 28], voice: "Product-page crisp: what is built and what it achieves, in tidy clauses." },
  swiss: { words: [12, 20], voice: "Strict and spare. Short declarative statements, no flourish." },
  sidebar: { words: [18, 28], voice: "A clear professional profile line for a sidebar card." },
  neon: { words: [16, 26], voice: "Energetic and bold, high-voltage verbs, still factual." },
  notebook: { words: [18, 28], voice: "A handwritten note: personal and direct, written in the third person." },
  essay: { words: [26, 38], voice: "A thoughtful blog intro: reflective, readable, one idea flowing into the next." },
  timeline: { words: [22, 32], voice: "Frames the career as a journey: where the work started and where it is heading." },
  executive: { words: [22, 32], voice: "Formal and authoritative, boardroom tone: scope, ownership and results." },
  retro: { words: [16, 24], voice: "A friendly 'About this computer' readme: plain, a touch nostalgic." },
  studio: { words: [16, 26], voice: "A showreel caption: what gets made, said with craft." },
  split: { words: [20, 30], voice: "Bold statement first, supporting detail second." },
  resume: { words: [24, 36], voice: "A classic resume profile statement: precise, conventional, scannable." },
  blueprint: { words: [18, 28], voice: "An engineering spec note: systems, components and specifications." },
  zen: { words: [12, 20], voice: "Calm and spare, like a haiku in prose. Few words, each one chosen." },
  gazette: { words: [16, 26], voice: "A newspaper deck under a headline: news-style, present tense, factual." },
  polaroid: { words: [14, 22], voice: "A caption written on an instant photo: casual and warm." },
  arcade: { words: [14, 22], voice: "A game character bio: playful, with light game words (level, quest, stage), still factual." },
  cosmos: { words: [18, 28], voice: "Expansive and curious, with a light space metaphor (orbit, launch, explore)." },
  ledger: { words: [16, 26], voice: "An account statement memo: dry, itemised, precise." },
  boarding: { words: [14, 22], voice: "A travel announcement: now boarding, destination, light travel words." },
  metro: { words: [14, 22], voice: "A transit line description: the stops this career connects." },
  museum: { words: [20, 30], voice: "A gallery wall text: curatorial, describing the body of work." },
  vinyl: { words: [16, 24], voice: "Album liner notes: the sound of the work, a light music metaphor." },
  botanical: { words: [18, 28], voice: "A specimen description: observant, naturalist tone, a light growth metaphor." },
  memphis: { words: [12, 20], voice: "Loud, cheerful and punchy. Short bursts." },
  launch: { words: [16, 26], voice: "A product landing-page subheadline: the value delivered, benefit-led." },
  dossier: { words: [16, 26], voice: "A case-file briefing: terse, observational, third person ('Subject')." },
  noir: { words: [16, 26], voice: "A film logline: dramatic and cinematic, but every fact true." },
  candy: { words: [14, 22], voice: "Sweet, bubbly and kind, still professional." },
  circuit: { words: [14, 22], voice: "A component datasheet line: function, interfaces, output." },
  ide: { words: [14, 22], voice: "A code comment or README tagline: concise and technical." },
  atlas: { words: [18, 28], voice: "An explorer's map legend: terrain covered and routes ahead." },
  slate: { words: [20, 30], voice: "A professional network 'About' opener: clear, credible, approachable." },
  receipt: { words: [12, 20], voice: "A printed receipt footer: short, itemised and dry, with a light wink." },
  postcard: { words: [16, 26], voice: "A note on a postcard: warm and first person, still factual." },
  riso: { words: [12, 20], voice: "A gig poster line: bold, direct and full of energy." },
  kanban: { words: [16, 26], voice: "A project board description: what is in progress and what gets shipped." },
  atelier: { words: [14, 22], voice: "A fashion house note: refined and spare, focused on craft." },

  // Not a design: the short summary at the top of the designed resumes. Its
  // own angle and facts, the way a resume summary is written.
  resume: {
    words: [38, 70],
    sentences: [3, 4],
    voice: "A resume's professional summary: confident, factual and concise, in the implied first person without pronouns.",
    angle: "Write 3 or 4 sentences: (1) the job title and years of experience; (2) what the candidate builds; (3) the key skills, tied to that work; (4) one measured result.",
    uses: ["identity", "builds", "skills", "result"],
    skills: 4
  }
};

// The designs (everything but the resume summary)
const DESIGN_IDS = Object.keys(HERO_VOICES).filter((id) => id !== "resume");

const DEFAULT_VOICE = { words: [18, 30], voice: "Clear, professional and specific." };

const voiceOf = (designId) => HERO_VOICES[designId] || DEFAULT_VOICE;
const isDesignId = (value) => typeof value === "string" && Object.hasOwn(HERO_VOICES, value);

module.exports = { HERO_VOICES, DESIGN_IDS, voiceOf, isDesignId };
