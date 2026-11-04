// Sizes on a resume, in the user's own words: how wide its columns are, its
// margins, the gap between columns, text size and spacing. Everything but the
// column width is a percentage change on the design's own size.

const NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20, thirty: 30 };
const AMOUNTS = {
  side: { small: 2, normal: 5, large: 10 },
  margin: { small: 5, normal: 10, large: 25 },
  gutter: { small: 10, normal: 25, large: 50 },
  text: { small: 3, normal: 5, large: 10 },
  spacing: { small: 5, normal: 10, large: 20 }
};

const COLUMN_WORD = "col[ou]*[mn]+s?|coulmns?|layouts?|panels?|panes?|parts?|portions?|areas?|bars?|sections?|halves|half|sides?";
const SIDE_TARGETS = [
  ["left", new RegExp(`\\bleft(?:[- ]?hand)?(?:[- ]?(?:${COLUMN_WORD}))?\\b`, "i")],
  ["right", new RegExp(`\\bright(?:[- ]?hand)?(?:[- ]?(?:${COLUMN_WORD}))?\\b`, "i")],
  ["side", /\bside[- ]?(?:bars?|col[ou]*[mn]+s?|panels?|panes?|sections?|areas?|parts?)\b|\b(?:narrow|details?|contact) col[ou]*[mn]+\b/i],
  ["main", /\bmain(?: (?:col[ou]*[mn]+|sections?|areas?|content|parts?|panels?|sides?))?\b|\bcontent col[ou]*[mn]+\b|\b(?:big|wide) col[ou]*[mn]+\b/i]
];
const ANY_COLUMN = /\bcol[ou]*[mn]+s?\b|\bcoulmns?\b|\blayouts?\b|\bwidth\b/i;
const DIVIDER = /\b(?:divider|dividing line|partition|column line|middle line|split(?:ter)?|border between)\b/i;

const UP = /\b(?:increas\w*|rais\w*|bigger|larger|wider|widen\w*|expand\w*|enlarg\w*|grow\w*|extend\w*|stretch\w*|broad\w*|boost\w*|huge|big|large|wide|plus|give|add)\b|(?:^|\s)\+\s*\d/i;
const DOWN = /\b(?:decreas\w*|reduc\w*|lower\w*|smaller|narrow\w*|shrink\w*|thinner|thin|slimmer|slim|tighter|tighten\w*|cut|trim\w*|compress\w*|minimi[sz]e\w*|small|tiny|take|subtract|minus)\b|(?:^|\s)-\s*\d/i;
const TOO_SMALL = /\btoo (?:narrow|small|thin|tiny|short|tight|cramped|little|close)\b|\b(?:is|looks|feels) (?:cramped|squeezed)\b|\bneeds? more\b/i;
const TOO_BIG = /\btoo (?:wide|big|large|fat|much|loose|far|airy)\b/i;
const NOT_A_SIZE_REQUEST = /\b(?:hide|remove|delete|drop|don'?t|do not|never|move|send|place|swap|colou?r)\b|\bput\b(?!.*\b(?:more|less|back)\b)/i;
const ASKS_HOW_BIG = /\bhow (?:wide|big|large|narrow)\b|\bwhat(?:'s| is)?\b.*\b(?:width|size)\b/i;
const REASON_ONLY = /^\s*(?:why|what|when|where|who|did|was|were)\b/i;
const RESET = /\b(?:reset|original|default|normal|undo|restore|as it was|back to)\b/i;

function directionOf(text) {
  if (TOO_SMALL.test(text)) return 1;
  if (TOO_BIG.test(text)) return -1;
  if (/\bless (?:wide|big|large|space|room|tall)\b/i.test(text)) return -1;
  const up = text.search(UP);
  const down = text.search(DOWN);
  if (up >= 0 || down >= 0) {
    if (up < 0) return -1;
    if (down < 0) return 1;
    return up < down ? 1 : -1;
  }
  if (/\bmore\b/i.test(text)) return 1;
  if (/\bless\b/i.test(text)) return -1;
  return 0;
}

const numberWord = `\\b(${Object.keys(NUMBERS).join("|")})\\b`;

// The number asked for, and whether it's a size to reach rather than a change
function numberOf(text) {
  const clean = text.replace(/,/g, "");
  const percent = clean.match(/(\d+(?:\.\d+)?)\s*(?:%|percent(?:age)?(?: points?)?|per cent|pct|points?|pts?)/i)
    || clean.match(new RegExp(`${numberWord}\\s*(?:%|percent|per cent|pct|points?)`, "i"))
    || clean.match(/\bby\s+(\d+(?:\.\d+)?)\b/i)
    || clean.match(new RegExp(`\\bby\\s+${numberWord}`, "i"))
    || clean.match(/[+-]\s*(\d+(?:\.\d+)?)\b/)
    || clean.match(/\b(\d+(?:\.\d+)?)\b/);
  if (!percent) return null;
  const value = NUMBERS[percent[1].toLowerCase()] ?? Number(percent[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const written = percent[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const absolute = new RegExp(`\\b(?:to|at|be|equals?|exactly)\\s+(?:about\\s+|around\\s+)?${written}|${written}\\s*(?:wide|width)\\b|\\bwidth\\s+(?:of\\s+)?${written}|\\bset\\b.*${written}`, "i").test(clean);
  return { value, absolute };
}

const sizeWord = (text, key) => {
  if (/\b(?:a )?(?:little|bit|slightly|tad|touch)\b/i.test(text)) return AMOUNTS[key].small;
  if (/\b(?:a lot|much|way|very|really|significantly|huge)\b/i.test(text)) return AMOUNTS[key].large;
  return AMOUNTS[key].normal;
};

function keyOf(text) {
  if (/\b(?:gaps?|gutter|space|spacing|room)\b.*\bbetween\b.*\b(?:col[ou]*[mn]+s?|left and right)\b|\bcol[ou]*[mn]+ (?:gaps?|gutter|spacing)\b|\bgutter\b/i.test(text)) return "gutter";
  if (/\bmargins?\b|\bpadding\b|\bwhite ?space\b|\bpage edges?\b/i.test(text)) return "margin";
  if (/\b(?:fonts?|letters?|text size|size of (?:the )?text|text)\b/i.test(text)) {
    if (/\b(?:fonts?|text size|size of (?:the )?text)\b/i.test(text)) return "text";
    if (/\b(?:bigger|smaller|larger|tiny|huge|big|small|large)\b/i.test(text)) return "text";
    return null;
  }
  if (/\bline[- ]?(?:spacing|height|gaps?)\b|\bspacing\b|\bspace between (?:the )?(?:lines?|sections?|entries|items)\b/i.test(text)) return "spacing";
  if (DIVIDER.test(text) || SIDE_TARGETS.some(([, words]) => words.test(text))) return "side";
  if (/\b(?:tight(?:er|en)?|compact|airy|airier|spacious|breathing room|loose(?:r|n)?)\b/i.test(text)) return "spacing";
  if (ANY_COLUMN.test(text)) return "side";
  return null;
}

function firstTarget(text) {
  const found = SIDE_TARGETS
    .map(([id, words]) => [id, text.search(words)])
    .filter(([, at]) => at >= 0)
    .sort((a, b) => a[1] - b[1]);
  return found[0]?.[0] || null;
}

// "60/40", "left 40 right 60", "equal columns": { left: <its share of the page> }
function splitOf(text) {
  if (/\b(?:equal|same (?:size|width)|even(?:ly)?|half and half)\b|\b50\s*[/:-]\s*50\b/i.test(text) && (ANY_COLUMN.test(text) || /\b50\s*[/:-]\s*50\b|\bleft\b.*\bright\b|\bboth\b/i.test(text))) return 50;
  const named = text.match(/\bleft\D{0,14}(\d{2})\s*%?.*\bright\D{0,14}(\d{2})\b/i);
  if (named && Number(named[1]) + Number(named[2]) === 100) return Number(named[1]);
  const flipped = text.match(/\bright\D{0,14}(\d{2})\s*%?.*\bleft\D{0,14}(\d{2})\b/i);
  if (flipped && Number(flipped[1]) + Number(flipped[2]) === 100) return Number(flipped[2]);
  const pair = text.match(/\b(\d{2})\s*%?\s*(?:[/:-]|by|and|to)\s*(\d{2})\b/i);
  if (pair && Number(pair[1]) + Number(pair[2]) === 100 && (ANY_COLUMN.test(text) || /\bsplit\b/i.test(text))) return Number(pair[1]);
  return null;
}

// One ask, or null when these words aren't about a size. `whole` is the full
// message: "make margins and spacing smaller" says "smaller" only once.
function readOne(segment, whole = segment, sectionWords = null) {
  const said = segment.replace(/\bright (?:now|away|here|there|way|one|thing|choice)\b|\b(?:that'?s|is that) right\b/gi, " ");
  if (NOT_A_SIZE_REQUEST.test(said) && !DIVIDER.test(said)) return null;
  if (/\bname\b/i.test(said)) return null;
  const left = splitOf(said);
  if (left !== null) return { key: "side", target: "left", to: left };
  const key = keyOf(said);
  if (!key) return null;

  const target = key === "side" ? firstTarget(said) : null;
  // A section named ("make Skills bigger in the right column") isn't the column
  const section = key === "side" && sectionWords?.test(said.replace(/\bsections?\b/gi, " "));
  if (section) return null;
  if (key === "side" && ASKS_HOW_BIG.test(said)) return target ? { key, target, info: true } : { key, target: "side", info: true };
  if (REASON_ONLY.test(said) && !/\b(?:can|could|would|please)\b/i.test(said)) return null;
  if (RESET.test(said) && !directionOf(said.replace(RESET, " "))) return { key, target: target || "side", reset: true };

  if (key === "side" && DIVIDER.test(said)) {
    const to = said.match(/\b(?:to|towards?)\s+(?:the\s+)?(left|right)\b/i)?.[1] || said.match(/\b(left|right)\b/i)?.[1];
    if (!to) return { key, which: true };
    const number = numberOf(said) || numberOf(whole);
    return { key, target: to.toLowerCase() === "right" ? "left" : "right", by: number?.value ?? sizeWord(said, key), amountNamed: Boolean(number) };
  }

  // A number said once can cover two parts ("make margins and spacing smaller
  // by 10%", "widen right and shrink left by 6%"), but not a part with its own ask
  const fragment = !directionOf(said) || (key === "side" && /\bleft\b.*\bright\b|\bright\b.*\bleft\b/i.test(whole));
  const number = numberOf(said) || (said !== whole && fragment ? numberOf(whole) : null);
  const inches = key === "margin" && said.match(/(\d*\.?\d+)\s*(?:in\b|inch(?:es)?\b|")/i);
  if (inches) return { key, percent: Math.round((Number(inches[1]) / 0.5 - 1) * 100), inches: Number(inches[1]) };
  const points = key === "text" && said.match(/(\d+(?:\.\d+)?)\s*(?:pt\b|points?\b)|\bsize\s+(\d+(?:\.\d+)?)\b/i);
  if (points) return { key, percent: Math.round((Number(points[1] || points[2]) / 10 - 1) * 100), points: Number(points[1] || points[2]) };

  let direction = directionOf(said) || directionOf(whole);
  if (/\b(?:tight(?:er|en)?|compact)\b/i.test(said) && key === "spacing") direction = -1;
  if (/\b(?:airy|airier|spacious|breathing room|loose(?:r|n)?)\b/i.test(said) && key === "spacing") direction = 1;

  if (key === "side") {
    if (!target) return { key, which: true };
    if (number?.absolute || (number && !direction && number.value >= 20)) return { key, target, to: number.value };
    if (!direction) return /\b(?:width|size)\b/i.test(said) ? { key, target, askHow: true } : null;
    return { key, target, by: direction * (number?.value ?? sizeWord(said, key)), amountNamed: Boolean(number) };
  }

  if (!direction) return key === "text" && !/\bsize\b/i.test(said) ? null : { key, askHow: true };
  return { key, by: direction * (number?.value ?? sizeWord(said, key)), amountNamed: Boolean(number) };
}

// { asks, rest }: the size asks in a message, and the words left for the other rules
function readLayoutAsks(message, sectionWords = null) {
  const whole = String(message || "").trim();
  if (!whole) return null;
  if (/\b(?:reset|undo|restore|original|default)\b.*\blayout\b|\blayout\b.*\b(?:reset|undo|original|default)\b/i.test(whole) && !firstTarget(whole.replace(/\blayout\b/i, ""))) {
    return { asks: [{ key: "all", reset: true }], rest: "" };
  }

  const segments = whole.split(/\s*(?:\band then\b|\bthen\b|\balso\b|\band\b|[,;])\s*/i).filter(Boolean);
  const asks = [];
  const rest = [];
  for (const segment of segments) {
    const ask = readOne(segment, whole, sectionWords);
    if (!ask) rest.push(segment);
    else if (!asks.some((other) => other.key === ask.key)) asks.push(ask);
  }
  // "60 and 40 columns" only makes sense read whole
  const together = readOne(whole, whole, sectionWords);
  if (together?.to !== undefined && !asks.some((ask) => ask.key === "side" && ask.to !== undefined)) return { asks: [together], rest: "" };
  if (!asks.length) return together && segments.length === 1 ? { asks: [together], rest: "" } : null;
  return { asks, rest: rest.join(" and ") };
}

const SIDE_MIN = 20;
const SIDE_MAX = 50;
const SCALE_LIMITS = { margin: [-60, 100], gutter: [-60, 150], text: [-20, 30], spacing: [-25, 40] };
const SCALE_NAMES = {
  margin: ["the margins", "wider", "narrower"],
  gutter: ["the gap between the columns", "wider", "narrower"],
  text: ["the text", "bigger", "smaller"],
  spacing: ["the spacing", "roomier", "tighter"]
};
const COLUMN_NAMES = { left: "left column", right: "right column", side: "sidebar", main: "main column" };
const within = (value, [low, high]) => Math.min(high, Math.max(low, value));
const rounded = (value) => Math.round(value * 10) / 10;

// What the asks change: { tweaks, done, notes }. current: this resume's tweaks;
// base: its design's sidebar width; layout: "left", "right" or "single".
function layoutChanges(asks, { current = {}, base = 32, layout = "", scope = "this" }) {
  const tweaks = {};
  const done = [];
  const notes = [];

  for (const ask of asks) {
    if (ask.key === "all") {
      for (const key of ["sideShift", "margin", "gutter", "text", "spacing"]) tweaks[key] = 0;
      done.push("put the column widths, margins, spacing and text size back to this design's own");
      continue;
    }

    if (ask.key !== "side") {
      if (ask.askHow) {
        const [name, up, down] = SCALE_NAMES[ask.key];
        notes.push(`Should ${name} be ${up} or ${down}? You can give an amount too, like "make ${name} ${up} by 10%".`);
        continue;
      }
      const [name, up, down] = SCALE_NAMES[ask.key];
      const now = current[ask.key] || 0;
      const wanted = ask.reset ? 0 : ask.percent ?? now + ask.by;
      const next = rounded(within(wanted, SCALE_LIMITS[ask.key]));
      tweaks[ask.key] = next;
      if (ask.reset) done.push(`put ${name} back to this design's own`);
      else if (next === now) notes.push(`${name[0].toUpperCase()}${name.slice(1)} can't go any further that way.`);
      else {
        const asked = ask.inches ? ` (about ${ask.inches} in)` : ask.points ? ` (about ${ask.points} pt)` : ` (${100 + next}% of this design's size)`;
        done.push(`made ${name} ${next > now ? up : down}${asked}`);
        if (wanted !== next) notes.push(`That's as far as ${name} can go.`);
      }
      continue;
    }

    if (scope === "portfolio") {
      notes.push("Column widths are only on resumes: ask for it on a resume instead of your portfolio.");
      continue;
    }
    if (ask.which) {
      notes.push(`Which column should change? Try "make the right column wider by 5%", "make the left column narrower", or "make the sidebar 40%".`);
      continue;
    }
    if (ask.askHow) {
      notes.push(`Should the ${COLUMN_NAMES[ask.target]} be wider or narrower? Try "make the ${COLUMN_NAMES[ask.target]} wider by 5%" or "make it 40% wide".`);
      continue;
    }
    if (layout === "single" && scope === "this") {
      notes.push("This design has one column, so there's no column width to change. Open a two-column design to do that. I can change its margins, text size or spacing.");
      continue;
    }
    if (scope === "all" && (["left", "right"].includes(ask.target) || ask.to !== undefined)) {
      if (!ask.reset) {
        notes.push(`Sidebars sit on different sides and start at different widths across designs, so for every resume say "make the sidebar wider by 5%". Or ask on one resume for an exact column or width.`);
        continue;
      }
    }

    const now = current.sideShift || 0;
    if (ask.reset) {
      tweaks.sideShift = 0;
      done.push("put the column widths back to this design's own");
      continue;
    }

    const isSide = ask.target === "side" || ask.target === layout;
    const width = base + now;
    const share = (side, target) => (target ? side : 100 - side);
    if (ask.info) {
      const leftWidth = layout === "right" ? 100 - width : width;
      notes.push(`The left column is ${rounded(leftWidth)}% of the page and the right is ${rounded(100 - leftWidth)}%. Tell me a new size, like "make the right column wider by 5%".`);
      continue;
    }
    const wanted = ask.to !== undefined ? (isSide ? ask.to : 100 - ask.to) : width + (isSide ? ask.by : -ask.by);
    const next = within(wanted, [SIDE_MIN, SIDE_MAX]);
    const name = COLUMN_NAMES[ask.target];

    if (next === width) {
      notes.push(`The ${name} can't go any further that way: a sidebar stays between ${SIDE_MIN}% and ${SIDE_MAX}% of the page.`);
      continue;
    }

    tweaks.sideShift = rounded(next - base);
    const before = rounded(share(width, isSide));
    const after = rounded(share(next, isSide));
    done.push(scope === "all"
      ? `made the ${name} ${after > before ? "wider" : "narrower"} by ${rounded(Math.abs(after - before))}% of the page`
      : `made the ${name} ${after > before ? "wider" : "narrower"} (${after}% of the page, was ${before}%)`);
    if (wanted !== next) notes.push(`That's as far as it goes: a sidebar stays between ${SIDE_MIN}% and ${SIDE_MAX}% of the page.`);
    else if (ask.amountNamed === false) notes.push("You didn't give an amount, so I used a small step. Tell me a number if you'd like a different size.");
  }

  return { tweaks, done, notes };
}

module.exports = { readLayoutAsks, layoutChanges };
