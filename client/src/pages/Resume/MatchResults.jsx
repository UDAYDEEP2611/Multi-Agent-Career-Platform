import { useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Card, Col, ListGroup, ProgressBar, Row, Tab, Table, Tabs } from "react-bootstrap";
import { missingItems, scoreColor } from "./matchHelpers";
import { confirmMatchLog } from "../../api/resumeApi";

// The Job Match Assessment: semantic fit by category, findings, eligibility
// and how the score was calculated; the ATS check with keyword coverage; and
// the prioritized resume changes. Used by JobPilot and its Log Book.

// How each match type reads, and its badge color
const MATCHES = {
  direct: ["Direct", "success"],
  equivalent: ["Equivalent", "success"],
  related: ["Related", "info"],
  inferred: ["Inferred", "info"],
  partial: ["Partial", "warning"],
  listed: ["Listed only", "warning"],
  uncertain: ["Uncertain", "secondary"],
  confirm: ["Needs confirmation", "secondary"],
  // Said by the candidate, not on the resume
  confirmed: ["Confirmed by you", "primary"],
  missing: ["Not demonstrated", "danger"]
};
// How the job states its importance, where it says so in the sentence itself
const IMPORTANCE = { mandatory: "Stated as required", optional: "Optional (half weight)" };
const CONFIDENCE = { high: "High", moderate: "Moderate", low: "Low", none: "—" };
const WORDING = {
  mandatory: "Must have", proficient: "Proficient", required: "Required", experience: "Hands-on",
  working: "Working knowledge", familiarity: "Familiarity", preferred: "Preferred"
};
// Whether the requirement as a whole is met, apart from its coverage
const SATISFACTION_COLORS = { Satisfied: "success", "Likely satisfied": "success", "Partly satisfied": "warning", "Not satisfied": "danger", Unverified: "secondary", "Confirmed by you": "primary", "Needs confirmation": "info", Ambiguous: "info" };
const ELIGIBILITY_COLORS = { Met: "success", "Not Met": "danger", Unknown: "warning", "Not Applicable": "secondary" };

function MatchBadge({ match }) {
  const [label, color] = MATCHES[match] || MATCHES.missing;
  return <Badge bg={`${color}-subtle`} text={color === "info" ? "info-emphasis" : color === "warning" ? "warning-emphasis" : color === "secondary" ? "secondary-emphasis" : color} className="fw-normal">{label}</Badge>;
}

const percent = (score) => `${Math.round(score * 100)}%`;

const ROLE_LEVELS = {
  matches: ["Matches the job title", "success"],
  close: ["Close to the job title", "warning"],
  different: ["Different from the job title", "danger"]
};

// What was read from the resume: contact details, role and sections
function Profile({ profile }) {
  return (
    <Card className="shadow-sm mb-4">
      <Card.Body>
        <Card.Title as="h5">What we read from your resume</Card.Title>
        <p className="small text-muted">Check these were read correctly; anything missing here can't count toward the match.</p>
        <Table size="sm" responsive className="small mb-0 align-middle">
          <tbody>
            {profile.map((item) => (
              <tr key={item.field}>
                <td style={{ width: 28 }}>
                  <i
                    className={`bi ${item.found ? "bi-check-circle-fill text-success" : item.required ? "bi-x-circle-fill text-danger" : "bi-dash-circle text-muted"}`}
                    aria-label={item.found ? "Found" : "Not found"}
                  />
                </td>
                <td className="fw-semibold" style={{ width: 120 }}>
                  {item.field}
                  {!item.required && <div className="fw-normal text-muted">optional</div>}
                </td>
                <td>
                  {item.found ? item.value : <span className="text-muted">{item.required ? "Not found" : "None"}</span>}
                  {item.role && (
                    <Badge bg={`${ROLE_LEVELS[item.role.level][1]}-subtle`} text={ROLE_LEVELS[item.role.level][1]} className="fw-normal ms-2">
                      {ROLE_LEVELS[item.role.level][0]} ({item.role.jobTitle})
                    </Badge>
                  )}
                  {item.detail && <div className="text-muted">{item.detail}</div>}
                  {item.items?.length > 0 && (
                    <ul className="mb-0 ps-3 text-muted">
                      {item.items.slice(0, 8).map((line, index) => <li key={index}>{line}</li>)}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card.Body>
    </Card>
  );
}

// Evidence for one requirement or part of one
function Evidence({ item }) {
  return (
    <>
      {item.via && <div>Via <strong>{item.via}</strong></div>}
      {(item.evidence || []).slice(0, 2).map((entry, index) => (
        <div key={index} title={entry.where}>
          “{entry.text.length > 140 ? `${entry.text.slice(0, 139)}…` : entry.text}”
          <span className="text-muted"> ({entry.section && !entry.where.startsWith(entry.section) ? `${entry.section}: ` : ""}{entry.where})</span>
        </div>
      ))}
      {item.source && item.source !== "No evidence" && (
        <div className="text-body-secondary">
          {item.source}{item.proficiency ? ` · asked: ${item.proficiency.asked}, shown: ${item.proficiency.shown}` : ""}{item.recency ? ` · last shown ${item.recency.lastShown}` : ""}
        </div>
      )}
      {item.note && <div className="fst-italic">{item.note}</div>}
      {item.reason && <div className="text-body-secondary"><i className="bi bi-info-circle me-1" aria-hidden="true" />{item.reason}</div>}
      {item.byAgent && <div><i className="bi bi-robot me-1" aria-hidden="true" />Matched by the Evidence agent</div>}
      {item.agentExplanation && (
        <div className="border-start ps-2 mt-1">
          <div><strong>Shows:</strong> {item.agentExplanation.capability}</div>
          {item.agentExplanation.relationship && <div><strong>How:</strong> {item.agentExplanation.relationship}</div>}
          {item.agentExplanation.technologies.length > 0 && <div><strong>Tools:</strong> {item.agentExplanation.technologies.join(", ")}</div>}
          {item.agentExplanation.unsupported.length > 0 && <div className="text-danger"><strong>Not demonstrated:</strong> {item.agentExplanation.unsupported.join(", ")}</div>}
        </div>
      )}
      {item.capability?.asks?.length > 0 && item.capability.score < 1 && (
        <div>Asks beyond the tools: {item.capability.asks.join(", ")} ({item.capability.score ? "partly shown" : "not demonstrated"})</div>
      )}
    </>
  );
}

// One category of the detailed evaluation
function Category({ category }) {
  if (category.score === null) {
    return (
      <Card className="shadow-sm mb-3">
        <Card.Body className="py-2 small text-muted">
          <strong>{category.label}</strong>: not in this job; its weight was shared out to the other categories.
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm mb-3">
      <Card.Body>
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
          <Card.Title as="h6" className="mb-0">{category.label}</Card.Title>
          <div className="small text-muted">
            Weight {Math.round(category.weight * 100)}% · adds {category.contribution} points
            {category.expected && <span title="Preferred qualifications are advantages; nobody is expected to have them all"> · full credit at {Math.round(category.expected * 100)}% shown</span>}
            <Badge bg={scoreColor(category.score)} className="ms-2">{Math.round(category.score)}%</Badge>
          </div>
        </div>
        <Table size="sm" responsive className="small mb-0 align-middle">
          <thead>
            <tr>
              <th>From the job</th>
              <th style={{ width: 110 }}>Asked as</th>
              <th style={{ width: 95 }}>Match</th>
              <th style={{ width: 75 }} title="How much of what's asked is shown, including transferable credit">Coverage</th>
              <th style={{ width: 80 }} title="Points this requirement earns, out of the most it could earn. Never below 0: what isn't shown earns 0.">Points</th>
              <th style={{ width: 85 }}>Confidence</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {category.items.map((item, index) => {
              // Duplicates and unverifiable items are shown but not scored
              const unscored = item.duplicate || item.unverified;
              return (
              <tr key={`${item.text}-${index}`} className={unscored ? "text-muted" : ""}>
                <td>
                  {item.group && <div className="text-uppercase text-body-tertiary" style={{ fontSize: "0.7rem", letterSpacing: 0.5 }}>{item.group}</div>}
                  {item.text}
                  {item.duplicate && <Badge bg="light" text="dark" className="fw-normal ms-1" title={item.duplicateOf ? `Scored as: ${item.duplicateOf}` : undefined}>Counted elsewhere</Badge>}
                  {item.unverified && <Badge bg="light" text="dark" className="fw-normal ms-1">Not scored</Badge>}
                  {item.kind === "years" && item.nearMatch && <Badge bg="info-subtle" text="info-emphasis" className="fw-normal ms-1" title={`Within ${item.years?.tolerance} years of the minimum`}>Strong near-match</Badge>}
                  {item.kind === "years" && item.status && <Badge bg={item.status === "Met" ? "success-subtle" : "warning-subtle"} text={item.status === "Met" ? "success" : "warning-emphasis"} className="fw-normal ms-1">{item.status}</Badge>}
                  {item.uncertain && <Badge bg="secondary-subtle" text="secondary" className="fw-normal ms-1" title="Possible evidence the engine can't interpret; no credit until reviewed">Uncertain</Badge>}
                  {item.needsReview && <Badge bg="warning-subtle" text="warning-emphasis" className="fw-normal ms-1" title="An AI agent's judgment that passed the source checks; confirm it">Needs review</Badge>}
                  {item.satisfaction && (
                    <div className="mt-1">
                      <Badge bg={SATISFACTION_COLORS[item.satisfaction]} className="fw-normal">{item.satisfaction}</Badge>
                      {item.satisfaction !== "Satisfied" && item.covered?.length > 0 && <span className="text-success ms-1">Covered: {item.covered.join(", ")}</span>}
                      {item.unmet?.length > 0 && <span className="text-danger ms-1">Not demonstrated: {item.unmet.join(", ")}</span>}
                      {item.toConfirm?.length > 0 && <span className="text-info-emphasis ms-1">To confirm: {item.toConfirm.join(", ")}</span>}
                      {item.probablyNotNeeded?.length > 0 && <span className="text-body-secondary ms-1">Probably not needed: {item.probablyNotNeeded.join(", ")}</span>}
                      {item.ambiguity && (
                        <div className="text-body-secondary">
                          {item.ambiguity.interpretations
                            ? <>Read with the rest of the job: {item.ambiguity.interpretations.map((entry) => `${entry.reading} ${percent(entry.confidence)} likely (${percent(entry.score)} if so)`).join(" · ")}; scored {percent(item.ambiguity.score)}</>
                            : <>All of {item.ambiguity.terms.join(", ")}: {percent(item.ambiguity.asAll)} · any one: {percent(item.ambiguity.asAny)}</>}
                          {item.ambiguity.reasons?.length > 0 && <div className="text-muted">Why: {item.ambiguity.reasons.join("; ")}</div>}
                        </div>
                      )}
                    </div>
                  )}
                  {!unscored && item.pointsLost > 0 && item.explanation?.includes("Why: ") && (
                    <div className="text-body-secondary mt-1" title={item.explanation}>
                      <i className="bi bi-calculator me-1" aria-hidden="true" />{item.pointsLost} pts not earned: {item.explanation.split("Why: ")[1]}
                    </div>
                  )}
                  {item.capabilities && (
                    <ul className="list-unstyled mb-0 mt-1 ps-2 border-start">
                      {item.capabilities.map((capability) => (
                        <li key={capability.capability} className="d-flex flex-wrap gap-1 align-items-center">
                          <span>{capability.capability}</span> <MatchBadge match={capability.match} /> <span className="text-muted">{percent(capability.score)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {item.logic?.filter((group) => group.mode === "any" && group.terms.length > 1).map((group) => (
                    <div key={group.terms.join("|")} className="mt-1 text-body-secondary">
                      {group.operator?.startsWith("at least") ? `${group.operator[0].toUpperCase()}${group.operator.slice(1)}` : "Any one of"}: {group.terms.join(" / ")}
                      {group.flexible && " (or a tool that does the same job)"}
                      <span className="text-muted"> · read as {group.operator}{group.score > 0 ? `; counted: ${(group.chosen || [group.best]).join(", ")}` : "; none shown"}</span>
                    </div>
                  ))}
                  {item.terms?.length > 1 && (
                    <ul className="list-unstyled mb-0 mt-1 ps-2 border-start">
                      {item.terms.map((term) => (
                        <li key={term.term} className={`d-flex flex-wrap gap-1 align-items-center${term.alternative ? " text-muted" : ""}`}>
                          <span>{term.term}</span> <MatchBadge match={term.match} />{term.via && <span className="text-muted">via {term.via}</span>}
                          {term.alternative && <span className="fst-italic">(alternative, not needed)</span>}
                          {term.alternativeLikely && <span className="fst-italic">(probably not needed)</span>}
                          {term.confirmedByCandidate && <span className="fst-italic">(self-reported)</span>}
                          {term.flexibleMatch && <span className="text-success">(does the same job)</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="text-muted">
                  {WORDING[item.wording] || "Required"}
                  {IMPORTANCE[item.importance] && <div><Badge bg="light" text="dark" className="fw-normal border">{IMPORTANCE[item.importance]}</Badge></div>}
                </td>
                <td>{unscored ? "—" : <MatchBadge match={item.match} />}</td>
                <td title={item.explanation}>{unscored ? "—" : percent(item.score)}</td>
                <td className="text-nowrap">
                  {unscored ? "—" : <><strong>{item.points ?? 0}</strong><span className="text-muted"> of {Math.round(((item.points ?? 0) + (item.pointsLost ?? 0)) * 10) / 10}</span></>}
                </td>
                <td className="text-muted">
                  {CONFIDENCE[item.confidence] || "—"}
                  {item.record?.verification && <div className="small" title="How this requirement is verified">{item.record.verification}</div>}
                </td>
                <td className="text-muted">
                  <Evidence item={item.terms?.length === 1 ? { ...item.terms[0], ...item, evidence: item.evidence || item.terms[0].evidence } : item} />
                  {item.capabilities?.filter((capability) => capability.evidence.length).slice(0, 2).map((capability) => (
                    <div key={capability.capability}><strong>{capability.capability}:</strong> “{capability.evidence[0].text.slice(0, 110)}”</div>
                  ))}
                </td>
              </tr>
              );
            })}
          </tbody>
        </Table>
      </Card.Body>
    </Card>
  );
}

// Direct matches, equivalents, partial matches, gaps, eligibility, seniority
function Findings({ match, ats }) {
  const { findings } = match;
  const parsingIssues = [
    ...(findings.parsingIssues || []),
    ...match.profile.filter((item) => item.required && !item.found).map((item) => `No ${item.field.toLowerCase()} could be read`),
    ...ats.checks.filter((item) => item.status === "fail").map((item) => item.label)
  ];
  const chips = (list, color) => (
    <div className="d-flex flex-wrap gap-1">
      {list.map((text) => <Badge key={text} bg={`${color}-subtle`} text={color === "warning" ? "warning-emphasis" : color} className="fw-normal text-wrap text-start">{text}</Badge>)}
    </div>
  );

  return (
    <Card className="shadow-sm mb-4">
      <Card.Body>
        <Card.Title as="h5">Additional findings</Card.Title>
        <Row className="g-3 small">
          <Col md={6}>
            <div className="fw-semibold mb-1"><i className="bi bi-check2-circle text-success me-1" aria-hidden="true" />Direct matches</div>
            {findings.direct.length ? chips(findings.direct, "success") : <span className="text-muted">None</span>}
          </Col>
          <Col md={6}>
            <div className="fw-semibold mb-1"><i className="bi bi-arrow-left-right text-success me-1" aria-hidden="true" />Equivalent skills</div>
            {findings.equivalent.length ? chips(findings.equivalent.map((item) => `${item.requirement} ← ${item.evidence}`), "success") : <span className="text-muted">None</span>}
          </Col>
          <Col md={6}>
            <div className="fw-semibold mb-1"><i className="bi bi-circle-half text-warning me-1" aria-hidden="true" />Partial matches</div>
            {findings.partial.length ? (
              <ul className="ps-3 mb-0">
                {findings.partial.slice(0, 10).map((item, index) => (
                  <li key={index}><strong>{item.requirement}</strong>{item.via ? ` via ${item.via}` : ""}: <span className="text-muted">{item.note}</span></li>
                ))}
              </ul>
            ) : <span className="text-muted">None</span>}
          </Col>
          <Col md={6}>
            <div className="fw-semibold mb-1"><i className="bi bi-x-circle text-danger me-1" aria-hidden="true" />Genuine gaps <span className="fw-normal text-muted">(not demonstrated on the resume, which isn't proof of missing ability)</span></div>
            {findings.gaps.length ? chips(findings.gaps, "danger") : <span className="text-success">No required gaps</span>}
            {findings.preferredGaps?.length > 0 && (
              <div className="mt-2"><span className="text-muted">Preferred, not shown:</span> {chips(findings.preferredGaps, "warning")}</div>
            )}
          </Col>
          <Col md={6}>
            <div className="fw-semibold mb-1"><i className="bi bi-person-badge me-1" aria-hidden="true" />Seniority</div>
            <div>Role: <strong>{match.seniority.job}</strong> · Resume reads: <strong>{match.seniority.candidate}</strong></div>
            <div className="text-muted">{match.years.professional} years professional{match.years.other ? ` + ${match.years.other} internship or similar (not counted)` : ""}</div>
            {(match.years.requirements || []).map((item) => (
              <div key={item.text}>
                {item.text}: <strong>{item.classification}</strong>
                <span className="text-muted"> ({item.demonstrated} of {item.requested} years{item.field !== "any professional work" ? ` in ${item.field}` : ""}{item.shortfall ? `, ${item.shortfall} short` : ""}, {item.coverage}% coverage{item.importance === "preferred" ? ", preferred" : ""})</span>
              </div>
            ))}
            {!match.years.requirements && match.years.required && <div>Experience requirement: <strong>{match.years.required.status}</strong> ({match.years.professional} of {match.years.required.minYears} years documented{match.years.required.strict ? "; the job says it's strict" : ""})</div>}
            {match.seniority.flags.map((flag) => <div key={flag} className="text-warning-emphasis">{flag}</div>)}
          </Col>
          <Col md={6}>
            <div className="fw-semibold mb-1"><i className="bi bi-file-earmark-x me-1" aria-hidden="true" />ATS parsing issues</div>
            {parsingIssues.length ? chips(parsingIssues, "danger") : <span className="text-success">None found</span>}
            {findings.contradictions && (
              <>
                <div className="fw-semibold mb-1 mt-3" title="Inconsistencies on the resume itself; they don't change the score"><i className="bi bi-exclamation-diamond me-1" aria-hidden="true" />Consistency check</div>
                {findings.contradictions.length
                  ? <ul className="mb-0 ps-3">{findings.contradictions.map((entry) => <li key={entry.detail} className="text-warning-emphasis">{entry.detail}</li>)}</ul>
                  : <span className="text-success">Dates, years and claims agree</span>}
              </>
            )}
          </Col>
          {findings.uncertain?.length > 0 && (
            <Col md={6}>
              <div className="fw-semibold mb-1"><i className="bi bi-question-circle me-1" aria-hidden="true" />Uncertain <span className="fw-normal text-muted">(no credit until reviewed; not counted as gaps)</span></div>
              <ul className="ps-3 mb-0">
                {findings.uncertain.map((item, index) => (
                  <li key={index}><strong>{item.term}</strong>{item.bullet ? <>: possibly “{item.bullet.slice(0, 100)}” <span className="text-muted">({item.where})</span></> : ""}</li>
                ))}
              </ul>
            </Col>
          )}
          {(findings.inferred?.length > 0 || findings.toConfirm?.length > 0) && (
            <Col md={6}>
              <div className="fw-semibold mb-1"><i className="bi bi-diagram-3 me-1" aria-hidden="true" />Inferred from your work <span className="fw-normal text-muted">(provisional credit, not verified)</span></div>
              <ul className="ps-3 mb-0">
                {(findings.inferred || []).map((item) => <li key={`i-${item.term}`}><strong>{item.term}</strong>: strongly inferred from {item.from}</li>)}
                {(findings.toConfirm || []).map((item) => <li key={`c-${item.term}`}><strong>{item.term}</strong>: plausible from {item.from}; needs confirmation, not counted as a gap</li>)}
              </ul>
            </Col>
          )}
          {findings.unverified?.length > 0 && (
            <Col md={6}>
              <div className="fw-semibold mb-1"><i className="bi bi-eye-slash me-1" aria-hidden="true" />Unverified <span className="fw-normal text-muted">(can't be judged from a resume; not scored)</span></div>
              <ul className="ps-3 mb-0">
                {findings.unverified.map((text) => <li key={text}>{text}</li>)}
              </ul>
            </Col>
          )}
          {findings.needsReview?.length > 0 && (
            <Col md={6}>
              <div className="fw-semibold mb-1"><i className="bi bi-robot me-1" aria-hidden="true" />Agent judgments to review</div>
              <ul className="ps-3 mb-0">
                {findings.needsReview.map((item, index) => (
                  <li key={index}>
                    <strong>{item.requirement.slice(0, 70)}</strong>
                    {item.explanation?.capability ? `: ${item.explanation.capability}` : ""}
                    {item.evidence?.where ? <span className="text-muted"> ({item.evidence.where})</span> : null}
                  </li>
                ))}
              </ul>
            </Col>
          )}
        </Row>
      </Card.Body>
    </Card>
  );
}

function Eligibility({ eligibility }) {
  return (
    <Card className="shadow-sm mb-4">
      <Card.Body>
        <Card.Title as="h5">Eligibility</Card.Title>
        <p className="small text-muted">Screening conditions, reported separately from the score. Nothing is assumed from silence.</p>
        {eligibility.length === 0 ? (
          <div className="small text-muted">The job states no hard screening conditions.</div>
        ) : (
          <Table size="sm" responsive className="small mb-0 align-middle">
            <tbody>
              {eligibility.map((item, index) => (
                <tr key={index}>
                  <td style={{ width: 200 }} className="fw-semibold">{item.condition}</td>
                  <td style={{ width: 90 }}><Badge bg={ELIGIBILITY_COLORS[item.status]}>{item.status}</Badge></td>
                  <td>
                    <div className="text-muted">“{item.text}”</div>
                    <div>{item.detail}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card.Body>
    </Card>
  );
}

// M = Σ category score × weight, and the checks run before scoring
function Calculation({ match }) {
  const categories = Object.values(match.categories);
  return (
    <Card className="shadow-sm mb-4">
      <Card.Body>
        <Card.Title as="h5">How the score was calculated</Card.Title>
        <p className="small text-muted mb-2">
          Coverage is how much of a requirement is shown, including transferable credit; a requirement with any part not demonstrated is still <strong>Not satisfied</strong>, whatever its coverage.
          Each requirement starts from an anchor (direct 100, equivalent 95, strongly related 85, inferred 80/60/0 for familiarity/hands-on/proficiency, partial 65, listed only 50, not demonstrated 0), adjusted for how deeply the job asks
          (familiarity, hands-on or proficiency) and how credible the evidence is (work, internship, or a project's production/prototype/tutorial level). Requirements repeated across the job count once.
          In &ldquo;A or B&rdquo; and &ldquo;such as&rdquo; lists any one alternative satisfies the requirement; in &ldquo;A and B&rdquo; lists each part counts. Items that can&apos;t be judged from a resume (AI coding tools) are shown as Unverified and not scored.
          Category scores are combined as 0.40 Required + 0.30 Responsibilities + 0.15 Preferred + 0.10 Domain + 0.05 Education.
        </p>
        <Table size="sm" className="small mb-2">
          <thead><tr><th>Category</th><th className="text-end">Score</th><th className="text-end">Weight</th><th className="text-end">Points</th></tr></thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.key} className={category.score === null ? "text-muted" : ""}>
                <td>{category.label}</td>
                <td className="text-end">{category.score === null ? "n/a" : `${Math.round(category.score)}%`}</td>
                <td className="text-end">{Math.round(category.weight * 100)}%</td>
                <td className="text-end">{category.contribution}</td>
              </tr>
            ))}
            <tr className="fw-semibold"><td>Evidence-based score</td><td /><td className="text-end">100%</td><td className="text-end">{match.overall}</td></tr>
          </tbody>
        </Table>
        {match.weights.note && <div className="small text-muted mb-2">{match.weights.note}</div>}
        {match.structure?.headings?.length > 0 && (
          <div className="small text-muted mb-2">Headings left out of scoring: {match.structure.headings.join(", ")}</div>
        )}
        {match.structure?.excluded?.length > 0 && (
          <div className="small text-muted mb-2">The job says these aren&apos;t needed, so they aren&apos;t scored: {match.structure.excluded.map((text) => `“${text}”`).join(", ")}</div>
        )}
        <Button
          size="sm"
          variant="outline-secondary"
          className="mb-3"
          onClick={() => {
            const blob = new Blob([JSON.stringify(match, null, 2)], { type: "application/json" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `match-trace-${(match.header.role || "job").replace(/[^\w-]+/g, "_")}.json`;
            link.click();
            URL.revokeObjectURL(link.href);
          }}
        >
          <i className="bi bi-download me-1" />Download full trace (JSON)
        </Button>
        <div className="small fw-semibold mb-1">Quality checks</div>
        <ul className="list-unstyled small mb-0">
          {match.quality.map((check) => (
            <li key={check.check}>
              <i className={`bi ${check.passed ? "bi-check-circle text-success" : "bi-exclamation-circle text-warning"} me-1`} aria-hidden="true" />
              {check.check}{check.detail ? <span className="text-muted"> ({check.detail})</span> : null}
            </li>
          ))}
        </ul>
      </Card.Body>
    </Card>
  );
}

const CHECK_ICONS = {
  pass: "bi-check-circle-fill text-success",
  warn: "bi-exclamation-triangle-fill text-warning",
  fail: "bi-x-circle-fill text-danger"
};

// How an applicant tracking system will read the file
function AtsCheck({ ats }) {
  const order = { fail: 0, warn: 1, pass: 2 };
  const checks = [...ats.checks].sort((a, b) => order[a.status] - order[b.status]);
  const count = (status) => ats.checks.filter((item) => item.status === status).length;

  return (
    <Card className="shadow-sm mb-4">
      <Card.Body>
        <Row className="g-3 align-items-center mb-2">
          <Col xs="auto">
            <div className={`resume-score border-${scoreColor(ats.score)} text-${scoreColor(ats.score)}`}>{ats.score}</div>
          </Col>
          <Col>
            <div className="fw-semibold">ATS readability</div>
            <div className="small text-muted">
              {count("fail")} to fix, {count("warn")} to improve, {count("pass")} passed
            </div>
          </Col>
        </Row>
        <ListGroup variant="flush" className="small">
          {checks.map((item) => (
            <ListGroup.Item key={item.id} className="px-0 d-flex gap-2">
              <i className={`bi ${CHECK_ICONS[item.status]} mt-1`} aria-label={item.status} />
              <div>
                <div className="fw-semibold">{item.label}</div>
                <div className="text-muted">{item.detail}</div>
              </div>
            </ListGroup.Item>
          ))}
        </ListGroup>
      </Card.Body>
    </Card>
  );
}

// How much of the job's own wording the resume uses (what an ATS matches on)
function KeywordCoverage({ keywords }) {
  if (!keywords.items.length) return null;
  return (
    <Card className="shadow-sm mb-4">
      <Card.Body>
        <div className="d-flex align-items-center justify-content-between mb-2">
          <Card.Title as="h5" className="mb-0">Keyword coverage</Card.Title>
          {keywords.score !== null && <Badge bg={scoreColor(keywords.score)}>{keywords.score}%</Badge>}
        </div>
        <p className="small text-muted">ATS software matches the job's exact terms. An equivalent tool counts for fit, not here. Only add a term you can back up.</p>
        <div className="d-flex flex-wrap gap-1">
          {keywords.items.map((item) => (
            <Badge
              key={item.text}
              bg={item.present ? "success-subtle" : item.via ? "warning-subtle" : "secondary-subtle"}
              text={item.present ? "success" : item.via ? "warning-emphasis" : "secondary"}
              className="fw-normal"
              title={item.via ? `Resume shows ${item.via}` : item.where?.join(", ")}
            >
              <i className={`bi ${item.present ? "bi-check2" : item.via ? "bi-arrow-left-right" : "bi-dash"} me-1`} aria-hidden="true" />
              {item.text}{item.importance === "preferred" ? " (preferred)" : ""}{item.via && !item.present ? ` ← ${item.via}` : ""}
            </Badge>
          ))}
        </div>
      </Card.Body>
    </Card>
  );
}

// Genuine gap, experience the resume doesn't show clearly, or confirmed by you but not written down
const RECOMMENDATION_TYPES = {
  gap: ["Genuine gap", "danger-subtle", "danger-emphasis"],
  documentation: ["Missing documentation", "warning-subtle", "warning-emphasis"],
  confirmed: ["Confirmed, not on resume", "primary-subtle", "primary-emphasis"]
};
const PRIORITIES = { 1: "Parsing errors", 2: "Required capabilities", 3: "Responsibility alignment", 4: "Preferred capabilities", 5: "Keyword consistency" };

// What doesn't match and what to change, by expected impact
// A rewrite's new text with what it adds marked
function marked(before, after) {
  let start = 0;
  while (start < before.length && before[start] === after[start]) start += 1;
  let end = 0;
  while (end < before.length - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end += 1;
  return <>{after.slice(0, start)}<mark>{after.slice(start, after.length - end)}</mark>{after.slice(after.length - end)}</>;
}

// Bullets from the resume, rewritten to name what the job asks for where the
// work already shows it, and the score with every rewrite in place
function Rewrites({ rewrites }) {
  const [copied, setCopied] = useState(-1);
  if (!rewrites?.suggestions?.length) return null;
  const { suggestions, before, after } = rewrites;
  const copy = (text, index) => navigator.clipboard?.writeText(text).then(() => setCopied(index)).catch(() => {});
  const gain = (key) => (before?.[key] != null && after?.[key] != null ? after[key] - before[key] : null);

  return (
    <Card className="shadow-sm mb-4">
      <Card.Body>
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
          <div>
            <Card.Title as="h5" className="mb-1">Suggested rewrites</Card.Title>
            <div className="small text-muted">Your own bullets, naming what the job asks for where your work already shows it. Nothing new is invented; check each one is true before you use it.</div>
          </div>
          {before && after && (
            <div className="d-flex gap-3 text-center small" aria-label="Score before and after the rewrites">
              <div>
                <div className="text-muted">Match</div>
                <div className="fw-semibold">{before.match}% <i className="bi bi-arrow-right" aria-hidden="true" /> <span className={gain("match") > 0 ? "text-success" : ""}>{after.match}%</span></div>
              </div>
              {before.keywords != null && (
                <div>
                  <div className="text-muted">Keywords</div>
                  <div className="fw-semibold">{before.keywords}% <i className="bi bi-arrow-right" aria-hidden="true" /> <span className={gain("keywords") > 0 ? "text-success" : ""}>{after.keywords}%</span></div>
                </div>
              )}
            </div>
          )}
        </div>
        <ListGroup variant="flush" className="small">
          {suggestions.map((rewrite, index) => (
            <ListGroup.Item key={rewrite.before} className="px-0">
              <div className="d-flex flex-wrap align-items-center gap-1 mb-1">
                {rewrite.changes.map((change) => <Badge key={change.term} bg="primary-subtle" text="primary" className="fw-normal">{change.term}</Badge>)}
                {rewrite.check && <Badge bg="warning-subtle" text="dark" className="fw-normal"><i className="bi bi-exclamation-circle me-1" aria-hidden="true" />Only if true</Badge>}
                {rewrite.where && <span className="text-muted ms-1">{rewrite.where}</span>}
              </div>
              <div className="text-muted text-decoration-line-through">{rewrite.before}</div>
              <div className="mt-1">{marked(rewrite.before, rewrite.after)}</div>
              <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mt-1">
                <ul className="text-muted mb-0 ps-3">{rewrite.why.map((line) => <li key={line}>{line}</li>)}</ul>
                <Button size="sm" variant="outline-secondary" onClick={() => copy(rewrite.after, index)}>
                  <i className={`bi ${copied === index ? "bi-check2" : "bi-clipboard"} me-1`} aria-hidden="true" />{copied === index ? "Copied" : "Copy"}
                </Button>
              </div>
            </ListGroup.Item>
          ))}
        </ListGroup>
      </Card.Body>
    </Card>
  );
}

function Recommendations({ recommendations, missing }) {
  const [priority, setPriority] = useState(0);
  const present = [...new Set(recommendations.map((item) => item.priority))];
  const shown = priority ? recommendations.filter((item) => item.priority === priority) : recommendations;

  return (
    <Card className="shadow-sm mb-4">
      <Card.Body>
        <Card.Title as="h5">What doesn't match &amp; recommendations</Card.Title>

        <div className="mb-3">
          <div className="small fw-semibold mb-1">What's missing</div>
          {missing.length ? (
            <div className="d-flex flex-wrap gap-1">
              {missing.map((text) => <Badge key={text} bg="danger-subtle" text="danger" className="fw-normal text-wrap text-start">{text}</Badge>)}
            </div>
          ) : (
            <div className="small text-success"><i className="bi bi-check-circle me-1" aria-hidden="true" />Nothing the job requires is missing.</div>
          )}
        </div>

        {recommendations.length > 0 && (
          <>
            <div className="d-flex flex-wrap gap-1 mb-2" role="group" aria-label="Filter by priority">
              <Button size="sm" variant={priority === 0 ? "primary" : "outline-secondary"} onClick={() => setPriority(0)}>
                All <Badge bg="light" text="dark" className="ms-1">{recommendations.length}</Badge>
              </Button>
              {present.map((value) => (
                <Button key={value} size="sm" variant={priority === value ? "primary" : "outline-secondary"} onClick={() => setPriority(value)}>
                  P{value} {PRIORITIES[value]} <Badge bg="light" text="dark" className="ms-1">{recommendations.filter((item) => item.priority === value).length}</Badge>
                </Button>
              ))}
            </div>
            <div className="border rounded" style={{ maxHeight: 380, overflowY: "auto" }} tabIndex={0} aria-label="Recommendations">
              <ListGroup variant="flush" className="small">
                {shown.map((item, index) => (
                  <ListGroup.Item key={`${item.priority}-${index}`} className="d-flex gap-2">
                    <Badge bg={item.priority <= 2 ? "danger" : item.priority === 3 ? "warning" : "secondary"} text={item.priority === 3 ? "dark" : undefined} className="align-self-start mt-1">P{item.priority}</Badge>
                    <div className="flex-grow-1">
                      <div className="fw-semibold">
                        {item.issue} <span className="fw-normal text-muted">· {item.area}</span>
                        {RECOMMENDATION_TYPES[item.type] && <Badge bg={RECOMMENDATION_TYPES[item.type][1]} text={RECOMMENDATION_TYPES[item.type][2]} className="fw-normal ms-1">{RECOMMENDATION_TYPES[item.type][0]}</Badge>}
                      </div>
                      <div className="text-muted mt-1"><i className="bi bi-lightbulb me-1" aria-hidden="true" />{item.recommendation}</div>
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </div>
          </>
        )}
      </Card.Body>
    </Card>
  );
}

// Questions about skills the resume implies but doesn't state, one at a
// time in a horizontal strip: answering moves on to the next open question.
// An answer re-scores the saved comparison (shown apart from the resume-only
// score); nothing is added to the resume itself.
const ANSWERS = [["yes", "Yes, I have", "success"], ["no", "No", "danger"], [null, "Not sure / skip", "secondary"]];
const QUESTION_KINDS = { inferred: ["Strongly inferred", "info"], confirm: ["Needs confirmation", "secondary"], unverified: ["Can't be seen on a resume", "secondary"] };
function ConfirmExperience({ match, logId, onUpdate }) {
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const questions = match.findings.confirmable || [];
  // Opens on the first question not answered yet
  const [current, setCurrent] = useState(() => Math.max(0, questions.findIndex((question) => !question.answer)));
  const [skipped, setSkipped] = useState([]);
  const strip = useRef(null);

  useEffect(() => {
    if (strip.current) strip.current.scrollLeft = current * strip.current.clientWidth;
    // Only on mount: later moves scroll smoothly through show()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow the strip when it's scrolled by hand
  useEffect(() => {
    const element = strip.current;
    if (!element) return undefined;
    const onScroll = () => setCurrent(Math.round(element.scrollLeft / Math.max(1, element.clientWidth)));
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => element.removeEventListener("scroll", onScroll);
  }, [questions.length]);

  if (!questions.length) return null;

  const show = (index) => {
    const target = Math.max(0, Math.min(questions.length - 1, index));
    setCurrent(target);
    strip.current?.scrollTo({ left: target * strip.current.clientWidth, behavior: "smooth" });
  };
  // The next question still open after this one (wrapping round), if any
  const nextOpen = (index, answered) => {
    for (let step = 1; step < questions.length; step += 1) {
      const candidate = (index + step) % questions.length;
      const question = questions[candidate];
      if (!question.answer && !answered.includes(question.key)) return candidate;
    }
    return -1;
  };

  const answer = async (question, index, value) => {
    setError("");
    if (value === null && !question.answer) {
      // Skipping an open question needs no save
      const next = nextOpen(index, [...skipped, question.key]);
      setSkipped((list) => [...list, question.key]);
      if (next >= 0) show(next);
      return;
    }
    setSaving(question.key);
    try {
      const { data } = await confirmMatchLog(logId, { [question.key]: value });
      onUpdate(data);
      const next = nextOpen(index, [...skipped, question.key]);
      if (next >= 0) setTimeout(() => show(next), 150);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Couldn't save your answer.");
    } finally {
      setSaving("");
    }
  };

  const answeredCount = questions.filter((question) => question.answer).length;

  return (
    <Card className="shadow-sm mb-4">
      <Card.Body>
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <Card.Title as="h5" className="mb-0">Confirm your experience</Card.Title>
          <span className="small text-muted">{answeredCount} of {questions.length} answered</span>
        </div>
        <p className="small text-muted mt-1 mb-2">
          Only questions whose answer could change the score are asked, biggest first. Answers are self-reported: the score with
          them is shown next to the resume-only score, and confirmed skills still need to be written into the resume.
        </p>
        {error && <Alert variant="danger" className="small py-2">{error}</Alert>}

        <div className="confirm-strip" ref={strip} tabIndex={0} aria-label="Confirmation questions" role="region">
          {questions.map((question, index) => {
            const [kindLabel, kindColor] = QUESTION_KINDS[question.kind] || QUESTION_KINDS.confirm;
            return (
              <section key={question.key} className="confirm-card" aria-label={`Question ${index + 1} of ${questions.length}`} aria-hidden={index !== current}>
                <div className="small text-muted mb-1">Question {index + 1} of {questions.length}</div>
                <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                  <strong>{question.label}</strong>
                  <Badge bg={kindColor} className="fw-normal">{kindLabel}</Badge>
                  {question.impact > 0 && <Badge bg="light" text="dark" className="fw-normal border" title="How many points of the score this answer can change">affects up to {question.impact} pts</Badge>}
                  {question.answer && <Badge bg={question.answer === "yes" ? "success" : "danger"} className="fw-normal">You said {question.answer}</Badge>}
                </div>
                <div className="fs-6 mb-1">{question.question}</div>
                {question.from && <div className="small text-muted">Your resume shows: {question.from}</div>}
                {question.requirement && <div className="small text-muted text-truncate" title={question.requirement}>For: {question.requirement}</div>}
                {logId ? (
                  <div className="d-flex flex-wrap gap-2 mt-3" role="group" aria-label={`Answer for ${question.label}`}>
                    {ANSWERS.map(([value, label, color]) => (
                      <Button
                        key={label}
                        size="sm"
                        variant={question.answer === value && value ? color : `outline-${color}`}
                        disabled={Boolean(saving) || index !== current}
                        onClick={() => answer(question, index, value)}
                      >
                        {saving === question.key && question.answer !== value ? "Saving…" : label}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="small text-muted fst-italic mt-2">Answering needs a saved comparison (Log Book).</div>
                )}
              </section>
            );
          })}
        </div>

        {questions.length > 1 && (
          <div className="d-flex align-items-center justify-content-between mt-2">
            <Button size="sm" variant="link" className="text-decoration-none px-0" disabled={current === 0} onClick={() => show(current - 1)}>
              <i className="bi bi-chevron-left" aria-hidden="true" /> Previous
            </Button>
            <div className="d-flex gap-2" role="tablist" aria-label="Questions">
              {questions.map((question, index) => (
                <button
                  key={question.key}
                  type="button"
                  role="tab"
                  aria-selected={index === current}
                  aria-label={`Question ${index + 1}: ${question.label}${question.answer ? `, answered ${question.answer}` : ""}`}
                  className={`confirm-dot${index === current ? " is-current" : ""}${question.answer ? " is-answered" : ""}`}
                  onClick={() => show(index)}
                />
              ))}
            </div>
            <Button size="sm" variant="link" className="text-decoration-none px-0" disabled={current === questions.length - 1} onClick={() => show(current + 1)}>
              Next <i className="bi bi-chevron-right" aria-hidden="true" />
            </Button>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

// result: the compare response (or a saved log's result)
// logId + onUpdate: lets the candidate answer confirmation questions
export default function MatchResults({ result, logId = null, onUpdate = () => {} }) {
  const { match, ats } = result;

  // Entries saved before the assessment format can't be shown in full
  if (!match.categories) {
    return <Alert variant="warning">This entry was saved in an older format. Compare the resume again to see the full assessment.</Alert>;
  }

  const header = [match.header.company, match.header.role, match.header.location, match.header.seniority !== "Not stated" ? match.header.seniority : ""].filter(Boolean);

  return (
    <>
      <Tabs defaultActiveKey="match" id="resume-match-tabs" className="mb-3" mountOnEnter>
        <Tab eventKey="match" title={<>Job match <Badge bg={scoreColor(match.overall)} className="ms-1">{match.overall}%</Badge></>}>
          <Card className="shadow-sm mb-4">
            <Card.Body>
              <div className="small text-uppercase text-muted fw-semibold">Job Match Assessment</div>
              <div className="mb-3">{header.length ? header.join(" • ") : "Untitled job"}</div>
              <Row className="g-3 align-items-center">
                <Col md={4} className="text-center">
                  <div className={`resume-score mx-auto border-${scoreColor(match.overall)} text-${scoreColor(match.overall)}`}>{match.overall}%</div>
                  <div className="small fw-semibold mt-1">Evidence-based score</div>
                  {typeof match.fit === "number" && match.fit !== match.overall && (
                    <div className="small text-muted" title="Leaves out what the resume doesn't document either way (items that need your confirmation) instead of counting it as 0">
                      Job fit on what can be assessed: <strong>{match.fit}%</strong>
                      {match.needsConfirmation ? ` · ${match.needsConfirmation} to confirm` : ""}
                    </div>
                  )}
                  {match.resumeOnly && (
                    <div className="small mt-1" title="Your answers are self-reported; employers see only the resume">
                      <Badge bg="primary-subtle" text="primary-emphasis" className="fw-normal">With your answers</Badge>{" "}
                      <span className="text-muted">Resume only: <strong>{match.resumeOnly.overall}%</strong></span>
                    </div>
                  )}
                  <Badge bg={scoreColor(match.overall)} className="mt-1">{match.classification}</Badge>
                  <div className="fw-semibold mt-1">{match.recommendation}</div>
                  <div className="small text-muted">{result.aiUsed ? "AI agents helped read the job" : "Rules only (AI not running)"}</div>
                </Col>
                <Col md={8}>
                  {Object.values(match.categories).map((category) => category.score !== null && (
                    <div key={category.key} className="mb-2">
                      <div className="d-flex justify-content-between small">
                        <span>{category.label} <span className="text-muted">({Math.round(category.weight * 100)}%)</span></span>
                        <strong>{Math.round(category.score)}%</strong>
                      </div>
                      <ProgressBar now={category.score} variant={scoreColor(category.score)} style={{ height: 6 }} />
                    </div>
                  ))}
                  {match.roleFamily && <div className="small text-muted mt-2">Evaluated as a {match.roleFamily} role.</div>}
                </Col>
              </Row>
              {match.blocked.length > 0 && (
                <Alert variant="danger" className="small mt-3 mb-0">
                  <i className="bi bi-shield-exclamation me-1" aria-hidden="true" />
                  Not met: {match.blocked.join(", ")}. A high score doesn't override a mandatory requirement.
                </Alert>
              )}
              {result.notes.length > 0 && (
                <ul className="small text-muted mt-3 mb-0 ps-3">
                  {result.notes.map((note) => <li key={note}>{note}</li>)}
                </ul>
              )}
              <div className="small text-muted mt-2">Score bands are decision aids, not the chance of an interview.</div>
            </Card.Body>
          </Card>

          <ConfirmExperience match={match} logId={logId} onUpdate={onUpdate} />
          <h5 className="mb-2">Detailed evaluation</h5>
          {Object.values(match.categories).map((category) => <Category key={category.key} category={category} />)}
          <Findings match={match} ats={ats} />
          <Eligibility eligibility={match.eligibility} />
          <Profile profile={match.profile} />
          <Calculation match={match} />
        </Tab>
        <Tab eventKey="ats" title={<>ATS check <Badge bg={scoreColor(ats.score)} className="ms-1">{ats.score}</Badge></>}>
          <AtsCheck ats={ats} />
          <KeywordCoverage keywords={match.keywords} />
        </Tab>
      </Tabs>

      <Rewrites rewrites={result.rewrites} />
      <Recommendations recommendations={result.recommendations} missing={missingItems(result)} />
    </>
  );
}
