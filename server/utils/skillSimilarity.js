// Rule-based look-alike detection for skill names, used with or without AI.

// "React.js", "ReactJS" and "react" all become "react";
// "Node JS" and "node.js" become "node"
function compactSkillName(name) {
  return name
    .toLowerCase()
    .replace(/[\s._-]+/g, "")
    .replace(/js$/, "") || name.toLowerCase();
}

// Edit distance where swapping two neighbouring letters ("pyhton") is
// one typo, not two (optimal string alignment)
function editDistance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + cost
      );

      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }

  return rows[a.length][b.length];
}

// Typos allowed for a name of this length. Short names ("C", "R", "Go")
// must match exactly so "C" and "C#" stay different skills.
const allowedDistance = (length) => (length <= 3 ? 0 : length <= 6 ? 1 : 2);

// Candidates that look like the same skill, closest first.
// candidates: [{ name, ... }]
function findSimilar(name, candidates, limit = 3) {
  const target = compactSkillName(name);
  const allowed = allowedDistance(target.length);

  return candidates
    .map((candidate) => ({
      candidate,
      distance: editDistance(target, compactSkillName(candidate.name))
    }))
    .filter(({ distance }) => distance <= allowed)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

module.exports = { compactSkillName, editDistance, findSimilar };
