import { useState } from "react";
import {
  Alert,
  Button,
  Form,
  Modal
} from "react-bootstrap";

import CharCount from "../Common/CharCount";
import PeoplePillsInput from "../Common/PeoplePillsInput";
import { addTypedName } from "../Common/addTypedName";
import { todayValue } from "../Common/calendarDate";
import { PATENT_LIMITS, dateLabel } from "./patentOptions";

const emptyForm = {
  title: "",
  patentNumber: "",
  status: "Issued",
  date: "",
  coInventors: [],
  url: "",
  description: ""
};

export default function PatentModal({ show, patent, onHide, onSave }) {
  const [form, setForm] = useState(emptyForm);
  const [inventorText, setInventorText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleShow = () => {
    setForm(
      patent
        ? Object.fromEntries(
            Object.keys(emptyForm).map((key) => [key, patent[key] ?? emptyForm[key]])
          )
        : emptyForm
    );
    setInventorText("");
    setError("");
  };

  const change = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await onSave({
        title: form.title.trim(),
        patentNumber: form.patentNumber.trim(),
        status: form.status,
        date: form.date || null,
        // A name typed but not yet added counts too
        coInventors: addTypedName(form.coInventors, inventorText, PATENT_LIMITS.coInventors),
        url: form.url.trim(),
        description: form.description.trim()
      });
      onHide();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to save patent");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      show={show}
      onShow={handleShow}
      onHide={saving ? undefined : onHide}
      size="lg"
      centered
      scrollable
      backdrop={saving ? "static" : true}
      keyboard={!saving}
    >
      <Form onSubmit={submit} className="d-flex flex-column overflow-hidden">
        <Modal.Header closeButton={!saving}>
          <Modal.Title>{patent ? "Edit patent" : "Add patent"}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <p className="small text-secondary">* Indicates required</p>

          <Form.Group className="mb-3" controlId="patent-title">
            <Form.Label>Patent title *</Form.Label>
            <Form.Control
              name="title"
              value={form.title}
              onChange={change}
              required
              maxLength={PATENT_LIMITS.title}
              placeholder="Ex: Patent title"
            />
            <CharCount value={form.title} max={PATENT_LIMITS.title} />
          </Form.Group>

          <Form.Group className="mb-3" controlId="patent-number">
            <Form.Label>Patent or application number *</Form.Label>
            <Form.Control
              name="patentNumber"
              value={form.patentNumber}
              onChange={change}
              required
              maxLength={PATENT_LIMITS.patentNumber}
              placeholder="Ex: US 0000000"
            />
            <CharCount value={form.patentNumber} max={PATENT_LIMITS.patentNumber} />
          </Form.Group>

          <div className="mb-3">
            <div className="fw-medium">Inventor</div>
            <div className="small text-secondary mb-2">
              You are an inventor. Add others that contributed to the patent.
            </div>

            <PeoplePillsInput
              names={form.coInventors}
              onChange={(coInventors) => setForm((previous) => ({ ...previous, coInventors }))}
              text={inventorText}
              onTextChange={setInventorText}
              max={PATENT_LIMITS.coInventors}
              noun="inventor"
            />
          </div>

          <Form.Group className="mb-3">
            <Form.Label className="d-block">Status</Form.Label>
            {[
              ["Issued", "Patent issued"],
              ["Pending", "Patent pending"]
            ].map(([value, label]) => (
              <Form.Check
                key={value}
                type="radio"
                id={`patent-status-${value}`}
                name="status"
                value={value}
                label={label}
                checked={form.status === value}
                onChange={change}
              />
            ))}
          </Form.Group>

          <Form.Group className="mb-3" controlId="patent-date" style={{ maxWidth: 260 }}>
            <Form.Label>{dateLabel(form.status)}</Form.Label>
            <Form.Control
              type="date"
              name="date"
              value={form.date}
              onChange={change}
              min="1900-01-01"
              max={todayValue()}
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="patent-url">
            <Form.Label>Patent URL</Form.Label>
            <Form.Control
              type="url"
              name="url"
              value={form.url}
              onChange={change}
              maxLength={2048}
              placeholder="https://..."
            />
          </Form.Group>

          <Form.Group controlId="patent-description">
            <Form.Label>Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={5}
              name="description"
              value={form.description}
              onChange={change}
              maxLength={PATENT_LIMITS.description}
            />
            <CharCount value={form.description} max={PATENT_LIMITS.description} />
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="outline-secondary" disabled={saving} onClick={onHide}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
