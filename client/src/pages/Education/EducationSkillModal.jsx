import { useState } from "react";
import {
  Modal,
  Form,
  Button,
  Alert
} from "react-bootstrap";

const emptyForm = {
  name: "",
  category: "",
  order: 0
};

export default function EducationSkillModal({
  show,
  skill,
  onHide,
  onSave
}) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleShow = () => {
    setForm(
      skill
        ? {
            name: skill.name || "",
            category: skill.category || "",
            order: skill.order ?? 0
          }
        : { ...emptyForm }
    );

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

    if (!form.name.trim()) {
      setError("Skill name is required");
      return;
    }

    const order = Number(form.order);

    if (!Number.isInteger(order) || order < 0) {
      setError("Order must be a non-negative integer");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSave({
        name: form.name.trim(),
        category: form.category.trim(),
        order
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
              maxLength={100}
              placeholder="Skill name"
              required
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Category (Optional)</Form.Label>
            <Form.Control
              name="category"
              value={form.category}
              onChange={change}
              maxLength={100}
              placeholder="Category"
            />
          </Form.Group>

          <Form.Group>
            <Form.Label>Display Order (Optional)</Form.Label>
            <Form.Control
              type="number"
              name="order"
              min={0}
              step={1}
              value={form.order}
              onChange={change}
            />
            <Form.Text muted>
              Lower numbers appear first.
            </Form.Text>
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

          <Button
            type="submit"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Skill"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
