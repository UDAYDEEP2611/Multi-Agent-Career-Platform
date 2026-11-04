// The job's title and company, read from a pasted job description (no AI).
// Job boards add lines like "About the job" or "Job description" above the
// posting, so those are skipped; labeled lines ("Job Title: ...") win.

const BOILERPLATE = /^(about the (job|role|position|team|company)|job (description|details|summary|overview|posting)|position (overview|summary|description)|overview|description|the role|role|summary|apply|save|share|easy apply|full[- ]time|part[- ]time|remote|hybrid|on[- ]?site|\$|\d)/i;
const TITLE_WORDS = /\b(engineer|developer|scientist|analyst|manager|designer|architect|specialist|consultant|administrator|lead|director|nurse|technician|coordinator|accountant|associate|intern|officer|representative|advisor|assistant|programmer|strategist|researcher|editor|writer|teacher|therapist|pharmacist|recruiter|operator)s?\b/i;
const NOT_COMPANY = /^(the|this|our|we|you|your|us|job|role|team|company|position|candidate|benefits|equal|all|an?|it|in|on|at|for)$/i;

const clean = (text) => text.replace(/\s+/g, " ").replace(/^[\s:|–—-]+|[\s:|,–—-]+$/g, "").trim();
const words = (text) => text.split(/\s+/).filter(Boolean).length;

function titleOf(lines, text) {
  const labeled = text.match(/^\s*(?:job title|position|title|role)\s*:\s*([^\n]{3,80})$/im);
  if (labeled) return clean(labeled[1]);
  // The first short line that names a job ("AI/ML Engineer - Junior", "Senior Data Engineer at Acme")
  for (const line of lines.slice(0, 8)) {
    if (BOILERPLATE.test(line) || words(line) > 10 || /[.!?]$/.test(line)) continue;
    const title = clean(line.split(/\s+(?:at|@)\s+|\s+[|·]\s+|,\s/)[0]);
    if (TITLE_WORDS.test(title) && words(title) <= 8) return title;
  }
  // "The AI Engineer designs, develops...", "hiring a Product Designer", "seeking an Accountant"
  const role = "((?:[A-Z][\\w/&+-]*\\s+){0,4}[A-Z][\\w/&+-]*)";
  for (const pattern of [
    new RegExp(`\\b(?:[Tt]he|[Tt]his|[Oo]ur)\\s+${role}\\s+(?:will|is|designs|develops|builds|works|leads|joins|partners|supports)\\b`),
    new RegExp(`\\b(?:hiring|seeking|looking for|recruiting)\\s+an?\\s+${role}`)
  ]) {
    for (const found of text.matchAll(new RegExp(pattern.source, "g"))) {
      // The title ends at its job word ("Product Designer to join" -> "Product Designer")
      const words = found[1].split(/\s+/);
      const end = words.map((word) => TITLE_WORDS.test(word)).lastIndexOf(true);
      if (end >= 0) return clean(words.slice(0, end + 1).join(" "));
    }
  }
  return "";
}

function companyOf(lines, text) {
  const name = "([A-Z][\\w&.'-]*(?:[ \\t]+(?:[A-Z][\\w&.'-]*|&|of|and)){0,4})";
  const patterns = [
    /^\s*(?:company|employer|organization|company name)\s*:\s*([^\n]{2,80})$/im,
    new RegExp(`^[^\\n]{0,80}?\\s(?:at|@)[ \\t]+${name}[ \\t]*$`, "m"),
    new RegExp(`\\babout[ \\t]+${name}[ \\t]*(?:\\n|:)`),
    new RegExp(`\\b${name}[ \\t]+is[ \\t]+an?[ \\t]+equal[ \\t]+(?:employment[ \\t]+)?opportunity`),
    new RegExp(`\\bjoin[ \\t]+${name}[ \\t]*(?:[,.!]|and\\b)`),
    new RegExp(`\\b([A-Z][\\w&.'-]*(?:[ \\t]+[A-Z][\\w&.'-]*){0,3}[ \\t]+(?:Inc|Corp|Corporation|LLC|Ltd|Group|Technologies|Systems|Solutions|Labs|Company))\\b\\.?`),
    new RegExp(`^${name}[ \\t]+(?:is|delivers|provides|builds|helps|offers)[ \\t]`, "m")
  ];
  for (const pattern of patterns) {
    const found = text.match(pattern);
    const company = found && clean(found[1]);
    if (company && company.length <= 60 && !NOT_COMPANY.test(company.split(" ")[0]) && !TITLE_WORDS.test(company)) return company;
  }
  return "";
}

// { title, company }; empty strings when they can't be found
function jobInfoOf(jobDescription = "") {
  const text = String(jobDescription).slice(0, 8000);
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return { title: titleOf(lines, text).slice(0, 120), company: companyOf(lines, text).slice(0, 80) };
}

module.exports = { jobInfoOf };
