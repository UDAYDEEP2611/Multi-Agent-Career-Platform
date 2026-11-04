// Resume changes for a job, ordered by expected impact:
//   Priority 1  parsing errors (what an ATS reads wrong or can't find)
//   Priority 2  required capabilities: make real evidence easy to see
//   Priority 3  responsibility alignment
//   Priority 4  preferred capabilities already supported by experience
//   Priority 5  keyword consistency, without stuffing
// Written by code from the assessment and ATS check. Advice never assumes the
// candidate has a skill: missing items say "if you have it", and nothing
// suggests inventing experience, dates, metrics or credentials.
// Each item: { priority, area, issue, recommendation, type }. type keeps
// three different situations apart:
//   gap            not demonstrated, and not confirmed: a genuine gap
//   documentation  the experience is there (inferred, listed, related) but
//                  the resume doesn't show it clearly
//   confirmed      you said you have it; the resume doesn't say so yet

const PRIORITY_LABELS = { 1: "Parsing errors", 2: "Required capabilities", 3: "Responsibility alignment", 4: "Preferred capabilities", 5: "Keyword consistency" };
// Points are never negative: what isn't shown earns 0 of what it could
const earned = (item) => (item.pointsLost ? ` (earns ${item.points ?? 0} of ${Math.round(((item.points ?? 0) + item.pointsLost) * 10) / 10} pts)` : "");
const quote = (text, max = 110) => `"${text.length > max ? `${text.slice(0, max - 1)}…` : text}"`;

const PROFILE_ADVICE = {
  Name: "Put your full name as the first line of the resume, as plain text.",
  Email: "Add your email near your name, as plain text (not in an image or the page header).",
  LinkedIn: "Add your LinkedIn URL to the contact line (e.g. linkedin.com/in/your-name).",
  Role: "Add a one-line headline under your name with your professional title.",
  Summary: "Add a 3–4 sentence summary under a \"Summary\" heading.",
  Experience: "List your jobs under an \"Experience\" heading: company, title, dates, then bullets.",
  Education: "Add an \"Education\" section with your degree, school and year."
};

// Advice for one term inside a requirement
function termAdvice(term) {
  if (term.match === "inferred") return `${term.term}: strongly inferred. Your resume shows ${term.via}, which normally involves it. ${term.confirm || "Confirm you used it; if so, make it explicit."}`;
  if (term.match === "confirmed") return `${term.term}: confirmed by you but not on the resume. Add it to the bullet about the work where you used it.`;
  if (term.match === "confirm") return `${term.term}: plausible from ${term.via}, but not established. ${term.confirm || "If it's true, say so explicitly."}`;
  if (term.match === "missing") return `${term.term}: not demonstrated on the resume. If you've used it, name it in the bullet about that work; if not, don't add it.${term.uncertain ? ` (The engine doesn't know ${term.term}, so a related skill you have may not have been recognized.)` : ""}`;
  if (term.match === "listed") return `${term.term}: only listed. Show it in a bullet about real work (what you did with it and the outcome).`;
  if (term.match === "related" || term.match === "partial") return `${term.term}: credited through ${term.via}. ${term.note || ""} If you've also used ${term.term} itself, say so explicitly.`;
  if (term.match === "equivalent") return `${term.term}: shown as ${term.via}. Write "${term.term}" next to it where accurate, so both people and ATS see the match.`;
  return "";
}

// Which of the three situations a requirement is in
const parts = (item) => [...(item.terms || []).filter((term) => !term.alternative && !term.alternativeLikely), ...(item.capabilities || [])];
function typeOf(item) {
  const all = parts(item);
  if (item.confirmedByCandidate || all.some((part) => part.match === "confirmed")) return "confirmed";
  if (item.match === "missing" || (all.length && all.every((part) => ["missing", "uncertain"].includes(part.match)))) return "gap";
  return item.kind === "years" || item.kind === "degree" ? "gap" : "documentation";
}

function requirementAdvice(item) {
  if (item.kind === "years") {
    if (item.status === "Unknown") return "Give every job month and year dates so your experience can be counted.";
    const { requested, demonstrated, shortfall, coverage, field } = item.years || {};
    const summary = item.years ? `${demonstrated} of ${requested} years shown${field && field !== "any professional work" ? ` in ${field}` : ""} (${shortfall} short, ${coverage}% coverage). ` : "";
    const next = item.nearMatch
      ? "Consider applying if the employer treats the experience requirement flexibly."
      : "If you have more relevant experience (contracts, part-time or earlier roles), list it with month and year dates.";
    return `${summary}${next} Don't stretch dates; if you have equivalent experience or education, say so in your summary.`;
  }
  if (item.kind === "practice") return item.reason;
  if (item.kind === "degree") return "List your degree with its full name, school and year. If you have equivalent experience, the job may accept it; don't claim a degree you don't hold.";
  const parts = [];
  for (const capability of (item.capabilities || []).filter((entry) => entry.score < 0.95)) {
    if (capability.match === "confirm") parts.push(`${capability.capability}: ${capability.reason || "not established; review whether your work involved it."} If it did, say who you worked with and on what.`);
    else if (capability.match === "confirmed") parts.push(`${capability.capability}: ${capability.reason}`);
    else if (capability.score === 0) parts.push(`${capability.capability}: not demonstrated. If you've done it, add what you did (metrics, tools, results) to the relevant job.`);
    else parts.push(`${capability.capability}: only partly shown in ${quote(capability.evidence[0]?.text || "", 80)}. Say it more directly.`);
  }
  // "Azure or AWS": one piece of advice for the group, about the alternative that counted
  const alternativeGroups = (item.logic || []).filter((group) => group.mode === "any" && group.terms.length > 1);
  for (const group of alternativeGroups) {
    const best = (item.terms || []).find((term) => term.term === group.best);
    if (!best || best.score >= 0.95) continue;
    // Tied alternatives (Azure and AWS both only listed): name them all, prefer neither
    const tied = (item.terms || []).filter((term) => group.terms.includes(term.term) && term.score === best.score).map((term) => term.term);
    parts.push(best.score > 0
      ? `The job accepts any of ${group.terms.join(" / ")}; ${tied.length > 1 ? `${tied.join(" and ")} are` : `${best.term} is`} ${best.match === "listed" ? "listed but not shown in work" : `shown as ${best.match}`}. Show whichever one you actually used in a work bullet; one is enough.`
      : `The job accepts any of ${group.terms.join(" / ")}; none is demonstrated. If you've used one, name it in the bullet about that work.`);
  }
  const grouped = new Set(alternativeGroups.flatMap((group) => group.terms));
  if (item.terms?.length) parts.push(...item.terms.filter((term) => term.match !== "direct" && !term.alternative && !grouped.has(term.term)).map(termAdvice).filter(Boolean));
  if (parts.length) return parts.join(" ");
  if (item.match === "missing") return "If this is true for you, add a bullet under the job where you did it, using the job's wording.";
  return item.evidence?.[0] ? `Make ${quote(item.evidence[0].text, 90)} say this more directly.` : "Make the closest bullet say this more directly.";
}

// assessment: compareResume() output; ats: atsFileCheck() output
function recommendationsFor(assessment, ats) {
  const list = [];
  const add = (priority, area, issue, recommendation, type = "documentation") => recommendation && list.push({ priority, priorityLabel: PRIORITY_LABELS[priority], area, issue, recommendation, type });

  // Priority 1: parsing errors (not qualification gaps)
  for (const issue of assessment.findings.parsingIssues || []) add(1, "Parsing", issue, "Fix the layout or dates so each bullet sits under its own job with its own dates, then compare again.", "parsing");
  for (const item of assessment.profile) {
    if (!item.found && item.required && PROFILE_ADVICE[item.field]) add(1, "Parsing", `No ${item.field.toLowerCase()} could be read from the resume.`, PROFILE_ADVICE[item.field], "parsing");
  }
  for (const item of ats.checks) {
    if (item.status === "pass" || item.id === "keywords") continue;
    add(item.status === "fail" ? 1 : 5, "ATS", item.label, item.detail, "parsing");
  }

  // Priority 2 and 4: required and preferred qualifications not fully shown
  for (const [key, priority] of [["required", 2], ["education", 2], ["preferred", 4]]) {
    for (const item of assessment.categories[key].items) {
      if (item.score >= 0.95 || item.duplicate || item.unverified) continue;
      const label = item.kind === "years" ? `${item.status}${item.nearMatch ? " (strong near-match)" : ""}` : item.satisfaction === "Ambiguous" || item.satisfaction === "Likely satisfied" ? `${item.satisfaction}: all or any one? (${Math.round(item.score * 100)}%, weighing both readings)` : item.satisfaction === "Not satisfied" && item.score > 0 ? `Not satisfied (${Math.round(item.score * 100)}% coverage)` : item.match === "missing" ? "Not demonstrated" : "Partly demonstrated";
      add(priority, assessment.categories[key].label, `${label}: ${quote(item.text)}${earned(item)}`, requirementAdvice(item), typeOf(item));
    }
  }

  // Priority 3: responsibilities
  for (const item of assessment.categories.responsibilities.items) {
    if (item.score >= 0.95 || item.duplicate || item.unverified) continue;
    add(3, "Responsibilities", `${item.satisfaction === "Not satisfied" && item.score > 0 ? `Not satisfied (${Math.round(item.score * 100)}% coverage)` : item.match === "missing" ? "Not demonstrated" : "Partly demonstrated"}: ${quote(item.text)}${earned(item)}`, requirementAdvice(item), typeOf(item));
  }

  // Seniority and domain notes are context, at priority 3
  for (const flag of assessment.findings.seniority) add(3, "Seniority", flag, "Make the scope of your work clear in your bullets (ownership, architecture, people led) so the level reads accurately.");
  for (const note of assessment.findings.domain) add(4, "Domain", note, "If you've worked with these, mention them where accurate; otherwise highlight transferable work and don't claim field-specific knowledge.");

  // Tools used while working (Claude Code, Copilot): not scored, worth stating if true
  for (const text of assessment.findings.unverified || []) {
    add(5, "Unverified", `Can't be verified from a resume: ${quote(text)}`, "If you use these tools, name them in a bullet about the work (what you built with them); if you don't, be ready to discuss them.", "documentation");
  }

  // Priority 5: the job's wording for skills you already show under another name
  for (const item of assessment.keywords.items) {
    if (!item.present && ["equivalent", "related"].includes(item.match)) {
      // Shown through several parts (MLOps through training, deployment, monitoring): name it once
      const parts = item.via.includes(",");
      add(5, "Keywords", `The job says "${item.text}"; the resume shows ${item.via}.`, parts
        ? `Where accurate, name ${item.text} in the bullet that describes that work, so people and ATS see the term. Don't add terms you can't back up.`
        : `Where accurate, use the job's term alongside yours (e.g. "${item.via} (${item.text})"). Don't add terms you can't back up.`, "documentation");
    }
  }

  return list.sort((a, b) => a.priority - b.priority);
}

module.exports = { recommendationsFor, PRIORITY_LABELS };
