import { useState } from "react";
import { Alert, Badge, Button, Form, Offcanvas, Spinner } from "react-bootstrap";

import { deleteHeroSummary, saveHeroSummary } from "../../api/portfolioApi";
import { shortLede } from "./portfolioKit";
import useHeroSummaryAgent from "./useHeroSummaryAgent";

const MAX_TEXT = 400;

// Side panel on a design: read, edit, rewrite or reset its hero summary.
// Give it key={design.id} so switching designs starts a fresh draft.
export default function HeroSummaryPanel({ show, onHide, design, data, setHeroSummaries, title, intro }) {
  const saved = data?.heroSummaries?.[design.id];
  // Your unsaved edit; null shows what's saved
  const [draft, setDraft] = useState(null);
  const text = draft ?? saved?.text ?? "";
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const agent = useHeroSummaryAgent((summaries) => {
    setHeroSummaries(summaries);
    setDraft(null);
  });

  const fallback = shortLede(data?.summary || "");
  const trimmed = text.replace(/\s+/g, " ").trim();
  const changed = trimmed !== (saved?.text || "");

  async function act(request, success) {
    setBusy(true);
    setMessage({ type: "", text: "" });
    try {
      const { data: reply } = await request();
      setHeroSummaries(reply.heroSummaries);
      setDraft(null);
      setMessage({ type: "success", text: success });
    } catch (error) {
      setMessage({ type: "danger", text: error.response?.data?.message || "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Offcanvas show={show} onHide={onHide} placement="end" className="pf-summary-panel">
      <Offcanvas.Header closeButton>
        <Offcanvas.Title as="h2" className="h5 fw-bold mb-0">{title || `Hero summary · ${design.name}`}</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        <p className="small text-secondary">
          {intro || "The short line under your name and headline. The agent reads your whole About me and portfolio, then writes one for this design in its own voice, using only your facts."}
        </p>

        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          {saved ? <Badge bg="light" text="dark" className="border">{saved.origin || "Saved"}</Badge>
            : <Badge bg="light" text="secondary" className="border">Using your About me opening</Badge>}
          {saved?.stale && <Badge bg="warning" text="dark">Your summary or headline changed since</Badge>}
        </div>

        <Form.Label htmlFor="pf-hero-summary-text" className="visually-hidden">Hero summary</Form.Label>
        <Form.Control
          id="pf-hero-summary-text"
          as="textarea"
          rows={5}
          value={text}
          maxLength={MAX_TEXT}
          placeholder={fallback || "Add an About me summary, or let the agent write one"}
          onChange={(event) => setDraft(event.target.value)}
          disabled={busy || agent.running}
        />
        <div className="d-flex justify-content-between small text-secondary mt-1">
          <span>{(trimmed.match(/\S+/g) || []).length} words</span>
          <span>{text.length}/{MAX_TEXT}</span>
        </div>

        <div className="d-flex flex-wrap gap-2 mt-3">
          <Button onClick={() => agent.run([design.id])} disabled={busy || agent.running}>
            {agent.running ? <Spinner size="sm" className="me-1" /> : <i className="bi bi-stars me-1" aria-hidden="true" />}
            {saved ? "Rewrite with AI" : "Write with AI"}
          </Button>
          <Button
            variant="outline-primary"
            disabled={!trimmed || !changed || busy || agent.running}
            onClick={() => act(() => saveHeroSummary(design.id, trimmed), "Saved.")}
          >
            Save my wording
          </Button>
          {saved && (
            <Button
              variant="outline-secondary"
              disabled={busy || agent.running}
              onClick={() => act(() => deleteHeroSummary(design.id), "This design uses your About me opening again.")}
            >
              Reset
            </Button>
          )}
        </div>

        {agent.running && <p className="small text-secondary mt-3 mb-0" role="status">{agent.progress}…</p>}
        {agent.error && <Alert variant="danger" className="mt-3 small mb-0">{agent.error}</Alert>}
        {agent.notes.length > 0 && <Alert variant="warning" className="mt-3 small mb-0">{agent.notes.join(" ")}</Alert>}
        {message.text && <Alert variant={message.type} className="mt-3 small mb-0">{message.text}</Alert>}
      </Offcanvas.Body>
    </Offcanvas>
  );
}
