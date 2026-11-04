import { useState } from "react";
import {
  Modal,
  Form,
  Button,
  Alert
} from "react-bootstrap";

export default function EducationTaskModal({
  show,
  task,
  onHide,
  onSave
}) {
  const [description, setDescription] = useState("");
  const [order, setOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleShow = () => {
    setDescription(task?.description || "");
    setOrder(task?.order ?? 0);
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!description.trim()) {
      setError("Task description is required");
      return;
    }

    const numericOrder = Number(order);

    if (
      !Number.isInteger(numericOrder) ||
      numericOrder < 0
    ) {
      setError("Order must be a non-negative integer");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSave({
        description: description.trim(),
        order: numericOrder
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
            {task ? "Edit Task" : "Add Task"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && (
            <Alert variant="danger">
              {error}
            </Alert>
          )}

          <Form.Group className="mb-3">
            <Form.Label>Task / Responsibility *</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              maxLength={2000}
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              placeholder="Describe your academic task or responsibility..."
              required
            />
            <Form.Text muted>
              {description.length}/2000 characters
            </Form.Text>
          </Form.Group>

          <Form.Group>
            <Form.Label>Display Order (Optional)</Form.Label>
            <Form.Control
              type="number"
              min={0}
              step={1}
              value={order}
              onChange={(event) =>
                setOrder(event.target.value)
              }
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
            {saving ? "Saving..." : "Save Task"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
