// Two switches on every portfolio entry: whether it shows on the portfolio
// websites and whether it goes on resumes. Both default to shown; entries
// saved before these existed have neither field, which also means shown.

function visibilityPlugin(schema) {
  schema.add({
    showInPortfolio: { type: Boolean, default: true },
    showInResume: { type: Boolean, default: true }
  });
}

// Shown unless switched off (missing counts as shown)
const shownIn = (entry, audience) =>
  audience === "portfolio" ? entry?.showInPortfolio !== false
    : audience === "resume" ? entry?.showInResume !== false
      : true;

module.exports = { visibilityPlugin, shownIn };
