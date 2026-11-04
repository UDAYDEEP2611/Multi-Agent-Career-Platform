import { useState } from "react";
import { Alert, Badge, Button, Card, Collapse, Form, Spinner } from "react-bootstrap";

import { generateSummaries } from "../../api/summaryApi";
import SummaryChecks from "./SummaryChecks";

// Writes five versions of the summary from the portfolio; the person picks
// one to save as is or to edit first
export default function SummaryAiWriter({ busy, onUse, onEdit }) {
  const [targetTitle, setTargetTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [showJob, setShowJob] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const generate = async (event) => {
    event.preventDefault();
    setGenerating(true);
    setError("");

    try {
      const { data } = await generateSummaries({ targetTitle, jobDescription, instructions });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to write summaries right now");
      if (err.response?.data?.notes) setResult({ variants: [], notes: err.response.data.notes });
    } finally {
      setGenerating(false);
    }
  };

  const copy = async (variant) => {
    try {
      await navigator.clipboard.writeText(variant.summary);
      setCopied(variant.id);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setCopied("");
    }
  };

  return (
    <Card className="border-0 shadow-sm mt-4 summary-ai-card">
      <Card.Header className="bg-body border-bottom px-4 py-3">
        <h5 className="fw-semibold mb-1">
          <i className="bi bi-stars me-2 summary-ai-icon" aria-hidden="true" />
          AI Summary Writer
        </h5>
        <p className="small text-secondary mb-0">
          Get 5 versions in different styles, written only from your portfolio. Each one states your
          job title, years of experience, key skills and a measured result, and is checked so it never
          adds numbers, tools or employers you don't have.
        </p>
      </Card.Header>

      <Card.Body className="p-4">
        <Form onSubmit={generate}>
          <div className="row g-3">
            <Form.Group className="col-md-5" controlId="summary-target-title">
              <Form.Label className="small fw-semibold">Target role <span className="text-secondary fw-normal">(optional)</span></Form.Label>
              <Form.Control
                value={targetTitle}
                maxLength={120}
                onChange={(e) => setTargetTitle(e.target.value)}
                placeholder="e.g. Senior AI Engineer"
                disabled={generating}
              />
            </Form.Group>

            <Form.Group className="col-md-7" controlId="summary-instructions">
              <Form.Label className="small fw-semibold">How to modify it <span className="text-secondary fw-normal">(optional)</span></Form.Label>
              <Form.Control
                value={instructions}
                maxLength={500}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g. emphasize RAG and agents, keep it under 80 words"
                disabled={generating}
              />
            </Form.Group>
          </div>

          <Button
            variant="link"
            size="sm"
            className="px-0 mt-2"
            onClick={() => setShowJob((open) => !open)}
            aria-expanded={showJob}
            aria-controls="summary-job-description"
          >
            <i className={`bi ${showJob ? "bi-chevron-up" : "bi-chevron-down"} me-1`} aria-hidden="true" />
            {showJob ? "Hide job description" : "Tailor to a job description"}
          </Button>
          <Collapse in={showJob}>
            <div id="summary-job-description">
              <Form.Control
                as="textarea"
                rows={5}
                maxLength={20000}
                className="mt-2"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description: the Role-targeted version is worded toward it, using only skills you have."
                disabled={generating}
                aria-label="Job description"
              />
            </div>
          </Collapse>

          <div className="d-flex align-items-center flex-wrap gap-3 mt-3">
            <Button type="submit" className="summary-ai-button" disabled={generating || busy}>
              {generating ? (
                <><Spinner animation="border" size="sm" className="me-2" />Writing 5 versions…</>
              ) : (
                <><i className="bi bi-stars me-2" aria-hidden="true" />{result?.variants?.length ? "Write 5 new versions" : "Write 5 versions"}</>
              )}
            </Button>
            {generating && (
              <span className="small text-secondary">
                The local AI writes and checks each version; this can take a minute or two.
              </span>
            )}
          </div>
        </Form>

        {error && <Alert variant="danger" className="mt-3 mb-0">{error}</Alert>}

        {result?.variants?.length > 0 && (
          <div className="row g-3 mt-2">
            {result.variants.map((variant, index) => (
              <div key={variant.id} className="col-12 col-xl-6">
                <div className="summary-variant h-100 d-flex flex-column">
                  <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                    <div>
                      <Badge bg="primary" className="me-2">{index + 1}</Badge>
                      <span className="fw-semibold">{variant.label}</span>
                      <div className="small text-secondary">{variant.hint}</div>
                    </div>
                    <span className="small text-secondary text-nowrap">{variant.words} words</span>
                  </div>

                  <p className="mb-3 lh-lg flex-grow-1">{variant.summary}</p>

                  <SummaryChecks checks={variant.review} compact />

                  <div className="d-flex flex-wrap gap-2 mt-3">
                    <Button size="sm" disabled={busy} onClick={() => onUse(variant)}>
                      <i className="bi bi-check2 me-1" aria-hidden="true" />Use this
                    </Button>
                    <Button size="sm" variant="outline-secondary" disabled={busy} onClick={() => onEdit(variant)}>
                      <i className="bi bi-pencil me-1" aria-hidden="true" />Edit first
                    </Button>
                    <Button size="sm" variant="outline-secondary" onClick={() => copy(variant)}>
                      <i className={`bi ${copied === variant.id ? "bi-clipboard-check" : "bi-clipboard"} me-1`} aria-hidden="true" />
                      {copied === variant.id ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {result?.notes?.length > 0 && (
          <Alert variant="light" className="border small mt-3 mb-0">
            <div className="fw-semibold mb-1">
              {result.variants?.length ? `${5 - result.variants.length} version(s) left out:` : "Why no version passed:"}
            </div>
            <ul className="mb-0 ps-3">
              {result.notes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </Alert>
        )}
      </Card.Body>
    </Card>
  );
}
