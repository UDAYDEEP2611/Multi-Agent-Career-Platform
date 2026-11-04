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
  role: "",
  contribution: "",
  email: "",
  profileUrl: ""
};

export default function ExperienceProjectContributorModal({
  show,
  contributor,
  onHide,
  onSave
}) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleShow = () => {
    setForm(
      contributor
        ? {
            name: contributor.name || "",
            role: contributor.role || "",
            contribution: contributor.contribution || "",
            email: contributor.email || "",
            profileUrl: contributor.profileUrl || ""
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
    setSaving(true);
    setError("");

    try {
      await onSave({
        name: form.name.trim(),
        role: form.role.trim(),
        contribution: form.contribution.trim(),
        email: form.email.trim(),
        profileUrl: form.profileUrl.trim()
      });

      onHide();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to save contributor"
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
      size="lg"
      centered
      scrollable
      backdrop={saving ? "static" : true}
      keyboard={!saving}
    >
      <Form onSubmit={submit} className="d-flex flex-column overflow-hidden">
        <Modal.Header closeButton={!saving}>
          <Modal.Title>
            {contributor
              ? "Edit Contributor"
              : "Add Contributor"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Row className="g-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Contributor Name *</Form.Label>
                <Form.Control
                  name="name"
                  value={form.name}
                  onChange={change}
                  required
                  maxLength={150}
                  placeholder="Full name"
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Project Role *</Form.Label>
                <Form.Control
                  name="role"
                  value={form.role}
                  onChange={change}
                  required
                  maxLength={150}
                  placeholder="Role"
                />
              </Form.Group>
            </Col>

            <Col xs={12}>
              <Form.Group>
                <Form.Label>Contribution (Optional)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  name="contribution"
                  value={form.contribution}
                  onChange={change}
                  maxLength={3000}
                  placeholder="Describe their contribution..."
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Email (Optional)</Form.Label>
                <Form.Control
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={change}
                  maxLength={254}
                  placeholder="Email address"
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Profile URL / Link (Optional)</Form.Label>
                <Form.Control
                  type="url"
                  name="profileUrl"
                  value={form.profileUrl}
                  onChange={change}
                  maxLength={2048}
                  placeholder="https://..."
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
            {saving ? "Saving..." : "Save Contributor"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
