import { useState } from "react";
import { Modal, Form, Button, Alert } from "react-bootstrap";

export default function ExperienceProjectTaskModal({
  show,
  task,
  onHide,
  onSave
}) {
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleShow = () => {
    setDescription(task?.description || "");
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!description.trim()) {
      setError("Task description is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSave({
        description: description.trim()
      });

      onHide();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to save task"
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
            {task ? "Edit Project Task" : "Add Project Task"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Form.Group>
            <Form.Label>Task Description *</Form.Label>
            <Form.Control
              as="textarea"
              rows={5}
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              maxLength={2000}
              required
              placeholder="Describe your responsibility or contribution..."
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
            {saving ? "Saving..." : "Save Task"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
