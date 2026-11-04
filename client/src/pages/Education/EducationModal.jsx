import { useState } from "react";
import {
  Modal,
  Form,
  Button,
  Row,
  Col,
  Alert
} from "react-bootstrap";
import CharCount from "../Common/CharCount";
import SelectWithOther from "../Common/SelectWithOther";
import { DEGREES, FIELDS_OF_STUDY } from "./educationOptions";
import { TEXT_LIMITS } from "../../limits";

const emptyForm = {
  institution: "",
  degree: "",
  fieldOfStudy: "",
  location: "",
  startMonth: "",
  startYear: "",
  endMonth: "",
  endYear: "",
  currentlyStudying: false,
  grade: "",
  description: ""
};

const months = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December"
];

export default function EducationModal({
  show,
  education,
  onHide,
  onSave
}) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleShow = () => {
    if (education) {
      setForm({
        institution: education.institution || "",
        degree: education.degree || "",
        fieldOfStudy: education.fieldOfStudy || "",
        location: education.location || "",
        startMonth: education.startMonth ?? "",
        startYear: education.startYear ?? "",
        endMonth: education.endMonth ?? "",
        endYear: education.endYear ?? "",
        currentlyStudying: education.currentlyStudying || false,
        grade: education.grade || "",
        description: education.description || ""
      });
    } else {
      setForm({ ...emptyForm });
    }

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

    const numberOrNull = (value) =>
      value === "" || value === null
        ? null
        : Number(value);

    const payload = {
      institution: form.institution.trim(),
      degree: form.degree.trim(),
      fieldOfStudy: form.fieldOfStudy.trim(),
      location: form.location.trim(),
      startMonth: numberOrNull(form.startMonth),
      startYear: numberOrNull(form.startYear),
      endMonth: form.currentlyStudying
        ? null
        : numberOrNull(form.endMonth),
      endYear: form.currentlyStudying
        ? null
        : numberOrNull(form.endYear),
      currentlyStudying: form.currentlyStudying,
      grade: form.grade.trim(),
      description: form.description.trim()
    };

    try {
      await onSave(payload);
      onHide();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to save education"
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
            {education ? "Edit Education" : "Add Education"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Row className="g-3">
            <Col md={12}>
              <Form.Group>
                <Form.Label>Institution *</Form.Label>
                <Form.Control
                  name="institution"
                  value={form.institution}
                  onChange={change}
                  maxLength={200}
                  required
                  placeholder="Institution name"
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Degree *</Form.Label>
                <SelectWithOther
                  value={form.degree}
                  onChange={(degree) =>
                    setForm((previous) => ({ ...previous, degree }))
                  }
                  groups={DEGREES}
                  label="Degree"
                  placeholder="Select degree"
                  otherPlaceholder="Degree"
                  required
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Field of Study (Optional)</Form.Label>
                <SelectWithOther
                  value={form.fieldOfStudy}
                  onChange={(fieldOfStudy) =>
                    setForm((previous) => ({ ...previous, fieldOfStudy }))
                  }
                  groups={FIELDS_OF_STUDY}
                  label="Field of study"
                  placeholder="Select field of study"
                  otherPlaceholder="Field of study"
                />
              </Form.Group>
            </Col>

            <Col md={12}>
              <Form.Group>
                <Form.Label>Location (Optional)</Form.Label>
                <Form.Control
                  name="location"
                  value={form.location}
                  onChange={change}
                  maxLength={200}
                  placeholder="City, State, Country"
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
                  value={form.startYear}
                  onChange={change}
                  min={1900}
                  max={2100}
                  placeholder="YYYY"
                />
              </Form.Group>
            </Col>

            <Col md={12}>
              <Form.Check
                type="checkbox"
                id="education-currently-studying"
                name="currentlyStudying"
                checked={form.currentlyStudying}
                onChange={change}
                label="I am currently studying here"
              />
            </Col>

            {!form.currentlyStudying && (
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
                      value={form.endYear}
                      onChange={change}
                      min={1900}
                      max={2100}
                      placeholder="YYYY"
                    />
                  </Form.Group>
                </Col>
              </>
            )}

            <Col md={12}>
              <Form.Group>
                <Form.Label>Grade / GPA (Optional)</Form.Label>
                <Form.Control
                  name="grade"
                  value={form.grade}
                  onChange={change}
                  maxLength={50}
                  placeholder="GPA or grade"
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
                  maxLength={TEXT_LIMITS.summary}
                  placeholder="Describe your education..."
                />
                <CharCount value={form.description} max={TEXT_LIMITS.summary} />
              </Form.Group>
            </Col>
          </Row>
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={onHide}
            disabled={saving}
          >
            Cancel
          </Button>

          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Education"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
