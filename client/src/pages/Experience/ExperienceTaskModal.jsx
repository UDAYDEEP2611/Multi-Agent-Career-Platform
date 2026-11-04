import { useState } from "react";
import { Modal, Form, Button, Alert } from "react-bootstrap";

export default function ExperienceTaskModal({
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
    setSaving(true);
    setError("");

    try {
      await onSave(description.trim());
      onHide();
    } catch (err) {
      setError(
        err.response?.data?.message ||
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
    >
      <Form onSubmit={submit}>
        <Modal.Header closeButton={!saving}>
          <Modal.Title>
            {task ? "Edit Task" : "Add Task"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Form.Group>
            <Form.Label>Task / Highlight *</Form.Label>
            <Form.Control
              as="textarea"
              rows={5}
              maxLength={2000}
              required
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              placeholder="Describe your responsibility or achievement..."
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
