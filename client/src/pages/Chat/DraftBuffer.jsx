import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Form, Spinner } from "react-bootstrap";

import { AGENT_EVENTS, confirmDraft, discardDraft, getDrafts, updateDraft } from "../../api/agentApi";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shown(field, value) {
  if (value === undefined || value === null || value === "") return "—";
  if (field.type === "boolean") return value ? "Yes" : "No";
  if (field.type === "list") return Array.isArray(value) ? value.join(", ") : String(value);
  if (field.type === "month") return MONTHS[value - 1] || value;
  return String(value);
}

// One input per field, in the field's type
function FieldInput({ field, value, onChange, id }) {
  if (field.type === "boolean") {
    return <Form.Check type="switch" id={id} checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} label={value ? "Yes" : "No"} />;
  }
  if (field.type === "enum" || field.type === "month") {
    const options = field.type === "month" ? MONTHS.map((label, index) => [index + 1, label]) : field.options.map((option) => [option, option]);
    return (
      <Form.Select id={id} size="sm" value={value ?? ""} onChange={(event) => onChange(event.target.value === "" ? null : field.type === "month" ? Number(event.target.value) : event.target.value)}>
        <option value="">—</option>
        {options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}
      </Form.Select>
    );
  }
  if (field.type === "list") {
    return (
      <Form.Control
        id={id}
        size="sm"
        value={Array.isArray(value) ? value.join(", ") : value ?? ""}
        placeholder="Separate with commas"
        onChange={(event) => onChange(event.target.value.split(",").map((item) => item.trim()).filter(Boolean))}
      />
    );
  }
  if (field.name === "description" || field.name === "summary" || field.name === "content" || field.name === "text") {
    return <Form.Control id={id} as="textarea" rows={4} size="sm" value={value ?? ""} onChange={(event) => onChange(event.target.value || null)} />;
  }
  return (
    <Form.Control
      id={id}
      size="sm"
      type={field.type === "year" || field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value === "" ? null : field.type === "year" || field.type === "number" ? Number(event.target.value) : event.target.value)}
    />
  );
}

function DraftCard({ draft, onConfirmed, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(draft.data);
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
            disabled={Boolean(busy) || editing}
            onClick={async () => {
              if (await run("confirm", () => confirmDraft(draft.id))) onConfirmed(draft.id);
              else onChanged();
            }}
          >
            {busy === "confirm" ? <Spinner size="sm" /> : <><i className="bi bi-check2 me-1" aria-hidden="true" />Confirm & add</>}
          </Button>
          <Button size="sm" variant="outline-secondary" disabled={Boolean(busy)} onClick={() => setEditing(!editing)}>
            {editing ? "Cancel" : "Edit"}
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

      {editing ? (
        <Form
          className="uuv-draft-grid mt-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await run("save", () => updateDraft(draft.id, values))) {
              setEditing(false);
              onChanged();
            }
          }}
        >
          {draft.fields.map((field) => (
            <Form.Group key={field.name}>
              <Form.Label htmlFor={`draft-${draft.id}-${field.name}`} className="small mb-1">
                {field.label}{field.required && <span className="text-danger"> *</span>}
              </Form.Label>
              <FieldInput
                id={`draft-${draft.id}-${field.name}`}
                field={field}
                value={values[field.name]}
                onChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))}
              />
            </Form.Group>
          ))}
          <div className="uuv-draft-save">
            <Button type="submit" size="sm" disabled={Boolean(busy)}>{busy === "save" ? <Spinner size="sm" /> : "Save changes"}</Button>
          </div>
        </Form>
      ) : (
        <dl className="uuv-draft-grid mt-3 mb-0">
          {filled.map((field) => (
            <div key={field.name}>
              <dt>{field.label}</dt>
              <dd>{shown(field, draft.data[field.name])}</dd>
            </div>
          ))}
        </dl>
      )}

      {error && <Alert variant="danger" className="small mt-3 mb-0">{error} Edit the entry and confirm again.</Alert>}
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
