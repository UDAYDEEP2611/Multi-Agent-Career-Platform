import { useState } from "react";
import { Modal, Form, Button, Alert, Row, Col } from "react-bootstrap";

import FileAttachmentField from "../Experience/FileAttachmentField";

const empty = {
  organization: "",
  role: "",
  cause: "",
  location: "",
  startMonth: "",
  startYear: "",
  endMonth: "",
  endYear: "",
  currentlyVolunteering: false,
  description: "",
  url: ""
};

const months = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December"
];

export default function EducationVolunteeringModal({
  show,
  volunteering,
  onHide,
  onSave
}) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState(null);
  const [removeFile, setRemoveFile] = useState(false);

  const handleShow = () => {
    setFile(null);
    setRemoveFile(false);

    setForm(volunteering ? {
      organization: volunteering.organization || "",
      role: volunteering.role || "",
      cause: volunteering.cause || "",
      location: volunteering.location || "",
      startMonth: volunteering.startMonth ?? "",
      startYear: volunteering.startYear ?? "",
      endMonth: volunteering.endMonth ?? "",
      endYear: volunteering.endYear ?? "",
      currentlyVolunteering:
        volunteering.currentlyVolunteering || false,
      description: volunteering.description || "",
      url: volunteering.url || ""
    } : { ...empty });

    setError("");
  };

  const change = (event) => {
    const { name, value, checked, type } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    const numberOrNull = (value) =>
      value === "" || value === null ? null : Number(value);

    const payload = {
      ...form,
      organization: form.organization.trim(),
      role: form.role.trim(),
      cause: form.cause.trim(),
      location: form.location.trim(),
      description: form.description.trim(),
      url: form.url.trim(),
      startMonth: numberOrNull(form.startMonth),
      startYear: numberOrNull(form.startYear),
      endMonth: form.currentlyVolunteering
        ? null : numberOrNull(form.endMonth),
      endYear: form.currentlyVolunteering
        ? null : numberOrNull(form.endYear)
    };

    setSaving(true);
    setError("");

    try {
      await onSave(payload, { file, removeFile });
      onHide();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to save volunteering"
      );
    } finally {
      setSaving(false);
    }
  };

  const monthOptions = months.map((month, index) => (
    <option key={month} value={index + 1}>
      {month}
    </option>
  ));

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
            {volunteering ? "Edit Volunteering" : "Add Volunteering"}
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
                  value={form.organization}
                  onChange={change}
                  maxLength={200}
                  required
                  placeholder="Organization name"
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Volunteer Role *</Form.Label>
                <Form.Control
                  name="role"
                  value={form.role}
                  onChange={change}
                  maxLength={150}
                  required
                  placeholder="Role"
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
                  maxLength={150}
                  placeholder="Cause"
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Location (Optional)</Form.Label>
                <Form.Control
                  name="location"
                  value={form.location}
                  onChange={change}
                  maxLength={200}
                  placeholder="City, State or Remote"
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
                  <option value="">Select month</option>
                  {monthOptions}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Start Year</Form.Label>
                <Form.Control
                  type="number"
                  name="startYear"
                  min={1900}
                  max={2100}
                  value={form.startYear}
                  onChange={change}
                />
              </Form.Group>
            </Col>

            <Col md={12}>
              <Form.Check
                type="checkbox"
                id="education-currently-volunteering"
                name="currentlyVolunteering"
                checked={form.currentlyVolunteering}
                onChange={change}
                label="I am currently volunteering here"
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
                      <option value="">Select month</option>
                      {monthOptions}
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group>
                    <Form.Label>End Year</Form.Label>
                    <Form.Control
                      type="number"
                      name="endYear"
                      min={1900}
                      max={2100}
                      value={form.endYear}
                      onChange={change}
                    />
                  </Form.Group>
                </Col>
              </>
            )}

            <Col md={12}>
              <Form.Group>
                <Form.Label>Description (Optional)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  name="description"
                  value={form.description}
                  onChange={change}
                  maxLength={5000}
                  placeholder="Describe your volunteering activities..."
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
                currentFile={volunteering?.file}
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
            {saving ? "Saving..." : "Save Volunteering"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
