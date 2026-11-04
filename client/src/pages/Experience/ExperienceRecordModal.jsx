import { useState } from "react";
import {
  Modal, Form, Button, Alert, Row, Col
} from "react-bootstrap";
import FileAttachmentField from "./FileAttachmentField";

const recordTypes = [
  "Performance Review",
  "Employment Verification",
  "Training",
  "Certification",
  "Compliance",
  "Project Documentation",
  "Other"
];

const months = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December"
];

const emptyForm = {
  title: "",
  recordType: "Other",
  issuedBy: "",
  month: "",
  year: "",
  description: "",
  referenceUrl: "",
  referenceNumber: "",
  visibility: "Private"
};

export default function ExperienceRecordModal({
  show,
  record,
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
      record
        ? {
            title: record.title || "",
            recordType: record.recordType || "Other",
            issuedBy: record.issuedBy || "",
            month: record.month ?? "",
            year: record.year ?? "",
            description: record.description || "",
            referenceUrl: record.referenceUrl || "",
            referenceNumber: record.referenceNumber || "",
            visibility: record.visibility || "Private"
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
      recordType: form.recordType,
      issuedBy: form.issuedBy.trim(),
      month: form.month === "" ? null : Number(form.month),
      year: form.year === "" ? null : Number(form.year),
      description: form.description.trim(),
      referenceUrl: form.referenceUrl.trim(),
      referenceNumber: form.referenceNumber.trim(),
      visibility: form.visibility
    };

    try {
      await onSave(payload, { file, removeFile });
      onHide();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to save record"
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
            {record ? "Edit Record" : "Add Record"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Row className="g-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Record Title *</Form.Label>
                <Form.Control
                  name="title"
                  value={form.title}
                  onChange={change}
                  required
                  maxLength={200}
                  placeholder="Record title"
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Record Type *</Form.Label>
                <Form.Select
                  name="recordType"
                  value={form.recordType}
                  onChange={change}
                >
                  {recordTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Issued By (Optional)</Form.Label>
                <Form.Control
                  name="issuedBy"
                  placeholder="Issuing organization"
                  value={form.issuedBy}
                  onChange={change}
                  maxLength={200}
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Reference Number (Optional)</Form.Label>
                <Form.Control
                  name="referenceNumber"
                  value={form.referenceNumber}
                  onChange={change}
                  maxLength={100}
                  placeholder="Non-sensitive reference only"
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Record Month (Optional)</Form.Label>
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
                <Form.Label>Record Year (Optional)</Form.Label>
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

            <Col xs={12}>
              <Form.Group>
                <Form.Label>Description (Optional)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  name="description"
                  placeholder="Add details..."
                  value={form.description}
                  onChange={change}
                  maxLength={3000}
                />
              </Form.Group>
            </Col>

            <Col xs={12}>
              <Form.Group>
                <Form.Label>URL / Link (Optional)</Form.Label>
                <Form.Control
                  type="url"
                  name="referenceUrl"
                  value={form.referenceUrl}
                  onChange={change}
                  maxLength={2048}
                  placeholder="https://..."
                />
              </Form.Group>
            </Col>

            <Col xs={12}>
              <FileAttachmentField
                currentFile={record?.file}
                file={file}
                onFileChange={setFile}
                removeFile={removeFile}
                onRemoveFileChange={setRemoveFile}
                onError={setError}
              />
            </Col>

            <Col xs={12}>
              <Form.Group>
                <Form.Label>Visibility</Form.Label>
                <Form.Select
                  name="visibility"
                  value={form.visibility}
                  onChange={change}
                >
                  <option value="Private">Private</option>
                  <option value="Portfolio">Portfolio</option>
                </Form.Select>
                <Form.Text muted>
                  Private records should never appear on a public portfolio.
                  Only choose Portfolio for information approved for public use.
                </Form.Text>
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
            {saving ? "Saving..." : "Save Record"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
