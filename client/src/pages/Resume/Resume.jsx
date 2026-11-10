import { useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner } from "react-bootstrap";
import { fitSummary, generateResume, getResumeSources, recalculateMatch, reviseResume } from "../../api/resumeApi";
import { STATIC_SITE } from "../../staticSite";
import { fitRequest, fitScore, fitsLines, measureSummary } from "./summaryLines";
import JobMatchCard from "./JobMatchCard";
import ResumeSelector from "./ResumeSelector";
import ResumePreview from "./ResumePreview";
import AtsReport from "./AtsReport";
import TemplatePicker from "./TemplatePicker";
import { EXTRA_SECTIONS, RESUME_MARGIN, templateById } from "./resumeTemplates";
import { printAs, resumeFileName } from "../Resumes/resumeFileName";
import ResumePage from "./ResumePage";
import { resumeToText } from "./resumeText";
import "./resume.css";
import { CvMakerIcon } from "../Layout/FeatureIcons";

const JOB_DESCRIPTION_MAX = 8000;
const INSTRUCTIONS_MAX = 1000;
const INCLUDE_KEYWORDS_MAX = 12;

// "TensorFlow, GitHub\nModel Evaluation" -> ["TensorFlow", "GitHub", "Model Evaluation"]
const keywordList = (text) =>
  [...new Set(text.split(/[,\n]/).map((keyword) => keyword.trim()).filter(Boolean))]
    .map((keyword) => keyword.slice(0, 40))
    .slice(0, INCLUDE_KEYWORDS_MAX);

const CONTACT_FIELDS = [
  ["email", "Email"],
  ["phone", "Phone"],
  ["location", "Location"],
  ["linkedin", "LinkedIn"],
  ["github", "GitHub"],
  ["portfolio", "Portfolio"]
];

// The chosen template is remembered in this browser only
const remembered = (key, fallback) => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};

const remember = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage may be blocked; the choice just isn't kept
  }
};

// From the earliest job start to now; decides whether 2 pages are fine
const yearsOfExperience = (experience) => {
  const starts = experience.map((item) => item.start?.year).filter(Boolean);
  return starts.length ? new Date().getFullYear() - Math.min(...starts) : 0;
};

// Main sections on with everything chosen; added sections start off, with
// all their items chosen for when they're switched on
const selectAll = (sources) => ({
  sections: {
    summary: true, experience: true, education: true, projects: true, skills: true,
    ...Object.fromEntries(EXTRA_SECTIONS.map(({ key }) => [key, false]))
  },
  experienceIds: sources.experiences.map((item) => item.id),
  educationIds: sources.educations.map((item) => item.id),
  projectIds: sources.projects.map((item) => item.id),
  skillIds: sources.skills.map((item) => item.id),
  ...Object.fromEntries(EXTRA_SECTIONS.map(({ key, idsKey }) => [idsKey, (sources[key] || []).map((item) => item.id)]))
});

export default function Resume() {
  const [sources, setSources] = useState(null);
  const [ai, setAi] = useState(null);
  const [loadError, setLoadError] = useState("");

  const [selection, setSelection] = useState(null);
  const [targetTitle, setTargetTitle] = useState("");
  // Only used to name the saved file
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [useAi, setUseAi] = useState(false);
  const [instructions, setInstructions] = useState("");
  // Off by default: listing skills only because a job names them reads as stuffing
  const [addMissingKeywords, setAddMissingKeywords] = useState(false);
  // "TensorFlow, GitHub" -> worked into experience bullets
  const [includeKeywords, setIncludeKeywords] = useState("");
  const [showContact, setShowContact] = useState(
    // Location is left off unless asked for
    () => Object.fromEntries(CONTACT_FIELDS.map(([key]) => [key, key !== "location"]))
  );

  // "select" → "building" → "preview"
  const [phase, setPhase] = useState("select");
  const [progress, setProgress] = useState([]);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [templateId, setTemplateId] = useState(() => remembered("resume.template", "technical"));
  const [order, setOrder] = useState(() => remembered("resume.order", "default"));
  const [pages, setPages] = useState(1);
  const [matchWeights, setMatchWeights] = useState({});
  const [matchDirty, setMatchDirty] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const abortRef = useRef(null);
  // Each build gets an id, so the summary is fitted once per build and layout
  const [buildId, setBuildId] = useState(0);
  const [summaryFit, setSummaryFit] = useState(null);
  // Revising the finished resume: the user's instructions, the agent's
  // latest step, and the version before, for Undo
  const [revisionText, setRevisionText] = useState("");
  const [revising, setRevising] = useState(null);
  const [beforeRevision, setBeforeRevision] = useState(null);
  // The agent's question when the instructions are unclear, the answers so
  // far, and the user's own answer if no option fits
  const [clarify, setClarify] = useState(null);
  const [clarifications, setClarifications] = useState([]);
  const [ownAnswer, setOwnAnswer] = useState("");
  // The latest result, for the summary fit loop to read between awaits
  const resultRef = useRef(null);
  useEffect(() => {
    resultRef.current = result;
  }, [result]);

  useEffect(() => {
    getResumeSources()
      .then(({ data }) => {
        setSources(data.sources);
        setAi(data.ai);
        setUseAi(data.ai.available);
        setSelection(selectAll(data.sources));
      })
      .catch((err) => setLoadError(err.response?.data?.message || "Unable to load your portfolio."));

    return () => abortRef.current?.abort();
  }, []);

  const build = async () => {
    setError("");
    setProgress([]);
    setPhase("building");

    const controller = new AbortController();
    abortRef.current = controller;
    let finished = false;

    try {
      await generateResume(
        { ...selection, targetTitle, jobDescription, instructions, showContact, addMissingKeywords, useAi, includeKeywords: keywordList(includeKeywords) },
        (event, data) => {
          if (event === "progress") setProgress((list) => [...list, data.message]);
          if (event === "result") {
            finished = true;
            setResult(data);
            setBeforeRevision(null);
            setBuildId((id) => id + 1);
            setMatchDirty(false);
            setPhase("preview");
          }
          if (event === "error") {
            finished = true;
            setError(data.message);
            setPhase("select");
          }
        },
        controller.signal
      );

      if (!finished) {
        setError("The connection closed before the resume was finished. Please try again.");
        setPhase("select");
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err.message || "Unable to build the resume.");
      setPhase("select");
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setPhase("select");
  };

  // The role on the file name: the target title, else the latest job title
  const savedName = () => resumeFileName(result.resume.contact.name, templateById(templateId)?.name);

  const downloadText = () => {
    const blob = new Blob([resumeToText(result.resume)], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${savedName()}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const savePdf = () => printAs(savedName());

  // Any edit to the built resume means the match should be recalculated
  const editResume = (resume) => {
    setResult((current) => ({ ...current, resume }));
    setMatchDirty(true);
  };

  // Sends the finished resume through the agents again under the user's
  // instructions; Undo goes back to the version before
  // answers: the user's answers to the agent's questions for these instructions
  const revise = async (answers = []) => {
    setError("");
    setClarify(null);
    setClarifications(answers);
    setRevising("Starting");
    const controller = new AbortController();
    abortRef.current = controller;
    const previous = result;
    let finished = false;

    try {
      await reviseResume(
        {
          ...selection, targetTitle, jobDescription, instructions, showContact, addMissingKeywords, useAi: true,
          includeKeywords: keywordList(includeKeywords),
          resume: result.resume,
          keywords: result.keywords || [],
          requirements: result.match?.requirements,
          revisionInstructions: revisionText.trim(),
          clarifications: answers
        },
        (event, data) => {
          if (event === "progress") setRevising(data.message);
          if (event === "clarify") {
            finished = true;
            setClarify(data);
            setOwnAnswer("");
          }
          if (event === "result") {
            finished = true;
            setBeforeRevision(previous);
            setResult(data);
            setMatchDirty(false);
            setRevisionText("");
            setClarifications([]);
            setBuildId((id) => id + 1);
          }
          if (event === "error") {
            finished = true;
            setError(data.message);
          }
        },
        controller.signal
      );
      if (!finished) setError("The connection closed before the revision was finished. Please try again.");
    } catch (err) {
      if (!controller.signal.aborted) setError(err.message || "Unable to revise the resume.");
    } finally {
      setRevising(null);
    }
  };

  const answer = (text) => revise([...clarifications, { question: clarify.question, answer: text }]);

  const undoRevision = () => {
    setResult(beforeRevision);
    setBeforeRevision(null);
    setMatchDirty(false);
  };

  // Fits the AI summary to 4-6 lines with a full last line: measure it on
  // the page, ask for a rephrase at the right length, measure again (up to
  // 3 times), and keep the best version. Runs after each build and template
  // change; the user's own edits are never rephrased.
  useEffect(() => {
    if (phase !== "preview" || !result?.aiUsed || !result.resume.summary) return undefined;
    const controller = new AbortController();
    const painted = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const measure = () => measureSummary(document.querySelector(".resume-doc .resume-summary"));
    const setSummary = (summary) => setResult((current) => ({ ...current, resume: { ...current.resume, summary } }));

    (async () => {
      await document.fonts?.ready;
      await painted();
      let best = null;

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const m = measure();
        if (!m || controller.signal.aborted) return;
        const summary = resultRef.current.resume.summary;
        if (!best || fitScore(m) < best.score) best = { summary, score: fitScore(m) };
        if (fitsLines(m)) {
          setSummaryFit(attempt > 1 ? { status: "fitted", lines: m.lines } : null);
          return;
        }

        setSummaryFit({ status: "fitting", attempt });
        try {
          const { targetWords, feedback } = fitRequest(m);
          const { data } = await fitSummary({ resume: resultRef.current.resume, summary, targetWords, feedback }, controller.signal);
          if (controller.signal.aborted) return;
          setSummary(data.summary);
          await painted();
        } catch {
          if (controller.signal.aborted) return;
        }
      }

      // None fit exactly: keep whichever looked best
      const m = measure();
      if (m && best && fitScore(m) > best.score) setSummary(best.summary);
      setSummaryFit({ status: "best" });
    })();

    return () => controller.abort();
    // Only a new build or layout starts a new fit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildId, templateId, phase]);

  // Scores the edited resume against the same requirements (no AI)
  const recalculate = async () => {
    setRecalculating(true);
    try {
      const { data } = await recalculateMatch(result.resume, result.match.requirements, matchWeights);
      setResult((current) => ({ ...current, match: data.match }));
      setMatchDirty(false);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to recalculate the match.");
    } finally {
      setRecalculating(false);
    }
  };

  // Skills without the given names
  const skillsWithout = (skills, names) => ({
    ...skills,
    technical: skills.technical.filter((skill) => !names.includes(skill)),
    added: (skills.added || []).filter((skill) => !names.includes(skill)),
    addedCritical: (skills.addedCritical || []).filter((skill) => !names.includes(skill)),
    groups: skills.groups
      .map((group) => ({ ...group, skills: group.skills.filter((skill) => !names.includes(skill)) }))
      .filter((group) => group.skills.length)
  });

  // Takes a skill that was added from the job description back out
  const removeAddedSkill = (name) => {
    editResume({ ...result.resume, skills: skillsWithout(result.resume.skills, [name]) });
  };

  // Puts a bullet back the way it was before job keywords were worked in,
  // and drops those keywords from Skills if they came only from the job
  const undoWovenKeywords = (change) => {
    const { resume } = result;
    const list = resume[change.listKey].map((item) => item.id === change.id
      ? { ...item, bullets: item.bullets.map((bullet, index) => (index === change.index ? change.before : bullet)) }
      : item);
    editResume({
      ...resume,
      [change.listKey]: list,
      skills: skillsWithout(resume.skills, change.fromJob),
      keywordsWoven: resume.keywordsWoven.filter((other) => other !== change)
    });
  };

  const copyText = async () => {
    await navigator.clipboard.writeText(resumeToText(result.resume));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loadError) return <Alert variant="danger">{loadError}</Alert>;

  if (!sources || !selection) {
    return (
      <div className="text-center py-5 text-muted">
        <Spinner animation="border" size="sm" className="me-2" />Loading your portfolio...
      </div>
    );
  }

  if (phase === "preview" && result) {
    return (
      <div className="resume-page">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3 resume-no-print">
          <Button variant="outline-secondary" onClick={() => setPhase("select")}>
            <i className="bi bi-arrow-left me-1" />Change selections
          </Button>
          <Button variant="outline-primary" onClick={build}>
            <i className="bi bi-arrow-repeat me-1" />Rebuild
          </Button>
          <div className="ms-auto d-flex flex-wrap gap-2">
            <Button variant="outline-secondary" onClick={copyText}>
              <i className={`bi ${copied ? "bi-check2" : "bi-clipboard"} me-1`} />{copied ? "Copied" : "Copy text"}
            </Button>
            <Button variant="outline-secondary" onClick={downloadText}>
              <i className="bi bi-filetype-txt me-1" />Download .txt
            </Button>
            <Button onClick={savePdf}>
              <i className="bi bi-file-earmark-pdf me-1" />Save as PDF
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="danger" dismissible onClose={() => setError("")} className="resume-no-print">{error}</Alert>
        )}

        <p className="small text-muted resume-no-print">
          <i className="bi bi-pencil me-1" />Click any summary or bullet point to edit it. Always read AI-written text before you send it.
        </p>

        {summaryFit && (
          <p className="small text-muted resume-no-print">
            {summaryFit.status === "fitting" && <><Spinner size="sm" className="me-1" />Rephrasing the summary to fill its lines (try {summaryFit.attempt} of 3)…</>}
            {summaryFit.status === "fitted" && <><i className="bi bi-text-paragraph me-1" />Summary rephrased to fill {summaryFit.lines} lines evenly.</>}
            {summaryFit.status === "best" && <><i className="bi bi-text-paragraph me-1" />Kept the summary version that fits its lines best; edit it if the last line still looks short.</>}
          </p>
        )}

        <Row className="g-4">
          <Col lg={8}>
            <ResumePage marginInches={RESUME_MARGIN.inches} onPages={setPages}>
              <ResumePreview
                resume={result.resume}
                template={templateById(templateId)}
                order={order}
                margin={RESUME_MARGIN.value}
                onChange={editResume}
              />
            </ResumePage>
          </Col>
          <Col lg={4}>
            <div className="resume-side">
              <TemplatePicker
                templateId={templateId}
                order={order}
                onTemplate={(id) => {
                  setTemplateId(id);
                  remember("resume.template", id);
                }}
                onOrder={(value) => {
                  setOrder(value);
                  remember("resume.order", value);
                }}
              />
              {ai?.available && (
                <Card className="shadow-sm resume-no-print">
                  <Card.Body>
                    <Form.Label htmlFor="resume-revision" className="fw-semibold mb-1">Revise with instructions</Form.Label>
                    <p className="small text-muted mb-2">
                      Say what this resume doesn't follow yet. The agents rewrite only those parts, using facts from your portfolio.
                    </p>
                    <Form.Control
                      id="resume-revision"
                      as="textarea"
                      rows={3}
                      value={revisionText}
                      maxLength={INSTRUCTIONS_MAX}
                      disabled={Boolean(revising)}
                      placeholder="e.g. Mention Kubernetes in the Oracle bullets. Make the Verizon bullets shorter. Remove Java from Skills."
                      onChange={(e) => {
                        setRevisionText(e.target.value);
                        // New instructions: earlier answers no longer apply
                        setClarify(null);
                        setClarifications([]);
                      }}
                    />
                    {clarify && !revising && (
                      <div className="border rounded p-2 mt-2 bg-light">
                        <div className="small fw-semibold mb-2">
                          <i className="bi bi-question-circle me-1" aria-hidden="true" />{clarify.question}
                        </div>
                        <div className="d-flex flex-column gap-1">
                          {clarify.options.map((option) => (
                            <Button key={option} size="sm" variant="outline-primary" className="text-start" onClick={() => answer(option)}>
                              {option}
                            </Button>
                          ))}
                        </div>
                        <div className="d-flex gap-1 mt-2">
                          <Form.Control
                            size="sm"
                            value={ownAnswer}
                            maxLength={300}
                            placeholder="Or say what you mean"
                            aria-label="Your own answer"
                            onChange={(e) => setOwnAnswer(e.target.value)}
                          />
                          <Button size="sm" variant="outline-secondary" disabled={!ownAnswer.trim()} onClick={() => answer(ownAnswer.trim())}>
                            Send
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="d-flex align-items-center gap-2 mt-2">
                      <Button size="sm" onClick={() => revise()} disabled={Boolean(revising) || !revisionText.trim()}>
                        {revising ? <Spinner size="sm" className="me-1" /> : <i className="bi bi-magic me-1" />}Revise
                      </Button>
                      {beforeRevision && !revising && (
                        <Button size="sm" variant="outline-secondary" onClick={undoRevision}>
                          <i className="bi bi-arrow-counterclockwise me-1" />Undo revision
                        </Button>
                      )}
                    </div>
                    {revising && <div className="small text-muted mt-2">{revising}…</div>}
                  </Card.Body>
                </Card>
              )}
              {result.match && (
                <JobMatchCard
                  match={result.match}
                  weights={matchWeights}
                  onWeights={setMatchWeights}
                  dirty={matchDirty}
                  recalculating={recalculating}
                  onRecalculate={recalculate}
                />
              )}
              <AtsReport
                review={result.review}
                notes={result.notes}
                aiUsed={result.aiUsed}
                model={result.model}
                agents={result.agents}
                addedSkills={result.resume.skills.added || []}
                criticalSkills={result.resume.skills.addedCritical || []}
                pages={pages}
                yearsOfExperience={yearsOfExperience(result.resume.experience)}
                onRemoveSkill={removeAddedSkill}
                wovenKeywords={result.resume.keywordsWoven || []}
                onUndoWoven={undoWovenKeywords}
              />
            </div>
          </Col>
        </Row>
      </div>
    );
  }

  const building = phase === "building";

  return (
    <div className="resume-page">
      <div className="mb-4">
        <h2 className="mb-1"><CvMakerIcon className="me-2" />CV Maker</h2>
        <p className="text-muted mb-0">
          Choose what goes on your resume. It's laid out to pass applicant tracking systems (ATS), and the AI can sharpen the wording.
        </p>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError("")}>{error}</Alert>}

      <Row className="g-4">
        <Col lg={7}>
          <fieldset disabled={building}>
            <ResumeSelector sources={sources} selection={selection} onChange={setSelection} />
          </fieldset>
        </Col>

        <Col lg={5}>
          <div className="resume-side">
            <Card className="shadow-sm">
              <Card.Body>
                <h5 className="mb-3">Target job <span className="text-muted fw-normal small">(optional)</span></h5>

                <fieldset disabled={building}>
                  <Form.Group className="mb-3" controlId="resume-target-title">
                    <Form.Label className="small">Job title</Form.Label>
                    <Form.Control
                      value={targetTitle}
                      maxLength={120}
                      placeholder="e.g. Software Engineer"
                      onChange={(e) => setTargetTitle(e.target.value)}
                    />
                  </Form.Group>

                  <Form.Group className="mb-3" controlId="resume-company">
                    <Form.Label className="small">Company <span className="text-muted">(names the saved file)</span></Form.Label>
                    <Form.Control
                      value={company}
                      maxLength={80}
                      placeholder="e.g. Google"
                      onChange={(e) => setCompany(e.target.value)}
                    />
                  </Form.Group>

                  <Form.Group className="mb-3" controlId="resume-job-description">
                    <Form.Label className="small">Job description</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={6}
                      value={jobDescription}
                      maxLength={JOB_DESCRIPTION_MAX}
                      placeholder="Paste the job posting to match its keywords"
                      onChange={(e) => setJobDescription(e.target.value)}
                    />
                    <Form.Text>{jobDescription.length}/{JOB_DESCRIPTION_MAX}</Form.Text>
                    <Form.Check
                      type="switch"
                      id="resume-add-keywords"
                      className="small mt-2"
                      label="Add tools the job names that are missing from my Skills (only if I have them)"
                      checked={addMissingKeywords}
                      onChange={(e) => setAddMissingKeywords(e.target.checked)}
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label className="small mb-1">Contact details to show</Form.Label>
                    <div className="d-flex flex-wrap gap-3">
                      {/* Only details the portfolio has; an empty one has nothing to show */}
                      {CONTACT_FIELDS.filter(([key]) => sources.contact?.[key]).map(([key, label]) => (
                        <Form.Check
                          key={key}
                          id={`show-${key}`}
                          className="small"
                          label={label}
                          checked={showContact[key]}
                          onChange={(e) => setShowContact({ ...showContact, [key]: e.target.checked })}
                        />
                      ))}
                    </div>
                  </Form.Group>

                  <Form.Group className="mb-3" controlId="resume-include-keywords">
                    <Form.Label className="small">Keywords to include <span className="text-muted">(in your experience bullets)</span></Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      value={includeKeywords}
                      placeholder="One per line or comma-separated, e.g. TensorFlow, GitHub, Model Evaluation"
                      onChange={(e) => setIncludeKeywords(e.target.value)}
                    />
                    <Form.Text>
                      {useAi
                        ? `${keywordList(includeKeywords).length}/${INCLUDE_KEYWORDS_MAX}. Only add skills you've used; each goes into the work it fits.`
                        : "Turn on \"Improve with AI\" to work these into your bullets."}
                    </Form.Text>
                  </Form.Group>

                  <Form.Group className="mb-3" controlId="resume-instructions">
                    <Form.Label className="small">Extra instructions <span className="text-muted">(for the AI)</span></Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={instructions}
                      maxLength={INSTRUCTIONS_MAX}
                      placeholder="e.g. Focus on backend and cloud work. Keep bullets short. Don't mention my current employer's name in the summary."
                      onChange={(e) => setInstructions(e.target.value)}
                    />
                    <Form.Text>
                      {useAi
                        ? `${instructions.length}/${INSTRUCTIONS_MAX}`
                        : "Turn on \"Improve with AI\" to use these. Contact switches work either way."}
                    </Form.Text>
                  </Form.Group>

                  <div className="border rounded p-3 mb-3">
                    <div className="d-flex align-items-center gap-2">
                      <Form.Check
                        type="switch"
                        id="resume-use-ai"
                        className="mb-0"
                        label="Improve with AI"
                        checked={useAi}
                        disabled={!ai.available}
                        onChange={(e) => setUseAi(e.target.checked)}
                      />
                      <Badge bg={ai.available ? "success" : "secondary"} className="ms-auto fw-normal">
                        {ai.available ? `${STATIC_SITE ? "Workers AI" : "Ollama"} · ${ai.model}` : "AI offline"}
                      </Badge>
                    </div>
                    <div className="small text-muted mt-2">
                      {ai.available
                        ? "A local AI agent rewrites your summary and bullet points with action verbs and job keywords. It only uses facts from your portfolio."
                        : ai.message}
                    </div>
                  </div>
                </fieldset>

                {building ? (
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <Spinner animation="border" size="sm" variant="primary" />
                      <span className="fw-medium">{useAi ? "The AI is writing your resume..." : "Building your resume..."}</span>
                    </div>
                    <ul className="list-unstyled small text-muted mb-3 resume-progress">
                      {progress.map((message, index) => (
                        <li key={index}>
                          <i className={`bi ${index === progress.length - 1 ? "bi-arrow-right-short" : "bi-check2 text-success"} me-1`} />
                          {message}
                        </li>
                      ))}
                    </ul>
                    <Button variant="outline-secondary" className="w-100" onClick={cancel}>Cancel</Button>
                  </div>
                ) : (
                  <Button className="w-100" size="lg" onClick={build}>
                    <i className={`bi ${useAi ? "bi-stars" : "bi-file-earmark-text"} me-2`} />
                    {useAi ? "Build resume with AI" : "Build resume"}
                  </Button>
                )}
              </Card.Body>
            </Card>
          </div>
        </Col>
      </Row>
    </div>
  );
}
