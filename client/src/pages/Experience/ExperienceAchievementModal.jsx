import { useState } from "react";
import { Modal, Form, Button, Alert, Row, Col } from "react-bootstrap";
import FileAttachmentField from "./FileAttachmentField";

const types = [
  "Achievement",
  "Award",
  "Recognition",
  "Milestone",
  "Activity",
  "Other"
];

const months = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December"
];

const emptyForm = {
  title: "",
  type: "Achievement",
  description: "",
  month: "",
  year: "",
  issuedBy: "",
  url: ""
};

export default function ExperienceAchievementModal({
  show,
  achievement,
  onHide,
  onSave
}) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState(null);
  const [removeFile, setRemoveFile] = useState(false);

  const handleShow = () => {
    setFile(null);
    setRemoveFile(false);

    setForm(
      achievement
        ? {
            title: achievement.title || "",
            type: achievement.type || "Achievement",
            description: achievement.description || "",
            month: achievement.month ?? "",
            year: achievement.year ?? "",
            issuedBy: achievement.issuedBy || "",
            url: achievement.url || ""
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

    const payload = {
      title: form.title.trim(),
      type: form.type,
      description: form.description.trim(),
      month: form.month === "" ? null : Number(form.month),
      year: form.year === "" ? null : Number(form.year),
      issuedBy: form.issuedBy.trim(),
      url: form.url.trim()
    };

    try {
      await onSave(payload, { file, removeFile });
      onHide();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to save achievement"
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
            {achievement ? "Edit Achievement" : "Add Achievement"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Row className="g-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Title *</Form.Label>
                <Form.Control
                  name="title"
                  value={form.title}
                  onChange={change}
                  required
                  maxLength={200}
                  placeholder="Achievement title"
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Type *</Form.Label>
                <Form.Select
                  name="type"
                  value={form.type}
                  onChange={change}
                >
                  {types.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Month (Optional)</Form.Label>
                <Form.Select
                  name="month"
                  value={form.month}
                  onChange={change}
                >
                  <option value="">Month</option>
                  {months.map((month, index) => (
                    <option key={month} value={index + 1}>
                      {month}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Year (Optional)</Form.Label>
                <Form.Control
                  type="number"
                  name="year"
                  placeholder="YYYY"
                  min={1900}
                  max={2100}
                  value={form.year}
                  onChange={change}
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Issued By (Optional)</Form.Label>
                <Form.Control
                  name="issuedBy"
                  value={form.issuedBy}
                  onChange={change}
                  maxLength={200}
                  placeholder="Organization or authority"
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>URL / Link (Optional)</Form.Label>
                <Form.Control
                  type="url"
                  name="url"
                  value={form.url}
                  onChange={change}
                  maxLength={2048}
                  placeholder="https://..."
                />
              </Form.Group>
            </Col>

            <Col xs={12}>
              <FileAttachmentField
                currentFile={achievement?.file}
                file={file}
                onFileChange={setFile}
                removeFile={removeFile}
                onRemoveFileChange={setRemoveFile}
                onError={setError}
              />
            </Col>

            <Col xs={12}>
              <Form.Group>
                <Form.Label>Description (Optional)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  name="description"
                  value={form.description}
                  onChange={change}
                  maxLength={3000}
                  placeholder="Describe the achievement or activity..."
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
            {saving ? "Saving..." : "Save Achievement"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
