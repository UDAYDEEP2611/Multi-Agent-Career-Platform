import { useState } from "react";
import { Modal, Form, Button, Alert } from "react-bootstrap";

const emptyForm = {
  name: "",
  category: ""
};

export default function ExperienceSkillModal({
  show,
  skill,
  onHide,
  onSave
}) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleShow = () => {
    setForm({
      name: skill?.name || "",
      category: skill?.category || ""
    });

    setError("");
  };

  const change = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await onSave({
        name: form.name.trim(),
        category: form.category.trim()
      });

      onHide();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to save skill"
      );
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
          <Modal.Title>
            {skill ? "Edit Skill" : "Add Skill"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Form.Group className="mb-3">
            <Form.Label>Skill Name *</Form.Label>
            <Form.Control
              name="name"
              value={form.name}
              onChange={change}
              placeholder="Skill name"
              required
              maxLength={100}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Category (Optional)</Form.Label>
            <Form.Control
              name="category"
              value={form.category}
              onChange={change}
              placeholder="Category"
              maxLength={100}
            />
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={saving}
            onClick={onHide}
          >
            Cancel
          </Button>

          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Skill"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
