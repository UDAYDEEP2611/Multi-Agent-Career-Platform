import { useState } from "react";
import {
  Modal, Form, Button, Alert, Row, Col
} from "react-bootstrap";
import FileAttachmentField from "./FileAttachmentField";

const months = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December"
];

const emptyForm = {
  organization: "",
  role: "",
  cause: "",
  location: "",
  startMonth: "",
  startYear: "",
  currentlyVolunteering: false,
  endMonth: "",
  endYear: "",
  description: "",
  url: ""
};

export default function ExperienceVolunteeringModal({
  show,
  volunteering,
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
      volunteering
        ? {
            ...emptyForm,
            ...volunteering,
            startMonth: volunteering.startMonth ?? "",
            startYear: volunteering.startYear ?? "",
            endMonth: volunteering.endMonth ?? "",
            endYear: volunteering.endYear ?? ""
          }
        : { ...emptyForm }
    );

    setError("");
  };

  const change = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      organization: form.organization.trim(),
      role: form.role.trim(),
      cause: form.cause.trim(),
      location: form.location.trim(),
      startMonth: form.startMonth === ""
        ? null
        : Number(form.startMonth),
      startYear: form.startYear === ""
        ? null
        : Number(form.startYear),
      currentlyVolunteering: form.currentlyVolunteering,
      endMonth:
        form.currentlyVolunteering || form.endMonth === ""
          ? null
          : Number(form.endMonth),
      endYear:
        form.currentlyVolunteering || form.endYear === ""
          ? null
          : Number(form.endYear),
      description: form.description.trim(),
      url: form.url.trim()
    };

    try {
      await onSave(payload, { file, removeFile });
      onHide();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to save volunteering record"
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
            {volunteering
              ? "Edit Volunteering"
              : "Add Volunteering"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Row className="g-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Organization *</Form.Label>
                <Form.Control
                  name="organization"
                  placeholder="Organization name"
                  value={form.organization}
                  onChange={change}
                  required
                  maxLength={200}
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Role *</Form.Label>
                <Form.Control
                  name="role"
                  placeholder="Role"
                  value={form.role}
                  onChange={change}
                  required
                  maxLength={200}
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Cause (Optional)</Form.Label>
                <Form.Control
                  name="cause"
                  value={form.cause}
                  onChange={change}
                  maxLength={100}
                  placeholder="Cause"
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Location (Optional)</Form.Label>
                <Form.Control
                  name="location"
                  placeholder="City, State or Remote"
                  value={form.location}
                  onChange={change}
                  maxLength={200}
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Start Month</Form.Label>
                <Form.Select
                  name="startMonth"
                  value={form.startMonth}
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
                <Form.Label>Start Year</Form.Label>
                <Form.Control
                  type="number"
                  name="startYear"
                  placeholder="YYYY"
                  min={1900}
                  max={2100}
                  value={form.startYear}
                  onChange={change}
                />
              </Form.Group>
            </Col>

            <Col xs={12}>
              <Form.Check
                type="checkbox"
                name="currentlyVolunteering"
                label="I currently volunteer here"
                checked={form.currentlyVolunteering}
                onChange={change}
              />
            </Col>

            {!form.currentlyVolunteering && (
              <>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>End Month</Form.Label>
                    <Form.Select
                      name="endMonth"
                      value={form.endMonth}
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
                    <Form.Label>End Year</Form.Label>
                    <Form.Control
                      type="number"
                      name="endYear"
                      placeholder="YYYY"
                      min={1900}
                      max={2100}
                      value={form.endYear}
                      onChange={change}
                    />
                  </Form.Group>
                </Col>
              </>
            )}

            <Col xs={12}>
              <FileAttachmentField
                currentFile={volunteering?.file}
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
                  placeholder="Describe your volunteering activities..."
                  value={form.description}
                  onChange={change}
                  maxLength={5000}
                />
              </Form.Group>
            </Col>

            <Col xs={12}>
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
            {saving ? "Saving..." : "Save Volunteering"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
