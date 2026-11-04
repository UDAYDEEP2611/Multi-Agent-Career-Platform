// How the summary sits on the page: 4 to 6 lines, and a last line that
// isn't a few stray words ("…by 27%." alone on a line)
export const SUMMARY_LINES = { min: 4, max: 6 };
const MIN_LAST_FILL = 0.4;
const MIN_LAST_WORDS = 4;

// Measures the rendered summary: { lines, words, lastWords, fill }, where
// fill is how much of the last line's width the text covers
export function measureSummary(element) {
  const box = element?.getBoundingClientRect();
  if (!box?.width) return null;

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  const lines = [];
  let words = 0;

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    for (const match of node.textContent.matchAll(/\S+/g)) {
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      const rect = range.getBoundingClientRect();
      const line = lines[lines.length - 1];
      words += 1;

      if (line && Math.abs(rect.top - line.top) < rect.height / 2) {
        line.words += 1;
        line.right = Math.max(line.right, rect.right);
      } else {
        lines.push({ top: rect.top, words: 1, right: rect.right });
      }
    }
  }

  if (!lines.length) return null;
  const last = lines[lines.length - 1];
  return { lines: lines.length, words, lastWords: last.words, fill: (last.right - box.left) / box.width };
}

export const fitsLines = (m) =>
  m.lines >= SUMMARY_LINES.min && m.lines <= SUMMARY_LINES.max &&
  m.fill >= MIN_LAST_FILL && m.lastWords >= MIN_LAST_WORDS;

// Lower is better: used to keep the best version if none fits exactly
export const fitScore = (m) =>
  (m.lines < SUMMARY_LINES.min || m.lines > SUMMARY_LINES.max ? 2 : 0) +
  Math.max(0, MIN_LAST_FILL - m.fill) +
  (m.lastWords < MIN_LAST_WORDS ? 1 : 0);

// The word count that fills whole lines with a last line about 3/4 full,
// and a note for the model on how it looks now
export function fitRequest(m) {
  const perLine = m.words / (m.lines - 1 + m.fill);
  let lineUnits;
  if (m.lines < SUMMARY_LINES.min) lineUnits = SUMMARY_LINES.min - 0.25;
  else if (m.lines > SUMMARY_LINES.max) lineUnits = SUMMARY_LINES.max - 0.25;
  // Short last line: fill it out, or drop it when already at 6 lines
  else if (m.lines < SUMMARY_LINES.max) lineUnits = m.lines - 0.25;
  else lineUnits = m.lines - 1.25;

  const targetWords = Math.min(160, Math.max(30, Math.round(perLine * lineUnits)));
  const targetLines = Math.ceil(lineUnits);
  const feedback = `On the page it fills ${m.lines} lines of about ${Math.round(perLine)} words, ` +
    `and the last line has only ${m.lastWords} word${m.lastWords === 1 ? "" : "s"}. ` +
    `Rephrase to about ${targetWords} words so it fills ${targetLines} full lines with a fuller last line.`;
  return { targetWords, feedback };
}
