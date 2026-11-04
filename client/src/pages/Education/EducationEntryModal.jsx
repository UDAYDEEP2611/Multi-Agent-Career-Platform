import { useState } from "react";
import {
  Modal,
  Form,
  Button,
  Alert,
  Row,
  Col
} from "react-bootstrap";

import FileAttachmentField from "../Experience/FileAttachmentField";

const emptyForm = {
  title: "",
  type: "",
  description: "",
  date: "",
  issuedBy: "",
  url: ""
};

// Add/Edit window for a dated education entry: Activities & Achievements
// or Certifications & Honors (types and wording come from props)
export default function EducationEntryModal({
  show,
  entry,
  types,
  itemLabel,
  titlePlaceholder,
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
      entry
        ? {
            title: entry.title || "",
            type: entry.type || types[0],
            description: entry.description || "",
            date: entry.date
              ? entry.date.slice(0, 10)
              : "",
            issuedBy: entry.issuedBy || "",
            url: entry.url || ""
          }
        : { ...emptyForm, type: types[0] }
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

    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSave(
        {
          title: form.title.trim(),
          type: form.type,
          description: form.description.trim(),
          date: form.date || null,
          issuedBy: form.issuedBy.trim(),
          url: form.url.trim()
        },
        { file, removeFile }
      );

      onHide();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        `Unable to save ${itemLabel.toLowerCase()}`
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
      size="lg"
      scrollable
      backdrop={saving ? "static" : true}
      keyboard={!saving}
    >
      <Form onSubmit={submit} className="d-flex flex-column overflow-hidden">
        <Modal.Header closeButton={!saving}>
          <Modal.Title>
            {entry ? `Edit ${itemLabel}` : `Add ${itemLabel}`}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Row className="g-3">
            <Col md={12}>
              <Form.Group>
                <Form.Label>Title *</Form.Label>
                <Form.Control
                  name="title"
                  value={form.title}
                  onChange={change}
                  maxLength={200}
                  required
                  placeholder={titlePlaceholder}
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Type</Form.Label>
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
                <Form.Label>Date (Optional)</Form.Label>
                <Form.Control
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={change}
                />
              </Form.Group>
            </Col>

            <Col md={12}>
              <Form.Group>
                <Form.Label>Issued By / Organization (Optional)</Form.Label>
                <Form.Control
                  name="issuedBy"
                  value={form.issuedBy}
                  onChange={change}
                  maxLength={200}
                  placeholder="Issuing organization"
                />
              </Form.Group>
            </Col>

            <Col md={12}>
              <Form.Group>
                <Form.Label>Description (Optional)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  name="description"
                  value={form.description}
                  onChange={change}
                  maxLength={3000}
                  placeholder="Add details..."
                />
              </Form.Group>
            </Col>

            <Col md={12}>
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

            <Col md={12}>
              <FileAttachmentField
                currentFile={entry?.file}
                file={file}
                onFileChange={setFile}
                removeFile={removeFile}
                onRemoveFileChange={setRemoveFile}
                onError={setError}
              />
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
            {saving ? "Saving..." : "Save"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
