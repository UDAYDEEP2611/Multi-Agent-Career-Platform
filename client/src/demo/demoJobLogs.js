import jobs from "./demoJobs.json";
import { gather, newId } from "./demoStore";

// JobPilot's server routes for the demo. Comparisons are kept in the visitor's
// browser for 72 hours, like the full app's Log Book; the sample jobs stay.
const LIFETIME_MS = 72 * 60 * 60 * 1000;
const MAX_LOGS = 12;

// Written out so normal builds leave the matching code out altogether
const engine = () => (import.meta.env.VITE_STATIC_SITE === "true" ? import("./demoJobCheck") : Promise.reject(new Error("Demo only")));

const expiresAt = (log) => new Date(log.sample ? Date.now() + LIFETIME_MS : new Date(log.createdAt).getTime() + LIFETIME_MS).toISOString();
const fileNameOf = (store) => `${gather(store, "resume").contact.name.replace(/\s+/g, "-")}-Resume.txt`;

async function addLog(store, { text, jobDescription, company, jobTitle, sample = false, ageHours = 0 }) {
  const { runCheck } = await engine();
  const { resumeOnlyOverall, ...result } = await runCheck({ text, jobDescription, company, jobTitle });
  const log = {
    id: newId(),
    fileName: fileNameOf(store),
    fileType: "text/plain",
    text,
    links: [],
    jobDescription,
    jobTitle: (result.match.header.role || "").slice(0, 120),
    company: (result.match.header.company || "").slice(0, 80),
    candidateName: (result.resume.contact.name || "").slice(0, 120),
    overall: resumeOnlyOverall,
    atsScore: result.ats.score,
    createdAt: new Date(Date.now() - ageHours * 60 * 60 * 1000).toISOString(),
    sample,
    result
  };
  store.jobLogs.unshift(log);
  return log;
}

// The first visit fills the Log Book with the person's sample jobs
async function logsOf(store, account) {
  if (!store.jobLogs) {
    store.jobLogs = [];
    const { resumeText } = await engine();
    const text = resumeText(gather(store, "resume"));
    const samples = jobs[account] || [];
    for (let index = samples.length - 1; index >= 0; index -= 1) {
      await addLog(store, { text, jobDescription: samples[index].description, sample: true, ageHours: index + 1 });
    }
  }
  store.jobLogs = store.jobLogs.filter((log) => log.sample || new Date(expiresAt(log)) > new Date());
  return store.jobLogs;
}

const ok = (body) => ({ status: 200, body: { success: true, ...body } });
const fail = (status, message) => ({ status, body: { success: false, message } });

// A reply for a JobPilot route, or null for any other route
export async function jobPilotReply(store, account, method, path, data) {
  if (!path.startsWith("/api/resume/") || !store["/api/portfolio/overview"]) return null;
  const route = path.slice("/api/resume/".length);

  if (method === "get" && route === "demo-resume") {
    const { resumeText } = await engine();
    return ok({ fileName: fileNameOf(store), text: resumeText(gather(store, "resume")) });
  }

  if (method === "post" && route === "job-info") {
    const { jobInfoOf } = await engine();
    return ok(jobInfoOf(String(JSON.parse(data || "{}").jobDescription || "").slice(0, 8000)));
  }

  if (method === "post" && route === "compare") {
    const jobDescription = String(data.get("jobDescription") || "").trim();
    if (jobDescription.length < 50) return fail(400, "Paste the job description (at least 50 characters).");
    if (jobDescription.length > 8000) return fail(400, "The job description can be up to 8000 characters.");
    await logsOf(store, account);
    const text = await data.get("file").text();
    const log = await addLog(store, { text, jobDescription, company: String(data.get("company") || "").trim(), jobTitle: String(data.get("jobTitle") || "").trim() });
    // The newest entries stay; the sample jobs are the first to give way
    while (store.jobLogs.length > MAX_LOGS) {
      const sample = store.jobLogs.findLastIndex((entry) => entry.sample);
      store.jobLogs.splice(sample >= 0 ? sample : store.jobLogs.length - 1, 1);
    }
    return ok({ ...log.result, logId: log.id, text });
  }

  if (!route.startsWith("match-logs")) return null;
  const [, id, action] = route.split("/");
  const logs = await logsOf(store, account);

  if (!id && method === "get") {
    return ok({
      lifetimeHours: 72,
      logs: logs.map((log) => ({ id: log.id, fileName: log.fileName, fileType: log.fileType, jobTitle: log.jobTitle, company: log.company, candidateName: log.candidateName, overall: log.overall, atsScore: log.atsScore, createdAt: log.createdAt, expiresAt: expiresAt(log) }))
    });
  }

  const log = logs.find((entry) => entry.id === id);
  if (!log) return fail(404, "This entry was not found or has expired.");

  if (method === "get" && !action) return ok({ log: { ...log, expiresAt: expiresAt(log) } });

  if (method === "delete" && !action) {
    store.jobLogs = logs.filter((entry) => entry !== log);
    return ok({ message: "Deleted" });
  }

  if (method === "post" && action === "confirm") {
    const allowed = new Set((log.result.match.findings?.confirmable || []).map((entry) => entry.key));
    const confirmations = { ...log.confirmations };
    for (const [key, value] of Object.entries(JSON.parse(data || "{}").confirmations || {})) {
      if (!allowed.has(key)) continue;
      if (value === "yes" || value === "no") confirmations[key] = value;
      else delete confirmations[key];
    }
    const { runCheck } = await engine();
    const { resumeOnlyOverall, ...result } = await runCheck({ text: log.text, jobDescription: log.jobDescription, jobTitle: log.jobTitle, company: log.company, confirmations, previous: log.result });
    Object.assign(log, { result, confirmations, overall: resumeOnlyOverall });
    return ok({ ...result, logId: log.id, confirmations });
  }

  return null;
}
