import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Spinner } from "react-bootstrap";

import { AGENT_EVENTS, confirmDraft, discardDraft, getDrafts, updateDraft } from "../../api/agentApi";
import { MONTHS } from "./bufferSections";
import DraftEditModal from "./DraftEditModal";

function shown(field, value) {
  if (value === undefined || value === null || value === "") return "—";
  if (field.type === "boolean") return value ? "Yes" : "No";
  if (field.type === "list") return Array.isArray(value) ? value.join(", ") : String(value);
  if (field.type === "month") return MONTHS[value - 1] || value;
  return String(value);
}

function DraftCard({ draft, onConfirmed, onChanged }) {
  const [editing, setEditing] = useState(false);
  const saved = useRef(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState(draft.error);

  async function run(kind, request) {
    setBusy(kind);
    setError("");
    try {
      await request();
      return true;
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
      return false;
    } finally {
      setBusy("");
    }
  }

  const filled = draft.fields.filter((field) => draft.data[field.name] !== undefined && draft.data[field.name] !== "");

  return (
    <div className="uuv-draft">
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-2">
        <div className="min-w-0">
          <p className="uuv-draft-title">{draft.summary}</p>
          <p className="small text-secondary mb-0">
            {draft.section === "profile" || draft.section === "summary" ? "Confirming updates your " + draft.sectionLabel + ". " : ""}
            Prepared by the data entry agent{draft.sourceText ? <> from “{draft.sourceText.split("\n")[0].slice(0, 90)}”</> : ""}
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={Boolean(busy)}
            onClick={async () => {
              if (await run("confirm", () => confirmDraft(draft.id))) onConfirmed(draft.id);
              else onChanged();
            }}
          >
            {busy === "confirm" ? <Spinner size="sm" /> : <><i className="bi bi-check2 me-1" aria-hidden="true" />Confirm & add</>}
          </Button>
          <Button size="sm" variant="outline-secondary" disabled={Boolean(busy)} onClick={() => setEditing(true)}>
            <i className="bi bi-pencil me-1" aria-hidden="true" />Edit
          </Button>
          <Button
            size="sm"
            variant="outline-danger"
            disabled={Boolean(busy)}
            onClick={async () => {
              if (await run("discard", () => discardDraft(draft.id))) onConfirmed(draft.id, true);
            }}
          >
            Discard
          </Button>
        </div>
      </div>

      {draft.notes.map((note) => <p key={note} className="uuv-draft-note"><i className="bi bi-exclamation-triangle me-1" aria-hidden="true" />{note}</p>)}

      <dl className="uuv-draft-grid mt-3 mb-0">
        {filled.map((field) => (
          <div key={field.name}>
            <dt>{field.label}</dt>
            <dd>{shown(field, draft.data[field.name])}</dd>
          </div>
        ))}
      </dl>

      {error && <Alert variant="danger" className="small mt-3 mb-0">{error} Edit the entry and confirm again.</Alert>}

      <DraftEditModal
        show={editing}
        draft={draft}
        onHide={() => {
          setEditing(false);
          // A save that went through before adding failed: show what was saved
          if (saved.current) onChanged();
        }}
        onSave={async (values) => {
          await updateDraft(draft.id, values);
          setEditing(false);
          onChanged();
        }}
        onSaveAndAdd={async (values) => {
          await updateDraft(draft.id, values);
          saved.current = true;
          await confirmDraft(draft.id);
          setEditing(false);
          onConfirmed(draft.id);
        }}
      />
    </div>
  );
}

// The buffer zone on a section page: entries the agent prepared, waiting to
// be checked. onAdded() runs after one is confirmed, to refresh the page.
export default function DraftBuffer({ section, onAdded }) {
  const [drafts, setDrafts] = useState([]);
  const [added, setAdded] = useState("");

  const load = useCallback(() => {
    getDrafts(section).then(({ data }) => setDrafts(data.drafts)).catch(() => setDrafts([]));
  }, [section]);

  useEffect(() => {
    load();
    window.addEventListener(AGENT_EVENTS.buffer, load);
    return () => window.removeEventListener(AGENT_EVENTS.buffer, load);
  }, [load]);

  if (!drafts.length && !added) return null;
  if (!drafts.length) {
    return <Alert variant="success" className="small py-2 mb-4" dismissible onClose={() => setAdded("")}>{added}</Alert>;
  }

  return (
    <section className="uuv-buffer mb-4" aria-label="Buffer zone">
      {drafts.length > 0 && (
        <>
          <div className="d-flex align-items-center gap-2 mb-2">
            <i className="bi bi-inbox text-primary" aria-hidden="true" />
            <h2 className="h6 fw-bold mb-0">Buffer zone</h2>
            <Badge bg="primary" pill>{drafts.length}</Badge>
            <span className="small text-secondary">Check what the assistant prepared, then confirm to add it.</span>
          </div>
          {drafts.map((draft) => (
            <DraftCard
              key={`${draft.id}-${draft.error}-${JSON.stringify(draft.data)}`}
              draft={draft}
              onChanged={load}
              onConfirmed={(id, discarded) => {
                setDrafts((current) => current.filter((item) => item.id !== id));
                if (!discarded) {
                  setAdded(`Added "${draft.summary}".`);
                  onAdded?.();
                }
              }}
            />
          ))}
        </>
      )}
      {added && <Alert variant="success" className="small py-2 mb-0 mt-2" dismissible onClose={() => setAdded("")}>{added}</Alert>}
    </section>
  );
}
