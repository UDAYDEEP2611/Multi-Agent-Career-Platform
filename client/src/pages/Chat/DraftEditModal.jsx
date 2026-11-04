import { useState } from "react";
import { Alert, Badge, Button, CloseButton, Col, Form, Modal, Row, Spinner } from "react-bootstrap";

import { MONTHS } from "./bufferSections";

const LONG_FIELDS = ["description", "summary", "content", "text"];
const isWide = (field, value) => field.type === "list" || LONG_FIELDS.includes(field.name) || String(value ?? "").length > 90;
const capitalised = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// A list of values as removable pills. Enter, a comma or leaving the box adds
// what was typed, so nothing typed is lost when the form is saved.
function ListInput({ id, value, label, onChange }) {
  const [text, setText] = useState("");
  const items = Array.isArray(value) ? value : [];

  const add = (typed) => {
    const fresh = typed.split(",").map((item) => item.trim()).filter((item) => item && !items.includes(item));
    if (fresh.length) onChange([...items, ...fresh]);
    setText("");
  };

  return (
    <>
      {items.length > 0 && (
        <div className="uuv-draft-pills">
          {items.map((item) => (
            <Badge key={item} pill bg="primary-subtle" text="primary-emphasis" className="uuv-draft-pill">
              {item}
              <CloseButton aria-label={`Remove ${item}`} onClick={() => onChange(items.filter((other) => other !== item))} />
            </Badge>
          ))}
        </div>
      )}
      <Form.Control
        id={id}
        value={text}
        placeholder={`Add ${label.toLowerCase()}, then press Enter`}
        onChange={(event) => {
          if (event.target.value.includes(",")) add(event.target.value);
          else setText(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          add(text);
        }}
        onBlur={() => add(text)}
      />
    </>
  );
}

// One input per field, in the field's type
function FieldInput({ field, value, wide, onChange, id }) {
  if (field.type === "boolean") {
    return <Form.Check type="switch" id={id} checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} label={value ? "Yes" : "No"} />;
  }
  if (field.type === "enum" || field.type === "month") {
    const options = field.type === "month" ? MONTHS.map((label, index) => [index + 1, label]) : field.options.map((option) => [option, option]);
    return (
      <Form.Select id={id} required={field.required} value={value ?? ""} onChange={(event) => onChange(event.target.value === "" ? null : field.type === "month" ? Number(event.target.value) : event.target.value)}>
        <option value="">Choose…</option>
        {options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}
      </Form.Select>
    );
  }
  if (field.type === "list") {
    return <ListInput id={id} value={value} label={field.label} onChange={onChange} />;
  }
  if (wide) {
    return <Form.Control id={id} as="textarea" rows={5} required={field.required} value={value ?? ""} onChange={(event) => onChange(event.target.value || null)} />;
  }
  const numeric = field.type === "year" || field.type === "number";
  return (
    <Form.Control
      id={id}
      required={field.required}
      type={numeric ? "number" : field.type === "date" ? "date" : "text"}
      value={field.type === "date" ? String(value ?? "").slice(0, 10) : value ?? ""}
      onChange={(event) => onChange(event.target.value === "" ? null : numeric ? Number(event.target.value) : event.target.value)}
    />
  );
}

// Edit one entry the assistant prepared, before it's added. Save keeps it in
// the buffer; Save & add confirms it straight away.
export default function DraftEditModal({ show, draft, onHide, onSave, onSaveAndAdd }) {
  const [values, setValues] = useState(draft.data);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const dirty = JSON.stringify(values) !== JSON.stringify(draft.data);

  const run = async (kind, request) => {
    setBusy(kind);
    setError("");
    try {
      await request(values);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setBusy("");
    }
  };

  return (
    <Modal
      show={show}
      onShow={() => {
        setValues(draft.data);
        setError(draft.error || "");
      }}
      onHide={busy ? undefined : onHide}
      size="lg"
      centered
      scrollable
      fullscreen="sm-down"
      // Clicking outside or pressing Esc doesn't throw away unsaved edits
      backdrop={dirty || busy ? "static" : true}
      keyboard={!dirty && !busy}
      aria-labelledby={`draft-${draft.id}-title`}
    >
      <Form
        className="uuv-draft-form"
        onSubmit={(event) => {
          event.preventDefault();
          run("save", onSave);
        }}
      >
        <Modal.Header closeButton={!busy}>
          <Modal.Title id={`draft-${draft.id}-title`} className="h5 min-w-0">
            Edit {draft.sectionLabel} entry
            <span className="uuv-draft-modal-sub">{draft.summary}</span>
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && <Alert variant="danger" className="small">{error}</Alert>}
          {draft.notes.map((note) => (
            <Alert key={note} variant="warning" className="small py-2">
              <i className="bi bi-exclamation-triangle me-1" aria-hidden="true" />{note}
            </Alert>
          ))}

          <Row className="g-3">
            {draft.fields.map((field) => (
              <Col key={field.name} xs={12} md={isWide(field, draft.data[field.name]) ? 12 : 6}>
                <Form.Label htmlFor={`draft-${draft.id}-${field.name}`} className="uuv-draft-label">
                  {capitalised(field.label)}{field.required && <span className="text-danger"> *</span>}
                </Form.Label>
                <FieldInput
                  id={`draft-${draft.id}-${field.name}`}
                  field={field}
                  value={values[field.name]}
                  // From the saved value, so a box doesn't change shape while typing
                  wide={isWide(field, draft.data[field.name])}
                  onChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))}
                />
              </Col>
            ))}
          </Row>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="link" className="text-secondary text-decoration-none me-auto" disabled={Boolean(busy)} onClick={onHide}>Cancel</Button>
          <Button type="submit" variant="outline-primary" disabled={Boolean(busy)}>
            {busy === "save" ? <Spinner size="sm" /> : "Save changes"}
          </Button>
          <Button
            disabled={Boolean(busy)}
            onClick={(event) => {
              if (event.currentTarget.form.reportValidity()) run("add", onSaveAndAdd);
            }}
          >
            {busy === "add" ? <Spinner size="sm" /> : <><i className="bi bi-check2 me-1" aria-hidden="true" />Save & add</>}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
