import { useState } from "react";
import {
  Modal,
  Form,
  Button,
  Alert,
  Row,
  Col
} from "react-bootstrap";

const emptyForm = {
  name: "",
  code: ""
};

export default function EducationCourseModal({
  show,
  course,
  onHide,
  onSave
}) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleShow = () => {
    setForm(
      course
        ? {
            name: course.name || "",
            code: course.code || ""
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
      setError("Course name is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSave({
        name: form.name.trim(),
        code: form.code.trim()
      });

      onHide();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to save course"
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
            {course ? "Edit Course" : "Add Course"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Row className="g-3">
            <Col sm={4}>
              <Form.Group>
                <Form.Label>Course ID (Optional)</Form.Label>
                <Form.Control
                  name="code"
                  value={form.code}
                  onChange={change}
                  maxLength={50}
                  placeholder="Course ID"
                />
              </Form.Group>
            </Col>

            <Col sm={8}>
              <Form.Group>
                <Form.Label>Course Name *</Form.Label>
                <Form.Control
                  name="name"
                  value={form.name}
                  onChange={change}
                  maxLength={200}
                  required
                  placeholder="Course name"
                />
              </Form.Group>
            </Col>
          </Row>
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
            {saving ? "Saving..." : "Save Course"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
