import { useState } from "react";
import { Alert, Button, Form, Modal } from "react-bootstrap";

import CharCount from "../Common/CharCount";
import { CATEGORIES, INTEREST_LIMITS } from "./interestOptions";
import VisibilityToggles from "../Common/VisibilityToggles";

const emptyForm = { name: "", category: "Other", description: "" };

export default function InterestModal({ show, interest, defaultCategory, onHide, onSave }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleShow = () => {
    setForm(
      interest
        ? { name: interest.name, category: interest.category, description: interest.description }
        : { ...emptyForm, category: defaultCategory || "Other" }
    );
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
        name: form.name.trim(),
        category: form.category,
        description: form.description.trim()
      });
      onHide();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to save interest");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      show={show}
      onShow={handleShow}
      onHide={saving ? undefined : onHide}
      centered
      backdrop={saving ? "static" : true}
      keyboard={!saving}
    >
      <Form onSubmit={submit}>
        <Modal.Header closeButton={!saving}>
          <Modal.Title>{interest ? "Edit Interest" : "Add Interest"}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {interest?._id && (
            <div className="d-flex align-items-center gap-2 mb-3 small text-secondary">
              Shows on
              <VisibilityToggles section="interests" item={interest} />
            </div>
          )}
          {error && <Alert variant="danger">{error}</Alert>}

          <Form.Group className="mb-3" controlId="interest-name">
            <Form.Label>Interest *</Form.Label>
            <Form.Control
              name="name"
              value={form.name}
              onChange={change}
              required
              maxLength={INTEREST_LIMITS.name}
              placeholder="Ex: Interest or hobby"
              autoFocus
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="interest-category">
            <Form.Label>Category</Form.Label>
            <Form.Select name="category" value={form.category} onChange={change}>
              {CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group controlId="interest-description">
            <Form.Label>Short description</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              name="description"
              value={form.description}
              onChange={change}
              maxLength={INTEREST_LIMITS.description}
              placeholder="Optional: what draws you to it"
            />
            <CharCount value={form.description} max={INTEREST_LIMITS.description} />
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
